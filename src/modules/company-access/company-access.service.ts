import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class CompanyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findMembers(companyId: string) {
    const rows = await this.prisma.employerProfile.findMany({
      where: { companyId },
      orderBy: [{ companyRole: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        position: true,
        companyRole: true,
        isActive: true,
        createdAt: true,
        user: { select: { email: true, username: true, fullName: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      position: row.position,
      companyRole: row.companyRole,
      isActive: row.isActive,
      joinedAt: row.createdAt,
      user: row.user,
    }));
  }

  /** Soft remove: profil dinonaktifkan + session dicabut (riwayat tetap utuh). */
  async removeMember(
    actorUserId: string,
    companyId: string,
    targetUserId: string,
  ) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('Tidak dapat menghapus diri sendiri');
    }

    const target = await this.prisma.employerProfile.findUnique({
      where: { userId: targetUserId },
    });

    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('Anggota tidak ditemukan');
    }

    if (target.companyRole === 'OWNER') {
      throw new BadRequestException('Owner tidak dapat dihapus');
    }

    if (target.isActive) {
      await this.prisma.$transaction(async (tx) => {
        await tx.employerProfile.update({
          where: { userId: targetUserId },
          data: { isActive: false },
        });

        await tx.userSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    }

    return { message: 'Anggota dinonaktifkan' };
  }

  async createInvitation(
    actorUserId: string,
    companyId: string,
    dto: InviteMemberDto,
  ) {
    const email = dto.email.toLowerCase();

    const invitedUser = await this.prisma.user.findUnique({
      where: { email },
      include: { employerProfile: true },
    });

    if (invitedUser?.employerProfile?.isActive) {
      throw new ConflictException('Email sudah aktif di sebuah perusahaan');
    }

    // Undangan pending lama untuk email+company yang sama diganti agar tidak
    // ada beberapa token aktif sekaligus.
    await this.prisma.companyInvitation.deleteMany({
      where: { companyId, email, acceptedAt: null },
    });

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.companyInvitation.create({
      data: {
        companyId,
        email,
        role: dto.role,
        tokenHash: this.hashToken(token),
        invitedById: actorUserId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    // Token mentah hanya muncul di response ini (di produksi dikirim via email).
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      token,
    };
  }

  async findInvitations(companyId: string) {
    const rows = await this.prisma.companyInvitation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    });

    const now = Date.now();

    return rows.map((row) => ({
      ...row,
      status: row.acceptedAt
        ? 'ACCEPTED'
        : row.expiresAt.getTime() <= now
          ? 'EXPIRED'
          : 'PENDING',
    }));
  }

  async previewInvitation(token: string) {
    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { company: { select: { name: true, slug: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan');
    }

    const now = Date.now();

    return {
      company: invitation.company,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      status: invitation.acceptedAt
        ? 'ACCEPTED'
        : invitation.expiresAt.getTime() <= now
          ? 'EXPIRED'
          : 'PENDING',
    };
  }

  async acceptInvitation(userId: string, dto: AcceptInvitationDto) {
    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { tokenHash: this.hashToken(dto.token) },
    });

    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('Undangan sudah digunakan');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Undangan sudah kedaluwarsa');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'Undangan ini ditujukan untuk alamat email lain',
      );
    }

    if (
      user.employerProfile &&
      user.employerProfile.companyId !== invitation.companyId
    ) {
      throw new ConflictException('Anda sudah terdaftar di perusahaan lain');
    }

    await this.prisma.$transaction(async (tx) => {
      if (user.employerProfile) {
        // Pernah dinonaktifkan dari company yang sama — aktifkan kembali.
        await tx.employerProfile.update({
          where: { userId },
          data: { isActive: true, companyRole: invitation.role },
        });
      } else {
        await tx.employerProfile.create({
          data: {
            userId,
            companyId: invitation.companyId,
            firstName: user.fullName?.trim().split(/\s+/)[0] ?? user.username,
            companyRole: invitation.role,
          },
        });
      }

      await tx.userRoleAssignment.upsert({
        where: { userId_role: { userId, role: 'EMPLOYER' } },
        update: {},
        create: { userId, role: 'EMPLOYER' },
      });

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    return {
      message: 'Berhasil bergabung dengan perusahaan',
      companyId: invitation.companyId,
      role: invitation.role,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
