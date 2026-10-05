import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { PrismaService } from './../src/infra/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const username = `e2e_${suffix}`;
  const email = `${username}@kerjaindong.test`;
  const password = 'E2ePassword123';
  const duplicateUsername = `e2e_dup_${suffix}`;
  const duplicateEmail = `${duplicateUsername}@kerjaindong.test`;

  let agent: ReturnType<typeof request.agent>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [email, duplicateEmail] } },
    });
    await app.close();
  });

  it('registers a JOB_SEEKER, returns tokens and sets refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, username, password, fullName: 'E2E User' })
      .expect(201);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.username).toBe(username);
    expect(res.body.data.user.roles).toEqual(['JOB_SEEKER']);
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=');

    accessToken = res.body.data.accessToken;
  });

  it('rejects duplicate username/email with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: duplicateEmail, username, password })
      .expect(409);
  });

  it('returns the current user on GET /users/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.email).toBe(email);
    expect(res.body.data.hasSeekerProfile).toBe(false);
  });

  it('rejects wrong credentials with a generic message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: username, password: 'WrongPassword123' })
      .expect(401);

    expect(res.body.message).toBe('Kredensial tidak valid');
  });

  it('logs in by username, refreshes via cookie, then logs out', async () => {
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ identifier: username, password })
      .expect(200);

    expect(login.body.data.accessToken).toEqual(expect.any(String));

    const refresh = await agent.post('/api/v1/auth/refresh').expect(200);
    expect(refresh.body.data.accessToken).toEqual(expect.any(String));

    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refresh.body.data.accessToken}`)
      .expect(200);
    expect(logout.body.message).toBe('Logout berhasil');

    // Cookie sudah dihapus dan session dicabut — refresh harus ditolak.
    await agent.post('/api/v1/auth/refresh').expect(401);
  });
});
