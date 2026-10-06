import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client';
import { slugify } from '../../common/utils/slug.util';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegionsService } from '../regions/regions.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindCompanyJobsQueryDto } from './dto/find-company-jobs-query.dto';
import { FindJobsQueryDto } from './dto/find-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import {
  canTransition,
  JOB_ACTION_TARGET,
  JobStatusAction,
} from './job-status.util';

const PUBLISH_DURATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const COMPANY_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  industry: true,
  verification: true,
};

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
  ) {}

  /** Feed publik: hanya lowongan PUBLISHED dan belum kedaluwarsa. */
  async findPublic(query: FindJobsQueryDto) {
    const limit = query.limit ?? 10;
    const now = new Date();

    const where: Prisma.JobPostWhereInput = {
      status: 'PUBLISHED',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.provinceId ? { provinceId: query.provinceId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.workMode ? { workMode: query.workMode } : {}),
      ...(query.experienceLevel
        ? { experienceLevel: query.experienceLevel }
        : {}),
      ...(query.salaryMin ? { salaryMax: { gte: query.salaryMin } } : {}),
    };

    const rows = await this.prisma.jobPost.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        employmentType: true,
        workMode: true,
        experienceLevel: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
        provinceId: true,
        cityId: true,
        publishedAt: true,
        createdAt: true,
        company: { select: COMPANY_CARD_SELECT },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const regionMap = await this.regions.findByIds(
      items.flatMap((item) => [item.provinceId, item.cityId]),
    );

    return {
      items: items.map(({ provinceId, cityId, ...job }) => ({
        ...job,
        location: {
          province: provinceId ? (regionMap.get(provinceId) ?? null) : null,
          city: cityId ? (regionMap.get(cityId) ?? null) : null,
        },
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /** Detail publik + increment viewCount. */
  async findPublicBySlug(slug: string) {
    const job = await this.prisma.jobPost.findUnique({ where: { slug } });

    if (
      !job ||
      job.status !== 'PUBLISHED' ||
      (job.expiresAt && job.expiresAt.getTime() <= Date.now())
    ) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    const updated = await this.prisma.jobPost.update({
      where: { id: job.id },
      data: { viewCount: { increment: 1 } },
      include: {
        company: {
          select: {
            ...COMPANY_CARD_SELECT,
            website: true,
            description: true,
          },
        },
      },
    });

    return this.withLocation(updated);
  }

  async create(companyId: string, dto: CreateJobDto) {
    this.assertSalaryRange(dto.salaryMin, dto.salaryMax);

    const location = await this.regions.resolveLocation(
      dto.provinceId,
      dto.cityId,
    );
    const slug = await this.generateUniqueSlug(dto.title);

    const job = await this.prisma.jobPost.create({
      data: {
        companyId,
        title: dto.title,
        slug,
        description: dto.description,
        requirements: dto.requirements,
        benefits: dto.benefits,
        employmentType: dto.employmentType,
        workMode: dto.workMode ?? 'ONSITE',
        experienceLevel: dto.experienceLevel,
        provinceId: location.provinceId,
        cityId: location.cityId,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency ?? 'IDR',
        salaryPeriod: dto.salaryPeriod ?? 'MONTHLY',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: { company: { select: COMPANY_CARD_SELECT } },
    });

    return this.withLocation(job);
  }

  async findByCompany(companyId: string, query: FindCompanyJobsQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);

    const where: Prisma.JobPostWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.jobPost.count({ where }),
      this.prisma.jobPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
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
          applicationCount: true,
          viewCount: true,
          publishedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const regionMap = await this.regions.findByIds(
      rows.flatMap((job) => [job.provinceId, job.cityId]),
    );

    return {
      items: rows.map(({ provinceId, cityId, ...job }) => ({
        ...job,
        location: {
          province: provinceId ? (regionMap.get(provinceId) ?? null) : null,
          city: cityId ? (regionMap.get(cityId) ?? null) : null,
        },
      })),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findManaged(id: string, companyId: string) {
    const job = await this.requireOwned(id, companyId);
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: COMPANY_CARD_SELECT,
    });

    return { ...(await this.withLocation(job)), company };
  }

  async update(id: string, companyId: string, dto: UpdateJobDto) {
    const job = await this.requireOwned(id, companyId);

    if (job.status === 'ARCHIVED') {
      throw new BadRequestException(
        'Lowongan yang sudah diarsipkan tidak dapat diubah',
      );
    }

    this.assertSalaryRange(
      dto.salaryMin !== undefined ? dto.salaryMin : job.salaryMin,
      dto.salaryMax !== undefined ? dto.salaryMax : job.salaryMax,
    );

    const { provinceId, cityId, expiresAt, ...fields } = dto;
    const data: Prisma.JobPostUncheckedUpdateInput = { ...fields };

    if (provinceId !== undefined || cityId !== undefined) {
      const location = await this.regions.resolveLocation(provinceId, cityId);
      data.provinceId = location.provinceId;
      data.cityId = location.cityId;
    }

    if (expiresAt !== undefined) {
      data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const updated = await this.prisma.jobPost.update({
      where: { id },
      data,
      include: { company: { select: COMPANY_CARD_SELECT } },
    });

    return this.withLocation(updated);
  }

  async transition(id: string, companyId: string, action: JobStatusAction) {
    const job = await this.requireOwned(id, companyId);
    const target = JOB_ACTION_TARGET[action];

    if (!canTransition(job.status, target)) {
      throw new BadRequestException(
        `Status ${job.status} tidak dapat diubah menjadi ${target}`,
      );
    }

    const now = new Date();
    const data: Prisma.JobPostUncheckedUpdateInput = { status: target };

    if (target === 'PUBLISHED') {
      data.publishedAt = job.publishedAt ?? now;
      data.expiresAt =
        job.expiresAt ??
        new Date(now.getTime() + PUBLISH_DURATION_DAYS * DAY_MS);
      data.closedAt = null;
    }

    if (target === 'CLOSED') {
      data.closedAt = now;
    }

    const updated = await this.prisma.jobPost.update({
      where: { id },
      data,
      include: { company: { select: COMPANY_CARD_SELECT } },
    });

    return this.withLocation(updated);
  }

  async remove(id: string, companyId: string) {
    const job = await this.requireOwned(id, companyId);

    if (job.status !== 'DRAFT') {
      throw new BadRequestException(
        'Hanya lowongan berstatus DRAFT yang dapat dihapus',
      );
    }

    await this.prisma.jobPost.delete({ where: { id } });

    return { message: 'Lowongan dihapus' };
  }

  private async requireOwned(id: string, companyId: string) {
    const job = await this.prisma.jobPost.findUnique({ where: { id } });

    if (!job || job.companyId !== companyId) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    return job;
  }

  private assertSalaryRange(min?: number | null, max?: number | null) {
    if (min != null && max != null && max < min) {
      throw new BadRequestException(
        'Gaji maksimum tidak boleh lebih kecil dari gaji minimum',
      );
    }
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'lowongan';
    let slug = base;
    let counter = 1;

    while (
      await this.prisma.jobPost.findUnique({
        where: { slug },
        select: { id: true },
      })
    ) {
      counter += 1;
      slug = `${base}-${counter}`;
    }

    return slug;
  }

  private async withLocation<
    T extends { provinceId: string | null; cityId: string | null },
  >(job: T) {
    const { provinceId, cityId, ...rest } = job;
    const location = await this.regions.describeLocation(provinceId, cityId);

    return { ...rest, location };
  }
}
