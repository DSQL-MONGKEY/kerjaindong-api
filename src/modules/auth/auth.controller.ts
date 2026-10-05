import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  GetCurrentUser,
  GetCurrentUserId,
  Public,
} from '../../common/decorators';
import { RtGuard } from '../../common/guards/rt.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayloadWithRefreshToken } from './jwtPayload.type';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const userAgentOf = (req: Request) =>
  req.headers['user-agent'] ?? 'Unknown Device';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.register(
      dto,
      userAgentOf(req),
      ipAddress,
    );

    this.setRefreshCookie(res, refreshToken);

    return { accessToken, user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      dto,
      userAgentOf(req),
      ipAddress,
    );

    this.setRefreshCookie(res, refreshToken);

    return { accessToken, user };
  }

  @Public()
  @UseGuards(RtGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetCurrentUser() payload: JwtPayloadWithRefreshToken,
    @Req() req: Request,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(
      payload.sub,
      payload.sessionId,
      payload.refreshToken,
      userAgentOf(req),
      ipAddress,
    );

    this.setRefreshCookie(res, tokens.refreshToken);

    return { accessToken: tokens.accessToken, user: tokens.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(userId, sessionId);

    res.clearCookie(REFRESH_COOKIE, { path: '/' });

    return result;
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }
}
