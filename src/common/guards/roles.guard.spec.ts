import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/enums';
import { JwtPayload } from '../../modules/auth/jwtPayload.type';
import { RolesGuard } from './roles.guard';

function createContext(user?: Partial<JwtPayload>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows when the user has one of the required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['EMPLOYER'] as Role[]);

    expect(
      guard.canActivate(createContext({ roles: ['EMPLOYER'] as Role[] })),
    ).toBe(true);
  });

  it('throws when the user misses the required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['SYS_ADMIN'] as Role[]);

    expect(() =>
      guard.canActivate(createContext({ roles: ['JOB_SEEKER'] as Role[] })),
    ).toThrow(ForbiddenException);
  });
});
