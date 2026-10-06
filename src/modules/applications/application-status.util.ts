import type { ApplicationStatus } from '../../generated/enums';

/** Status yang boleh ditetapkan oleh perusahaan (employer). */
export const COMPANY_SETTABLE_STATUSES: ApplicationStatus[] = [
  'REVIEWING',
  'SHORTLISTED',
  'REJECTED',
  'ACCEPTED',
];

/** Status final: tidak bisa berpindah lagi. */
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['REVIEWING', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  REVIEWING: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isCompanySettable(status: ApplicationStatus): boolean {
  return COMPANY_SETTABLE_STATUSES.includes(status);
}

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
