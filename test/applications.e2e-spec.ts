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

describe('Applications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const password = 'E2ePassword123';
  const employer = {
    username: `e2e_app_emp_${suffix}`,
    email: `e2e_app_emp_${suffix}@kerjaindong.test`,
  };
  const seeker = {
    username: `e2e_app_seeker_${suffix}`,
    email: `e2e_app_seeker_${suffix}@kerjaindong.test`,
  };
  const outsider = {
    username: `e2e_app_outsider_${suffix}`,
    email: `e2e_app_outsider_${suffix}@kerjaindong.test`,
  };
  const companyName = `PT Apply E2E ${suffix}`;

  let employerToken: string;
  let seekerToken: string;
  let outsiderToken: string;
  let companyId: string;
  let jobId: string;
  let applicationId: string;
  let resumeId: string;
  let secondResumeId: string;

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
      await prisma.jobApplication.deleteMany({
        where: { jobPost: { companyId } },
      });
      await prisma.jobPost.deleteMany({ where: { companyId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [employer.email, seeker.email, outsider.email] } },
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

  it('prepares employer, company, published job, and users', async () => {
    employerToken = await register(employer);
    seekerToken = await register(seeker);
    outsiderToken = await register(outsider);

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
        title: `Backend Engineer Apply ${suffix}`,
        description: 'Bangun API job portal.',
        employmentType: 'FULL_TIME',
      })
      .expect(201);

    jobId = job.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);
  });

  it('rejects applying before the seeker profile exists', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({})
      .expect(400);
  });

  it('creates the seeker profile and primary resume', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seeker-profile')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ firstName: 'Budi', lastName: 'Santoso' })
      .expect(201);

    const resume = await request(app.getHttpServer())
      .post('/api/v1/resumes')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ title: 'CV Backend', summary: '5 tahun pengalaman' })
      .expect(201);

    resumeId = resume.body.data.id;
    expect(resume.body.data.isPrimary).toBe(true);
  });

  it('applies once and snapshots the primary resume', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ coverLetter: 'Saya tertarik dengan posisi ini.' })
      .expect(201);

    applicationId = res.body.data.id;
    expect(res.body.data.status).toBe('APPLIED');
    expect(res.body.data.resumeId).toBe(resumeId);
    expect(res.body.data.resumeSnapshot.resume.id).toBe(resumeId);
    expect(res.body.data.resumeSnapshot.seeker.fullName).toBe('Budi Santoso');
    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.data.history[0].toStatus).toBe('APPLIED');
  });

  it('rejects a second application to the same job', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({})
      .expect(409);
  });

  it('rejects applying to a draft job or unknown job', async () => {
    const draft = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: `Draft Apply ${suffix}`,
        description: 'Belum publish.',
        employmentType: 'CONTRACT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${draft.body.data.id}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${randomUUID()}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({})
      .expect(404);
  });

  it('lists my applications with status filter', async () => {
    const all = await request(app.getHttpServer())
      .get('/api/v1/applications/me')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(all.body.data.items).toHaveLength(1);
    expect(all.body.data.items[0].job.id).toBe(jobId);
    expect(all.body.data.items[0].job.company.name).toBe(companyName);

    const applied = await request(app.getHttpServer())
      .get('/api/v1/applications/me?status=APPLIED')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);
    expect(applied.body.data.items).toHaveLength(1);

    const accepted = await request(app.getHttpServer())
      .get('/api/v1/applications/me?status=ACCEPTED')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);
    expect(accepted.body.data.items).toHaveLength(0);
  });

  it('lets the employer list applicants and blocks the seeker', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].applicant.email).toBe(seeker.email);
    expect(res.body.data.items[0].applicant.fullName).toBe('Budi Santoso');

    await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(403);
  });

  it('rejects invalid or non-company status updates', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'APPLIED' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(400);
  });

  it('runs the pipeline REVIEWING -> SHORTLISTED with history', async () => {
    const reviewing = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'REVIEWING', note: 'CV sesuai' })
      .expect(200);

    expect(reviewing.body.data.status).toBe('REVIEWING');
    expect(reviewing.body.data.history).toHaveLength(2);

    const shortlisted = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'SHORTLISTED' })
      .expect(200);

    expect(shortlisted.body.data.status).toBe('SHORTLISTED');
    expect(shortlisted.body.data.history).toHaveLength(3);
  });

  it('marks viewedAt when the employer opens the detail', async () => {
    const employerView = await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(employerView.body.data.viewedAt).toBeTruthy();

    const seekerView = await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(seekerView.body.data.viewedAt).toBeTruthy();
  });

  it('blocks outsiders from reading or updating the application', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ status: 'REJECTED' })
      .expect(403);
  });

  it('withdraws, blocks terminal updates, and blocks re-apply', async () => {
    const withdrawn = await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationId}/withdraw`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(withdrawn.body.data.status).toBe('WITHDRAWN');
    expect(withdrawn.body.data.history).toHaveLength(4);

    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'REJECTED' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({})
      .expect(409);
  });

  it('manages multiple resumes and swaps the primary one', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ title: 'CV Backend v2' })
      .expect(200);

    expect(updated.body.data.title).toBe('CV Backend v2');

    const second = await request(app.getHttpServer())
      .post('/api/v1/resumes')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ title: 'CV Fullstack', isPrimary: true })
      .expect(201);

    secondResumeId = second.body.data.id;

    const list = await request(app.getHttpServer())
      .get('/api/v1/resumes')
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    const items = list.body.data as Array<{ id: string; isPrimary: boolean }>;
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.isPrimary)?.id).toBe(secondResumeId);

    const swapped = await request(app.getHttpServer())
      .post(`/api/v1/resumes/${resumeId}/primary`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200);

    expect(swapped.body.data.id).toBe(resumeId);
    expect(swapped.body.data.isPrimary).toBe(true);
  });
});
