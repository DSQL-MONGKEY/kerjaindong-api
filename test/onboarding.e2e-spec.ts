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

describe('Onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now().toString(36);
  const password = 'E2ePassword123';
  const seeker = {
    username: `e2e_seeker_${suffix}`,
    email: `e2e_seeker_${suffix}@kerjaindong.test`,
  };
  const employer = {
    username: `e2e_employer_${suffix}`,
    email: `e2e_employer_${suffix}@kerjaindong.test`,
  };
  const companyName = `PT E2E ${suffix}`;

  let seekerToken: string;
  let employerToken: string;
  let companySlug: string;
  let cityId: string;
  let cityProvinceId: string;
  let otherProvinceId: string;

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

    const province = await prisma.region.findFirstOrThrow({
      where: { level: 'PROVINCE', id: { not: cityProvinceId } },
      select: { id: true },
    });
    otherProvinceId = province.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [seeker.email, employer.email] } },
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

  it('register both roles for the flow', async () => {
    seekerToken = await register(seeker);
    employerToken = await register(employer);
  });

  it('rejects profile creation without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seeker-profile')
      .send({ firstName: 'Budi' })
      .expect(401);
  });

  it('creates a seeker profile with a valid location', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/seeker-profile')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        firstName: 'Budi',
        lastName: 'Santoso',
        headline: 'Backend Engineer',
        cityId,
        provinceId: cityProvinceId,
      })
      .expect(201);

    expect(res.body.data.firstName).toBe('Budi');
    expect(res.body.data.salaryCurrency).toBe('IDR');
    expect(res.body.data.openToWork).toBe(true);
    expect(res.body.data.location.city.id).toBe(cityId);
    expect(res.body.data.location.province.id).toBe(cityProvinceId);
  });

  it('rejects a second seeker profile with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seeker-profile')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ firstName: 'Budi' })
      .expect(409);
  });

  it('updates the seeker profile', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/seeker-profile/me')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ headline: 'Senior Backend Engineer', expectedSalary: 20000000 })
      .expect(200);

    expect(res.body.data.headline).toBe('Senior Backend Engineer');
    expect(res.body.data.expectedSalary).toBe(20000000);
    expect(res.body.data.location.city.id).toBe(cityId);
  });

  it('rejects a city that does not belong to the province', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/seeker-profile/me')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ provinceId: otherProvinceId, cityId })
      .expect(400);
  });

  it('creates a company and assigns the EMPLOYER/OWNER role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        name: companyName,
        industry: 'Technology',
        cityId,
        firstName: 'Sari',
        position: 'Talent Acquisition',
      })
      .expect(201);

    companySlug = res.body.data.slug;
    expect(res.body.data.membership.companyRole).toBe('OWNER');
    expect(res.body.data.location.city.id).toBe(cityId);

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(me.body.data.roles).toContain('EMPLOYER');
    expect(me.body.data.hasEmployerProfile).toBe(true);
  });

  it('returns and updates the current company', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/v1/companies/me')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200);

    expect(mine.body.data.slug).toBe(companySlug);

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/companies/me')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ description: 'Perusahaan uji e2e' })
      .expect(200);

    expect(updated.body.data.description).toBe('Perusahaan uji e2e');
  });

  it('rejects creating a second company for the same user', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ name: `${companyName} 2`, firstName: 'Sari' })
      .expect(409);
  });

  it('forbids a non-member from updating the company', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/companies/me')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ industry: 'Hacking' })
      .expect(403);
  });

  it('exposes the public company profile by slug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companySlug}`)
      .expect(200);

    expect(res.body.data.name).toBe(companyName);
    expect(res.body.data.location.city.id).toBe(cityId);
  });

  it('rejects unauthenticated profile updates', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .send({ fullName: 'Hacker' })
      .expect(401);
  });
});
