import type { JobStatus } from '../../generated/enums';

export type JobStatusAction = 'publish' | 'pause' | 'close' | 'archive';

export const JOB_ACTION_TARGET: Record<JobStatusAction, JobStatus> = {
  publish: 'PUBLISHED',
  pause: 'PAUSED',
  close: 'CLOSED',
  archive: 'ARCHIVED',
};

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['PAUSED', 'CLOSED', 'ARCHIVED'],
  PAUSED: ['PUBLISHED', 'CLOSED', 'ARCHIVED'],
  CLOSED: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: [],
};

/** Termasuk final state: ARCHIVED tidak bisa berpindah ke status lain. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
