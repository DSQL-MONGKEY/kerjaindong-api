import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CompanyMemberRole } from '../../generated/enums';
import { JwtPayload } from '../../modules/auth/jwtPayload.type';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { COMPANY_ROLES_KEY } from '../decorators/company-roles.decorator';

export type CompanyContext = {
  employerProfileId: string;
  companyId: string;
  companyRole: CompanyMemberRole;
};

/**
 * Resolusi keanggotaan company milik user yang sedang login.
 *
 * - Selalu memastikan user punya `EmployerProfile` aktif.
 * - Bila route memakai param `:companyId`, membership harus menunjuk company itu.
 * - Bila ada metadata `@CompanyRoles(...)`, role internal harus salah satunya.
 *
 * Hasil resolusi ditempel ke `request.companyContext` dan bisa dibaca lewat
 * decorator `@CurrentCompany()`.
 */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException('Forbidden resource');
    }

    const required =
      this.reflector.getAllAndOverride<CompanyMemberRole[]>(COMPANY_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const companyId = request.params?.companyId as string | undefined;

    const membership = await this.prisma.employerProfile.findUnique({
      where: { userId: user.sub },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('Anda belum terdaftar di perusahaan');
    }

    if (companyId && membership.companyId !== companyId) {
      throw new ForbiddenException('Tidak punya akses ke perusahaan ini');
    }

    if (required.length > 0 && !required.includes(membership.companyRole)) {
      throw new ForbiddenException('Role perusahaan tidak diizinkan');
    }

    request.companyContext = {
      employerProfileId: membership.id,
      companyId: membership.companyId,
      companyRole: membership.companyRole,
    } satisfies CompanyContext;

    return true;
  }
}
