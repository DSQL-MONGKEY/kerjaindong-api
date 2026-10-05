import type { Role } from '../../generated/enums';

export type JwtPayload = {
  sub: string;
  username: string;
  email: string;
  roles: Role[];
  sessionId: string;
};

export type JwtPayloadWithRefreshToken = JwtPayload & {
  refreshToken: string;
};
