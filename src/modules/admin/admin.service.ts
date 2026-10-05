import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegionsService } from '../regions/regions.service';
import { AuditLogService } from './audit-log.service';
import { FindAdminCompaniesQueryDto } from './dto/find-admin-companies-query.dto';
import { FindAdminJobsQueryDto } from './dto/find-admin-jobs-query.dto';
import { FindAdminUsersQueryDto } from './dto/find-admin-users-query.dto';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';
import { UpdateCompanyVerificationDto } from './dto/update-company-verification.dto';
import { UpdateJobModerationDto } from './dto/update-job-moderation.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const PUBLISH_DURATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
    private readonly audit: AuditLogService,
  ) {}

  async findCompanies(query: FindAdminCompaniesQueryDto) {
    const { page, perPage, skip } = this.pagination(query);
    const where: Prisma.CompanyWhereInput = {
      ...(query.verification ? { verification: query.verification } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          verification: true,
          verifiedAt: true,
          provinceId: true,
          cityId: true,
          createdAt: true,
          _count: { select: { jobPosts: true, employers: true } },
        },
      }),
    ]);

    const regionMap = await this.regions.findByIds(
      rows.flatMap((row) => [row.provinceId, row.cityId]),
    );

    return {
      items: rows.map(({ provinceId, cityId, ...company }) => ({
        ...company,
        location: {
          province: provinceId ? (regionMap.get(provinceId) ?? null) : null,
          city: cityId ? (regionMap.get(cityId) ?? null) : null,
        },
      })),
      meta: this.meta(page, perPage, total),
    };
  }

  async updateCompanyVerification(
    adminId: string,
    companyId: string,
    dto: UpdateCompanyVerificationDto,
    context: AdminRequestContext,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, verification: true },
    });

    if (!company) {
      throw new NotFoundException('Perusahaan tidak ditemukan');
    }

    const verifiedAt = dto.status === 'VERIFIED' ? new Date() : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { verification: dto.status, verifiedAt },
      });

      await this.audit.record({
        tx,
        action: 'company.verification.update',
        entityType: 'company',
        entityId: companyId,
        before: { verification: company.verification },
        after: { verification: dto.status, note: dto.note },
        actorUserId: adminId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    });

    return { id: companyId, verification: dto.status, verifiedAt };
  }

  async findUsers(query: FindAdminUsersQueryDto) {
    const { page, perPage, skip } = this.pagination(query);
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
      }),
    ]);

    return {
      items: rows.map((user) => ({
        ...user,
        roles: user.roles.map((assignment) => assignment.role),
      })),
      meta: this.meta(page, perPage, total),
    };
  }

  async updateUserStatus(
    adminId: string,
    userId: string,
    dto: UpdateUserStatusDto,
    context: AdminRequestContext,
  ) {
    if (adminId === userId) {
      throw new BadRequestException('Tidak dapat mengubah status akun sendiri');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        roles: { select: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const isSysAdmin = user.roles.some((role) => role.role === 'SYS_ADMIN');

    if (isSysAdmin && !dto.isActive) {
      const activeAdmins = await this.prisma.user.count({
        where: { isActive: true, roles: { some: { role: 'SYS_ADMIN' } } },
      });

      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'Minimal satu SYS_ADMIN aktif harus tersisa',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: dto.isActive },
      });

      if (!dto.isActive) {
        // Cabut semua session saat akun dinonaktifkan.
        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.audit.record({
        tx,
        action: 'user.status.update',
        entityType: 'user',
        entityId: userId,
        before: { isActive: user.isActive },
        after: { isActive: dto.isActive, note: dto.note },
        actorUserId: adminId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    });

    return { id: userId, isActive: dto.isActive };
  }

  async findJobs(query: FindAdminJobsQueryDto) {
    const { page, perPage, skip } = this.pagination(query);
    const where: Prisma.JobPostWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.jobPost.count({ where }),
      this.prisma.jobPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          applicationCount: true,
          viewCount: true,
          publishedAt: true,
          expiresAt: true,
          createdAt: true,
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return { items: rows, meta: this.meta(page, perPage, total) };
  }

  async updateJobStatus(
    adminId: string,
    jobId: string,
    dto: UpdateJobModerationDto,
    context: AdminRequestContext,
  ) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, publishedAt: true, expiresAt: true },
    });

    if (!job) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    const now = new Date();
    const data: Prisma.JobPostUncheckedUpdateInput = { status: dto.status };

    if (dto.status === 'PUBLISHED') {
      data.publishedAt = job.publishedAt ?? now;
      data.expiresAt =
        job.expiresAt && job.expiresAt.getTime() > now.getTime()
          ? job.expiresAt
          : new Date(now.getTime() + PUBLISH_DURATION_DAYS * DAY_MS);
      data.closedAt = null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobPost.update({ where: { id: jobId }, data });

      await this.audit.record({
        tx,
        action: 'job.status.update',
        entityType: 'job',
        entityId: jobId,
        before: { status: job.status },
        after: { status: dto.status, note: dto.note },
        actorUserId: adminId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    });

    return { id: jobId, status: dto.status };
  }

  async findAuditLogs(query: FindAuditLogsQueryDto) {
    const { page, perPage, skip } = this.pagination(query);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        include: {
          actor: { select: { id: true, username: true, email: true } },
        },
      }),
    ]);

    return { items: rows, meta: this.meta(page, perPage, total) };
  }

  private pagination(query: { page?: number; perPage?: number }) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);

    return { page, perPage, skip: (page - 1) * perPage };
  }

  private meta(page: number, perPage: number, total: number) {
    return {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    };
  }
}
