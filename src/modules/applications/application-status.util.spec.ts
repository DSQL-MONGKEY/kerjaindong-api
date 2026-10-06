import {
  canTransition,
  isCompanySettable,
  isTerminal,
} from './application-status.util';

describe('application-status transitions', () => {
  it('allows the standard pipeline', () => {
    expect(canTransition('APPLIED', 'REVIEWING')).toBe(true);
    expect(canTransition('REVIEWING', 'SHORTLISTED')).toBe(true);
    expect(canTransition('SHORTLISTED', 'ACCEPTED')).toBe(true);
    expect(canTransition('SHORTLISTED', 'REJECTED')).toBe(true);
  });

  it('rejects skipping straight to ACCEPTED from early stages', () => {
    expect(canTransition('APPLIED', 'ACCEPTED')).toBe(false);
    expect(canTransition('REVIEWING', 'ACCEPTED')).toBe(false);
  });

  it('allows withdrawal only before a terminal state', () => {
    expect(canTransition('APPLIED', 'WITHDRAWN')).toBe(true);
    expect(canTransition('SHORTLISTED', 'WITHDRAWN')).toBe(true);
    expect(canTransition('ACCEPTED', 'WITHDRAWN')).toBe(false);
    expect(canTransition('REJECTED', 'WITHDRAWN')).toBe(false);
  });

  it('treats ACCEPTED/REJECTED/WITHDRAWN as terminal', () => {
    expect(isTerminal('ACCEPTED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('WITHDRAWN')).toBe(true);
    expect(isTerminal('REVIEWING')).toBe(false);
  });

  it('only allows the company to set non-APPLIED/WITHDRAWN statuses', () => {
    expect(isCompanySettable('REVIEWING')).toBe(true);
    expect(isCompanySettable('ACCEPTED')).toBe(true);
    expect(isCompanySettable('APPLIED')).toBe(false);
    expect(isCompanySettable('WITHDRAWN')).toBe(false);
  });
});
