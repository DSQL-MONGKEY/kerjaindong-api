import { canTransition } from './job-status.util';

describe('job-status transitions', () => {
  it('allows DRAFT to PUBLISHED or ARCHIVED only', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransition('DRAFT', 'ARCHIVED')).toBe(true);
    expect(canTransition('DRAFT', 'PAUSED')).toBe(false);
    expect(canTransition('DRAFT', 'CLOSED')).toBe(false);
  });

  it('allows PUBLISHED to PAUSED, CLOSED, ARCHIVED', () => {
    expect(canTransition('PUBLISHED', 'PAUSED')).toBe(true);
    expect(canTransition('PUBLISHED', 'CLOSED')).toBe(true);
    expect(canTransition('PUBLISHED', 'ARCHIVED')).toBe(true);
    expect(canTransition('PUBLISHED', 'PUBLISHED')).toBe(false);
  });

  it('allows reopening PAUSED/CLOSED back to PUBLISHED', () => {
    expect(canTransition('PAUSED', 'PUBLISHED')).toBe(true);
    expect(canTransition('CLOSED', 'PUBLISHED')).toBe(true);
  });

  it('treats ARCHIVED as terminal', () => {
    expect(canTransition('ARCHIVED', 'PUBLISHED')).toBe(false);
    expect(canTransition('ARCHIVED', 'DRAFT')).toBe(false);
    expect(canTransition('ARCHIVED', 'ARCHIVED')).toBe(false);
  });
});
