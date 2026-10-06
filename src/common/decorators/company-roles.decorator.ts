import { SetMetadata } from '@nestjs/common';
import type { CompanyMemberRole } from '../../generated/enums';

export const COMPANY_ROLES_KEY = 'companyRoles';

/**
 * Batasi endpoint ke role internal perusahaan tertentu. Dipakai bersama
 * `CompanyAccessGuard`.
 */
export const CompanyRoles = (...roles: CompanyMemberRole[]) =>
  SetMetadata(COMPANY_ROLES_KEY, roles);
