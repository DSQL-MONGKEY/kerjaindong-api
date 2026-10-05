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

describe('Admin backoffice (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const password = 'E2ePassword123';
  const employer = {
    username: `e2e_admin_emp_${suffix}`,
    email: `e2e_admin_emp_${suffix}@kerjaindong.test`,
  };
  const companyName = `PT Admin E2E ${suffix}`;

  let adminToken: string;
  let adminId: string;
  let employerToken: string;
  let employerId: string;
  let companyId: string;
  let jobId: string;

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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: process.env.SEED_ADMIN_USERNAME ?? 'superadmin',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'SuperAdmin123',
      })
      .expect(200);

    adminToken = login.body.data.accessToken;
    adminId = login.body.data.user.id;

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...employer, password })
      .expect(201);

    employerToken = registered.body.data.accessToken;
    employerId = registered.body.data.user.id;

    const company = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ name: companyName, firstName: 'Sari' })
      .expect(201);

    companyId = company.body.data.id;

    const job = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: `Moderasi Job ${suffix}`,
        description: 'Untuk diuji moderasi admin.',
        employmentType: 'FULL_TIME',
      })
      .expect(201);

    jobId = job.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [companyId, jobId, employerId] } },
    });
    if (companyId) {
      await prisma.jobPost.deleteMany({ where: { companyId } });
    }
    await prisma.user.deleteMany({ where: { email: employer.email } });
    await prisma.company.deleteMany({ where: { name: companyName } });
    await app.close();
  });

  it('blocks non-admin users from the backoffice', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/companies')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(403);
  });

  it('lists companies and verifies one with an audit trail', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/admin/companies?q=${encodeURIComponent(companyName)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].id).toBe(companyId);

    const verified = await request(app.getHttpServer())
      .patch(`/api/v1/admin/companies/${companyId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED', note: 'Dokumen lengkap' })
      .expect(200);

    expect(verified.body.data.verification).toBe('VERIFIED');
    expect(verified.body.data.verifiedAt).toBeTruthy();

    const logs = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?entityType=company&entityId=${companyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(logs.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(logs.body.data.items[0].action).toBe('company.verification.update');
    expect(logs.body.data.items[0].actor.username).toBe(
      process.env.SEED_ADMIN_USERNAME ?? 'superadmin',
    );
  });

  it('suspends and reactivates a user', async () => {
    const users = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?q=${employer.username}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(users.body.data.items[0].id).toBe(employerId);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${employerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false, note: 'Pelanggaran ringan' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${employerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);
  });

  it('prevents an admin from deactivating their own account', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(400);
  });

  it('moderates a job: pause removes it from the feed, publish restores it', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PAUSED', note: 'Menunggu klarifikasi' })
      .expect(200);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/jobs?companyId=${companyId}`)
      .expect(200);
    expect(hidden.body.data.items).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const restored = await request(app.getHttpServer())
      .get(`/api/v1/jobs?companyId=${companyId}`)
      .expect(200);
    expect(restored.body.data.items).toHaveLength(1);
  });

  it('exposes the audit log trail with pagination meta', async () => {
    const logs = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?perPage=50')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(logs.body.data.meta.total).toBeGreaterThanOrEqual(4);
    const actions = (logs.body.data.items as Array<{ action: string }>).map(
      (item) => item.action,
    );
    expect(actions).toContain('user.status.update');
    expect(actions).toContain('job.status.update');
  });
});
