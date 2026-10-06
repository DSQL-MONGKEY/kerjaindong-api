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

describe('Jobs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const password = 'E2ePassword123';
  const employer = {
    username: `e2e_jobs_emp_${suffix}`,
    email: `e2e_jobs_emp_${suffix}@kerjaindong.test`,
  };
  const seeker = {
    username: `e2e_jobs_seeker_${suffix}`,
    email: `e2e_jobs_seeker_${suffix}@kerjaindong.test`,
  };
  const companyName = `PT Jobs E2E ${suffix}`;

  let employerToken: string;
  let seekerToken: string;
  let companyId: string;
  let jobId: string;
  let jobSlug: string;
  let secondJobId: string;
  let cityId: string;
  let cityProvinceId: string;

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

    const regency = await prisma.region.findFirstOrThrow({
      where: { level: 'REGENCY' },
      select: { id: true, parentId: true },
    });
    cityId = regency.id;
    cityProvinceId = regency.parentId ?? '';
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.jobPost.deleteMany({ where: { companyId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [employer.email, seeker.email] } },
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

  const firstJobTitle = `Backend Engineer ${suffix}`;

  const jobPayload = (overrides: Record<string, unknown> = {}) => ({
    title: firstJobTitle,
    description: 'Bangun API untuk job portal.',
    requirements: 'NestJS, PostgreSQL',
    employmentType: 'FULL_TIME',
    workMode: 'REMOTE',
    experienceLevel: 'MID',
    cityId,
    provinceId: cityProvinceId,
    salaryMin: 10000000,
    salaryMax: 20000000,
    ...overrides,
  });

  it('prepares employer, company, and seeker accounts', async () => {
    employerToken = await register(employer);
    seekerToken = await register(seeker);

    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ name: companyName, firstName: 'Sari' })
      .expect(201);

    companyId = res.body.data.id;
    expect(companyId).toEqual(expect.any(String));
  });

  it('forbids a non-member from creating a job', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send(jobPayload())
      .expect(403);
  });

  it('rejects invalid salary range', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send(jobPayload({ salaryMin: 30000000, salaryMax: 10000000 }))
      .expect(400);
  });

  it('creates a DRAFT job', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send(jobPayload())
      .expect(201);

    jobId = res.body.data.id;
    jobSlug = res.body.data.slug;
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.location.city.id).toBe(cityId);
  });

  it('hides DRAFT jobs from the public feed', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/jobs?companyId=${companyId}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });

  it('publishes the job with publishedAt/expiresAt set', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toBeTruthy();
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  it('creates and publishes a second job for pagination', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send(
        jobPayload({
          title: `UI/UX Intern ${suffix}`,
          employmentType: 'INTERNSHIP',
          salaryMin: undefined,
          salaryMax: undefined,
        }),
      )
      .expect(201);

    secondJobId = created.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${secondJobId}/publish`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);
  });

  it('lists published jobs with card fields and filters', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/jobs?cityId=${cityId}&employmentType=FULL_TIME&companyId=${companyId}`,
      )
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    const card = res.body.data.items[0];
    expect(card.title).toContain(suffix);
    expect(card.company.name).toBe(companyName);
    expect(card.company.slug).toEqual(expect.any(String));
    expect(card.location.city.id).toBe(cityId);
    expect(card.salaryMin).toBe(10000000);
    expect(card.employmentType).toBe('FULL_TIME');
    expect(card.workMode).toBe('REMOTE');
  });

  it('returns an empty feed for non-matching filters', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/jobs?employmentType=CONTRACT&companyId=${companyId}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });

  it('paginates the public feed with a cursor', async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/v1/jobs?limit=1&companyId=${companyId}`)
      .expect(200);

    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.nextCursor).toEqual(expect.any(String));

    const second = await request(app.getHttpServer())
      .get(
        `/api/v1/jobs?limit=1&companyId=${companyId}&cursor=${first.body.data.nextCursor}`,
      )
      .expect(200);

    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
  });

  it('increments viewCount on the public detail', async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobSlug}`)
      .expect(200);
    expect(first.body.data.viewCount).toBe(1);
    expect(first.body.data.company.name).toBe(companyName);

    const second = await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobSlug}`)
      .expect(200);
    expect(second.body.data.viewCount).toBe(2);
  });

  it('returns 404 for unknown or non-published slugs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/jobs/tidak-ada-lowongan-ini')
      .expect(404);
  });

  it('keeps slug stable and rejects edits after archive', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ description: 'Deskripsi baru' })
      .expect(200);

    expect(updated.body.data.slug).toBe(jobSlug);
    expect(updated.body.data.description).toBe('Deskripsi baru');

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/archive`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ description: 'Tidak boleh' })
      .expect(400);
  });

  it('removes archived jobs from the feed and forbids delete', async () => {
    const feed = await request(app.getHttpServer())
      .get(
        `/api/v1/jobs?companyId=${companyId}&q=${encodeURIComponent(firstJobTitle)}`,
      )
      .expect(200);

    expect(feed.body.data.items).toHaveLength(0);

    await request(app.getHttpServer())
      .delete(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(400);
  });

  it('deletes a DRAFT job', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send(jobPayload({ title: `Draft yang dihapus ${suffix}` }))
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/jobs/${created.body.data.id}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(res.body.message).toBe('Lowongan dihapus');
  });

  it('lists all company jobs with pagination meta', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/jobs?perPage=10`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    const items = res.body.data.items as Array<{ status: string }>;
    const statuses = items.map((item) => item.status);
    expect(statuses).toContain('ARCHIVED');
    expect(statuses).toContain('PUBLISHED');
  });
});
