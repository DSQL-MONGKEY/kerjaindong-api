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

describe('Company members & invitations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const password = 'E2ePassword123';
  const owner = {
    username: `e2e_member_owner_${suffix}`,
    email: `e2e_member_owner_${suffix}@kerjaindong.test`,
  };
  const recruiter = {
    username: `e2e_member_recruiter_${suffix}`,
    email: `e2e_member_recruiter_${suffix}@kerjaindong.test`,
  };
  const companyName = `PT Member E2E ${suffix}`;

  let ownerToken: string;
  let recruiterToken: string;
  let ownerUserId: string;
  let recruiterUserId: string;
  let companyId: string;
  let recruiterInviteToken: string;

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

    const ownerReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...owner, password })
      .expect(201);
    ownerToken = ownerReg.body.data.accessToken;
    ownerUserId = ownerReg.body.data.user.id;

    const recruiterReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...recruiter, password })
      .expect(201);
    recruiterToken = recruiterReg.body.data.accessToken;
    recruiterUserId = recruiterReg.body.data.user.id;

    const company = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: companyName, firstName: 'Sari' })
      .expect(201);

    companyId = company.body.data.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, recruiter.email] } },
    });
    await prisma.company.deleteMany({ where: { name: companyName } });
    await app.close();
  });

  it('starts with only the owner as member', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].companyRole).toBe('OWNER');
    expect(res.body.data[0].userId).toBe(ownerUserId);
  });

  it('invites a recruiter and exposes a public preview', async () => {
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: recruiter.email, role: 'RECRUITER' })
      .expect(201);

    recruiterInviteToken = invite.body.data.token;
    expect(recruiterInviteToken).toEqual(expect.any(String));
    expect(invite.body.data.role).toBe('RECRUITER');

    const preview = await request(app.getHttpServer())
      .get(`/api/v1/invitations/${recruiterInviteToken}`)
      .expect(200);

    expect(preview.body.data.company.name).toBe(companyName);
    expect(preview.body.data.status).toBe('PENDING');
    expect(preview.body.data.email).toBe(recruiter.email);

    await request(app.getHttpServer())
      .get('/api/v1/invitations/token-tidak-valid-sama-sekali')
      .expect(404);
  });

  it('accepts the invitation and joins the company', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ token: recruiterInviteToken })
      .expect(200);

    expect(res.body.role).toBe('RECRUITER');
    expect(res.body.companyId).toBe(companyId);

    const members = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .expect(200);

    expect(members.body.data).toHaveLength(2);
    const memberList = members.body.data as Array<{
      userId: string;
      companyRole: string;
    }>;
    expect(
      memberList.some(
        (member) =>
          member.userId === recruiterUserId &&
          member.companyRole === 'RECRUITER',
      ),
    ).toBe(true);
  });

  it('rejects reusing an accepted invitation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ token: recruiterInviteToken })
      .expect(400);
  });

  it('rejects invites for an already active member', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: recruiter.email, role: 'ADMIN' })
      .expect(409);
  });

  it('forbids a recruiter from inviting members', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/invitations`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ email: 'baru@kerjaindong.test', role: 'RECRUITER' })
      .expect(403);
  });

  it('rejects accepting an invitation addressed to another email', async () => {
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'orang.lain@kerjaindong.test', role: 'ADMIN' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ token: invite.body.data.token })
      .expect(403);
  });

  it('removes a member and blocks their company access', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}/members/${ownerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}/members/${recruiterUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(removed.body.message).toBe('Anggota dinonaktifkan');

    await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .expect(403);

    const members = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(members.body.data).toHaveLength(2);
    const finalMembers = members.body.data as Array<{
      userId: string;
      isActive: boolean;
    }>;
    expect(
      finalMembers.find((member) => member.userId === recruiterUserId)
        ?.isActive,
    ).toBe(false);
  });
});
