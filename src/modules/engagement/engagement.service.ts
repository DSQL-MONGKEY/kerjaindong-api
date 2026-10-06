import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RegionsService } from '../regions/regions.service';

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
  ) {}

  async saveJob(userId: string, jobId: string) {
    const profile = await this.requireProfile(userId);

    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, expiresAt: true },
    });

    if (!job) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    if (
      job.status !== 'PUBLISHED' ||
      (job.expiresAt && job.expiresAt.getTime() <= Date.now())
    ) {
      throw new BadRequestException('Lowongan tidak tersedia untuk disimpan');
    }

    await this.prisma.savedJob.upsert({
      where: {
        jobSeekerId_jobPostId: { jobSeekerId: profile.id, jobPostId: job.id },
      },
      update: {},
      create: { jobSeekerId: profile.id, jobPostId: job.id },
    });

    return { message: 'Lowongan disimpan' };
  }

  async unsaveJob(userId: string, jobId: string) {
    const profile = await this.requireProfile(userId);

    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!job) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    await this.prisma.savedJob.deleteMany({
      where: { jobSeekerId: profile.id, jobPostId: job.id },
    });

    return { message: 'Lowongan dihapus dari simpanan' };
  }

  async findSavedJobs(userId: string, query: PaginationQueryDto) {
    const profile = await this.requireProfile(userId);
    const { page, perPage, skip } = this.pagination(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.savedJob.count({ where: { jobSeekerId: profile.id } }),
      this.prisma.savedJob.findMany({
        where: { jobSeekerId: profile.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          createdAt: true,
          jobPost: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              employmentType: true,
              workMode: true,
              experienceLevel: true,
              provinceId: true,
              cityId: true,
              salaryMin: true,
              salaryMax: true,
              salaryCurrency: true,
              salaryPeriod: true,
              publishedAt: true,
              company: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
    ]);

    const regionMap = await this.regions.findByIds(
      rows.flatMap((row) => [row.jobPost.provinceId, row.jobPost.cityId]),
    );

    return {
      items: rows.map(({ createdAt, jobPost }) => {
        const { provinceId, cityId, ...job } = jobPost;
        return {
          savedAt: createdAt,
          ...job,
          location: {
            province: provinceId ? (regionMap.get(provinceId) ?? null) : null,
            city: cityId ? (regionMap.get(cityId) ?? null) : null,
          },
        };
      }),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async followCompany(userId: string, companyId: string) {
    const profile = await this.requireProfile(userId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Perusahaan tidak ditemukan');
    }

    await this.prisma.companyFollow.upsert({
      where: {
        jobSeekerId_companyId: {
          jobSeekerId: profile.id,
          companyId: company.id,
        },
      },
      update: {},
      create: { jobSeekerId: profile.id, companyId: company.id },
    });

    return { message: 'Mengikuti perusahaan' };
  }

  async unfollowCompany(userId: string, companyId: string) {
    const profile = await this.requireProfile(userId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Perusahaan tidak ditemukan');
    }

    await this.prisma.companyFollow.deleteMany({
      where: { jobSeekerId: profile.id, companyId: company.id },
    });

    return { message: 'Berhenti mengikuti perusahaan' };
  }

  async findFollowedCompanies(userId: string, query: PaginationQueryDto) {
    const profile = await this.requireProfile(userId);
    const { page, perPage, skip } = this.pagination(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.companyFollow.count({ where: { jobSeekerId: profile.id } }),
      this.prisma.companyFollow.findMany({
        where: { jobSeekerId: profile.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          createdAt: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              industry: true,
              verification: true,
              provinceId: true,
              cityId: true,
            },
          },
        },
      }),
    ]);

    const regionMap = await this.regions.findByIds(
      rows.flatMap((row) => [row.company.provinceId, row.company.cityId]),
    );

    return {
      items: rows.map(({ createdAt, company }) => {
        const { provinceId, cityId, ...rest } = company;
        return {
          followedAt: createdAt,
          ...rest,
          location: {
            province: provinceId ? (regionMap.get(provinceId) ?? null) : null,
            city: cityId ? (regionMap.get(cityId) ?? null) : null,
          },
        };
      }),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  private pagination(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);

    return { page, perPage, skip: (page - 1) * perPage };
  }

  private async requireProfile(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new BadRequestException(
        'Lengkapi profil pencari kerja terlebih dahulu',
      );
    }

    return profile;
  }
}
