import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JwtPayload } from './jwtPayload.type';

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Jangan percaya klaim role dari token: selalu ambil ulang dari database
   * agar user non-aktif langsung tertolak dan perubahan role berlaku tanpa
   * menunggu access token kedaluwarsa.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        roles: { select: { role: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesi tidak valid');
    }

    return {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles.map((assignment) => assignment.role),
      sessionId: payload.sessionId,
    };
  }
}
