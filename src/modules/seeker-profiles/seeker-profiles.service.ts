import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegionsService } from '../regions/regions.service';
import { CreateSeekerProfileDto } from './dto/create-seeker-profile.dto';
import { UpdateSeekerProfileDto } from './dto/update-seeker-profile.dto';

@Injectable()
export class SeekerProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
  ) {}

  async create(userId: string, dto: CreateSeekerProfileDto) {
    const existing = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Profil pencari kerja sudah ada');
    }

    const location = await this.regions.resolveLocation(
      dto.provinceId,
      dto.cityId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.jobSeekerProfile.create({
        data: {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          headline: dto.headline,
          summary: dto.summary,
          phone: dto.phone,
          provinceId: location.provinceId,
          cityId: location.cityId,
          expectedSalary: dto.expectedSalary,
          salaryCurrency: dto.salaryCurrency ?? 'IDR',
          openToWork: dto.openToWork ?? true,
        },
      });

      // Registrasi mengizinkan role apa pun; pembuatan profil seeker
      // memastikan role JOB_SEEKER dimiliki (multi-role per akun).
      await tx.userRoleAssignment.upsert({
        where: { userId_role: { userId, role: 'JOB_SEEKER' } },
        update: {},
        create: { userId, role: 'JOB_SEEKER' },
      });
    });

    return this.getMine(userId);
  }

  async getMine(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profil pencari kerja belum dibuat');
    }

    const location = await this.regions.describeLocation(
      profile.provinceId,
      profile.cityId,
    );
    const { provinceId, cityId, ...rest } = profile;

    return {
      ...rest,
      location: { provinceId, cityId, ...location },
    };
  }

  async updateMine(userId: string, dto: UpdateSeekerProfileDto) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Profil pencari kerja belum dibuat');
    }

    const { provinceId, cityId, ...fields } = dto;
    // Prisma mengabaikan field `undefined`, jadi hanya field yang dikirim
    // client yang berubah.
    const data: Prisma.JobSeekerProfileUncheckedUpdateInput = { ...fields };

    if (provinceId !== undefined || cityId !== undefined) {
      const location = await this.regions.resolveLocation(provinceId, cityId);
      data.provinceId = location.provinceId;
      data.cityId = location.cityId;
    }

    await this.prisma.jobSeekerProfile.update({ where: { userId }, data });

    return this.getMine(userId);
  }
}
