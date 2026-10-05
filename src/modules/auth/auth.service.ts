import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  toPublicUser,
  USER_WITH_ACCESS_INCLUDE,
  UserWithAccess,
} from '../users/user-response';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwtPayload.type';

const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = 'Kredensial tidak valid';

@Injectable()
export class AuthService {
  private dummyHash?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, userAgent: string, ipAddress: string) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email atau username sudah digunakan');
    }

    const password = await argon2.hash(dto.password, ARGON2_OPTIONS);

    let user: UserWithAccess;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          password,
          fullName: dto.fullName,
          roles: { create: { role: dto.role ?? 'JOB_SEEKER' } },
        },
        include: USER_WITH_ACCESS_INCLUDE,
      });
    } catch (error) {
      // Email/username dipakai bersamaan request lain (race) — unique index
      // di database yang jadi penentu akhir.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email atau username sudah digunakan');
      }
      throw error;
    }

    const tokens = await this.createSession(user, userAgent, ipAddress);

    return { ...tokens, user: toPublicUser(user) };
  }

  async login(dto: LoginDto, userAgent: string, ipAddress: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
      },
      include: USER_WITH_ACCESS_INCLUDE,
    });

    if (!user || !user.isActive) {
      // Verifikasi hash palsu agar waktu respons tidak membocorkan keberadaan
      // akun (anti user-enumeration berbasis timing).
      await argon2
        .verify(await this.getDummyHash(), dto.password)
        .catch(() => false);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await argon2
      .verify(user.password, dto.password)
      .catch(() => false);

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.prisma.userSession.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });

    const tokens = await this.createSession(user, userAgent, ipAddress);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { ...tokens, user: toPublicUser(user) };
  }

  async refresh(
    userId: string,
    sessionId: string,
    refreshToken: string,
    userAgent: string,
    ipAddress: string,
  ) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Sesi tidak valid');
    }

    // Refresh token dari session yang sudah revoked = indikasi pencurian;
    // cabut semua session user sebagai langkah pengamanan.
    if (session.revokedAt) {
      await this.revokeAllSessions(userId);
      throw new UnauthorizedException('Sesi tidak valid');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.userSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Sesi kedaluwarsa');
    }

    const tokenMatches = await argon2
      .verify(session.hashedToken, refreshToken)
      .catch(() => false);

    if (!tokenMatches) {
      await this.revokeAllSessions(userId);
      throw new UnauthorizedException('Sesi tidak valid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ACCESS_INCLUDE,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesi tidak valid');
    }

    const tokens = await this.signTokens(this.buildPayload(user, session.id));
    const hashedToken = await argon2.hash(tokens.refreshToken, ARGON2_OPTIONS);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        hashedToken,
        lastActive: new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent,
        ipAddress,
      },
    });

    return { ...tokens, user: toPublicUser(user) };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.userSession.deleteMany({
      where: { id: sessionId, userId },
    });

    return { message: 'Logout berhasil' };
  }

  private async createSession(
    user: UserWithAccess,
    userAgent: string,
    ipAddress: string,
  ) {
    const sessionId = randomUUID();
    const tokens = await this.signTokens(this.buildPayload(user, sessionId));
    const hashedToken = await argon2.hash(tokens.refreshToken, ARGON2_OPTIONS);

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        hashedToken,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return tokens;
  }

  private async signTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
        '15m') as JwtSignOptions['expiresIn'],
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
        '7d') as JwtSignOptions['expiresIn'],
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });

    return { accessToken, refreshToken };
  }

  private buildPayload(user: UserWithAccess, sessionId: string): JwtPayload {
    return {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles.map((assignment) => assignment.role),
      sessionId,
    };
  }

  private async revokeAllSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async getDummyHash() {
    this.dummyHash ??= await argon2.hash('invalid-password', ARGON2_OPTIONS);
    return this.dummyHash;
  }
}
