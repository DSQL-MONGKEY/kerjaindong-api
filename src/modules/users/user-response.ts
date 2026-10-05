import type { Role } from '../../generated/enums';

/**
 * Bentuk user yang boleh keluar dari API (tanpa `password`).
 * Dipakai bersama oleh AuthService dan UsersService.
 */
export type UserWithAccess = {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  isActive: boolean;
  roles: { role: Role }[];
  jobSeekerProfile: { id: string } | null;
  employerProfile: { id: string; companyId: string } | null;
};

export const USER_WITH_ACCESS_INCLUDE = {
  roles: { select: { role: true } },
  jobSeekerProfile: { select: { id: true } },
  employerProfile: { select: { id: true, companyId: true } },
};

export function toPublicUser(user: UserWithAccess) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    isActive: user.isActive,
    roles: user.roles.map((assignment) => assignment.role),
    hasSeekerProfile: user.jobSeekerProfile !== null,
    hasEmployerProfile: user.employerProfile !== null,
    employerCompanyId: user.employerProfile?.companyId ?? null,
  };
}
