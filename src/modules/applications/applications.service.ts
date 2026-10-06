import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApplicationStatus } from '../../generated/enums';
import { Prisma } from '../../generated/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegionsService } from '../regions/regions.service';
import {
  canTransition,
  isCompanySettable,
  isTerminal,
} from './application-status.util';
import { CreateApplicationDto } from './dto/create-application.dto';
import { FindApplicationsQueryDto } from './dto/find-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

type ApplicationDetail = {
  id: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  resumeId: string | null;
  resumeSnapshot: unknown;
  viewedAt: Date | null;
  statusChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  jobPost: {
    id: string;
    title: string;
    slug: string;
    status: string;
    company: { id: string; name: string; slug: string };
  };
  jobSeeker: {
    userId: string;
    firstName: string;
    lastName: string | null;
    headline: string | null;
    phone: string | null;
    expectedSalary: number | null;
    cityId: string | null;
    user: { email: string };
  };
  history: {
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string | null;
    changedById: string | null;
    createdAt: Date;
  }[];
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
  ) {}

  /** Seeker melamar lowongan — sekali per lowongan, dengan snapshot resume. */
  async apply(userId: string, jobId: string, dto: CreateApplicationDto) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });

    if (!profile) {
      throw new BadRequestException(
        'Lengkapi profil pencari kerja terlebih dahulu',
      );
    }

    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!job) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    if (
      job.status !== 'PUBLISHED' ||
      (job.expiresAt && job.expiresAt.getTime() <= Date.now())
    ) {
      throw new BadRequestException('Lowongan tidak lagi menerima lamaran');
    }

    const resume = dto.resumeId
      ? await this.prisma.resume.findFirst({
          where: { id: dto.resumeId, jobSeekerId: profile.id },
        })
      : await this.prisma.resume.findFirst({
          where: { jobSeekerId: profile.id, isPrimary: true },
        });

    if (dto.resumeId && !resume) {
      throw new NotFoundException('Resume tidak ditemukan');
    }

    const snapshot = this.buildSnapshot(job, profile, resume);

    let applicationId: string;
    try {
      applicationId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.jobApplication.create({
          data: {
            jobPostId: job.id,
            jobSeekerId: profile.id,
            resumeId: resume?.id ?? null,
            resumeSnapshot: snapshot,
            coverLetter: dto.coverLetter,
            statusChangedAt: new Date(),
          },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId: created.id,
            toStatus: 'APPLIED',
            changedById: userId,
          },
        });

        await tx.jobPost.update({
          where: { id: job.id },
          data: { applicationCount: { increment: 1 } },
        });

        return created.id;
      });
    } catch (error) {
      // Unique (jobPostId, jobSeekerId): lamaran kedua ditolak.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Anda sudah melamar lowongan ini');
      }
      throw error;
    }

    return this.getByIdForUser(userId, applicationId);
  }

  async findMine(userId: string, query: FindApplicationsQueryDto) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new BadRequestException(
        'Lengkapi profil pencari kerja terlebih dahulu',
      );
    }

    const { page, perPage, skip } = this.pagination(query);
    const where: Prisma.JobApplicationWhereInput = {
      jobSeekerId: profile.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.jobApplication.count({ where }),
      this.prisma.jobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          status: true,
          viewedAt: true,
          statusChangedAt: true,
          createdAt: true,
          updatedAt: true,
          jobPost: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              company: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        viewedAt: row.viewedAt,
        statusChangedAt: row.statusChangedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        job: row.jobPost,
      })),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Detail lamaran untuk seeker pemilik ATAU employer di company yang sama.
   * Employer yang membuka detail akan menandai `viewedAt`.
   */
  async getByIdForUser(userId: string, id: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        jobPost: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            company: { select: { id: true, name: true, slug: true } },
          },
        },
        jobSeeker: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            headline: true,
            phone: true,
            expectedSalary: true,
            cityId: true,
            user: { select: { email: true } },
          },
        },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!application) {
      throw new NotFoundException('Lamaran tidak ditemukan');
    }

    if (application.jobSeeker.userId === userId) {
      return this.toApplicationResponse(application);
    }

    const membership = await this.requireMembership(userId);

    if (application.jobPost.company.id !== membership.companyId) {
      throw new ForbiddenException('Tidak punya akses ke lamaran ini');
    }

    if (!application.viewedAt) {
      application.viewedAt = new Date();
      await this.prisma.jobApplication.update({
        where: { id },
        data: { viewedAt: application.viewedAt },
      });
    }

    return this.toApplicationResponse(application);
  }

  async withdraw(userId: string, id: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: { jobSeeker: { select: { userId: true } } },
    });

    if (!application || application.jobSeeker.userId !== userId) {
      throw new NotFoundException('Lamaran tidak ditemukan');
    }

    if (isTerminal(application.status)) {
      throw new BadRequestException(
        'Lamaran sudah berstatus final dan tidak dapat dibatalkan',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({
        where: { id },
        data: { status: 'WITHDRAWN', statusChangedAt: new Date() },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: 'WITHDRAWN',
          changedById: userId,
        },
      });
    });

    return this.getByIdForUser(userId, id);
  }

  /** Daftar pelamar untuk satu lowongan milik company (employer view). */
  async findByJob(
    userId: string,
    jobId: string,
    query: FindApplicationsQueryDto,
  ) {
    const membership = await this.requireMembership(userId);

    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      select: { id: true, companyId: true },
    });

    if (!job || job.companyId !== membership.companyId) {
      throw new NotFoundException('Lowongan tidak ditemukan');
    }

    const { page, perPage, skip } = this.pagination(query);
    const where: Prisma.JobApplicationWhereInput = {
      jobPostId: jobId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.jobApplication.count({ where }),
      this.prisma.jobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          status: true,
          coverLetter: true,
          viewedAt: true,
          statusChangedAt: true,
          createdAt: true,
          jobSeeker: {
            select: {
              firstName: true,
              lastName: true,
              headline: true,
              phone: true,
              expectedSalary: true,
              cityId: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
    ]);

    const regionMap = await this.regions.findByIds(
      rows.map((row) => row.jobSeeker.cityId),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        coverLetter: row.coverLetter,
        viewedAt: row.viewedAt,
        statusChangedAt: row.statusChangedAt,
        createdAt: row.createdAt,
        applicant: {
          fullName: [row.jobSeeker.firstName, row.jobSeeker.lastName]
            .filter(Boolean)
            .join(' '),
          headline: row.jobSeeker.headline,
          phone: row.jobSeeker.phone,
          email: row.jobSeeker.user.email,
          expectedSalary: row.jobSeeker.expectedSalary,
          location: row.jobSeeker.cityId
            ? (regionMap.get(row.jobSeeker.cityId) ?? null)
            : null,
        },
      })),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /** Employer mengubah status kandidat — selalu menulis history. */
  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const membership = await this.requireMembership(userId);

    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: { jobPost: { select: { companyId: true } } },
    });

    if (
      !application ||
      application.jobPost.companyId !== membership.companyId
    ) {
      throw new NotFoundException('Lamaran tidak ditemukan');
    }

    if (!isCompanySettable(dto.status)) {
      throw new BadRequestException(
        `Status ${dto.status} tidak dapat diubah oleh perusahaan`,
      );
    }

    if (!canTransition(application.status, dto.status)) {
      throw new BadRequestException(
        `Status ${application.status} tidak dapat diubah menjadi ${dto.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({
        where: { id },
        data: { status: dto.status, statusChangedAt: new Date() },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: dto.status,
          changedById: userId,
          note: dto.note,
        },
      });
    });

    return this.getByIdForUser(userId, id);
  }

  private buildSnapshot(
    job: {
      id: string;
      title: string;
      slug: string;
      company: { id: string; name: string };
    },
    profile: {
      id: string;
      firstName: string;
      lastName: string | null;
      headline: string | null;
      summary: string | null;
      phone: string | null;
      expectedSalary: number | null;
      salaryCurrency: string;
      provinceId: string | null;
      cityId: string | null;
      user: { email: string };
    },
    resume: {
      id: string;
      title: string;
      summary: string | null;
    } | null,
  ) {
    return {
      generatedAt: new Date().toISOString(),
      job: {
        id: job.id,
        title: job.title,
        slug: job.slug,
        companyId: job.company.id,
        companyName: job.company.name,
      },
      seeker: {
        profileId: profile.id,
        fullName: [profile.firstName, profile.lastName]
          .filter(Boolean)
          .join(' '),
        headline: profile.headline,
        summary: profile.summary,
        phone: profile.phone,
        email: profile.user.email,
        expectedSalary: profile.expectedSalary,
        salaryCurrency: profile.salaryCurrency,
        provinceId: profile.provinceId,
        cityId: profile.cityId,
      },
      resume: resume
        ? { id: resume.id, title: resume.title, summary: resume.summary }
        : null,
    };
  }

  private toApplicationResponse(application: ApplicationDetail) {
    return {
      id: application.id,
      status: application.status,
      coverLetter: application.coverLetter,
      resumeId: application.resumeId,
      resumeSnapshot: application.resumeSnapshot,
      viewedAt: application.viewedAt,
      statusChangedAt: application.statusChangedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      job: {
        id: application.jobPost.id,
        title: application.jobPost.title,
        slug: application.jobPost.slug,
        status: application.jobPost.status,
        company: application.jobPost.company,
      },
      applicant: {
        fullName: [
          application.jobSeeker.firstName,
          application.jobSeeker.lastName,
        ]
          .filter(Boolean)
          .join(' '),
        firstName: application.jobSeeker.firstName,
        lastName: application.jobSeeker.lastName,
        headline: application.jobSeeker.headline,
        phone: application.jobSeeker.phone,
        email: application.jobSeeker.user.email,
        expectedSalary: application.jobSeeker.expectedSalary,
        cityId: application.jobSeeker.cityId,
      },
      history: application.history.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        changedById: entry.changedById,
        createdAt: entry.createdAt,
      })),
    };
  }

  private pagination(query: FindApplicationsQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);

    return { page, perPage, skip: (page - 1) * perPage };
  }

  private async requireMembership(userId: string) {
    const membership = await this.prisma.employerProfile.findUnique({
      where: { userId },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('Anda belum terdaftar di perusahaan');
    }

    return membership;
  }
}
