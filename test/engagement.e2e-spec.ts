import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { PrismaService } from './../src/infra/prisma/prisma.service';

describe('Engagement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const password = 'E2ePassword123';
  const employer = {
    username: `e2e_eng_emp_${suffix}`,
    email: `e2e_eng_emp_${suffix}@kerjaindong.test`,
  };
  const seeker = {
    username: `e2e_eng_seeker_${suffix}`,
    email: `e2e_eng_seeker_${suffix}@kerjaindong.test`,
  };
  const noProfile = {
    username: `e2e_eng_noprofile_${suffix}`,
    email: `e2e_eng_noprofile_${suffix}@kerjaindong.test`,
  };
  const companyName = `PT Engagement E2E ${suffix}`;

  let employerToken: string;
  let seekerToken: string;
  let noProfileToken: string;
  let companyId: string;
  let jobId: string;
  let draftJobId: string;

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
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.jobPost.deleteMany({ where: { companyId } });
    }
    await prisma.user.deleteMany({
      where: {
        email: { in: [employer.email, seeker.email, noProfile.email] },
      },
    });
    await prisma.company.deleteMany({ where: { name: companyName } });
    await app.close();
  });

  const register = async (user: { username: string; email: string }) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...user, password })
      .expect(201);

    return res.body.data.accessToken as string;
  };

  it('prepares company, published job, draft job, and users', async () => {
    employerToken = await register(employer);
    seekerToken = await register(seeker);
    noProfileToken = await register(noProfile);

    const company = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ name: companyName, firstName: 'Sari' })
      .expect(201);

    companyId = company.body.data.id;

    const published = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: `Frontend Engineer Engage ${suffix}`,
        description: 'React + TypeScript.',
        employmentType: 'FULL_TIME',
      })
      .expect(201);

    jobId = published.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    const draft = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: `Draft Engage ${suffix}`,
        description: 'Belum publish.',
        employmentType: 'CONTRACT',
      })
      .expect(201);

    draftJobId = draft.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/seeker-profile')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ firstName: 'Rina' })
      .expect(201);
  });

  it('rejects engagement without a seeker profile', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/save`)
      .set('Authorization', `Bearer ${noProfileToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/saved-jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(400);
  });

  it('rejects saving unknown, draft, or non-published jobs', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${randomUUID()}/save`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${draftJobId}/save`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(400);
  });

  it('saves a job idempotently and lists it', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/save`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/save`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/saved-jobs')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].id).toBe(jobId);
    expect(res.body.data.items[0].company.name).toBe(companyName);
    expect(res.body.data.meta.total).toBe(1);
  });

  it('unsaves the job', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/jobs/${jobId}/save`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/saved-jobs')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });

  it('follows and unfollows a company', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/follow`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    const followed = await request(app.getHttpServer())
      .get('/api/v1/followed-companies')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(followed.body.data.items).toHaveLength(1);
    expect(followed.body.data.items[0].name).toBe(companyName);
    expect(followed.body.data.items[0].verification).toBe('UNVERIFIED');

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${randomUUID()}/follow`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}/follow`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/followed-companies')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(empty.body.data.items).toHaveLength(0);
  });
});
