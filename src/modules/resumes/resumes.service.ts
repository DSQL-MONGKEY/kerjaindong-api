import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';

@Injectable()
export class ResumesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateResumeDto) {
    const profile = await this.requireProfile(userId);
    const existingCount = await this.prisma.resume.count({
      where: { jobSeekerId: profile.id },
    });
    const makePrimary = dto.isPrimary ?? existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.resume.updateMany({
          where: { jobSeekerId: profile.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.resume.create({
        data: {
          jobSeekerId: profile.id,
          title: dto.title,
          summary: dto.summary,
          isPrimary: makePrimary,
        },
      });
    });
  }

  async findMine(userId: string) {
    const profile = await this.requireProfile(userId);

    return this.prisma.resume.findMany({
      where: { jobSeekerId: profile.id },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getMine(userId: string, id: string) {
    const profile = await this.requireProfile(userId);
    const resume = await this.prisma.resume.findFirst({
      where: { id, jobSeekerId: profile.id },
    });

    if (!resume) {
      throw new NotFoundException('Resume tidak ditemukan');
    }

    return resume;
  }

  async updateMine(userId: string, id: string, dto: UpdateResumeDto) {
    const resume = await this.getMine(userId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.resume.updateMany({
          where: {
            jobSeekerId: resume.jobSeekerId,
            isPrimary: true,
            id: { not: id },
          },
          data: { isPrimary: false },
        });
      }

      return tx.resume.update({
        where: { id },
        data: {
          title: dto.title,
          summary: dto.summary,
          isPrimary: dto.isPrimary,
        },
      });
    });
  }

  async removeMine(userId: string, id: string) {
    await this.getMine(userId, id);
    await this.prisma.resume.delete({ where: { id } });

    return { message: 'Resume dihapus' };
  }

  async setPrimary(userId: string, id: string) {
    const resume = await this.getMine(userId, id);

    await this.prisma.$transaction([
      this.prisma.resume.updateMany({
        where: {
          jobSeekerId: resume.jobSeekerId,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      }),
      this.prisma.resume.update({
        where: { id },
        data: { isPrimary: true },
      }),
    ]);

    return this.getMine(userId, id);
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
