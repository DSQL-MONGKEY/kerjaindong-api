import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/client';
import { slugify } from '../../common/utils/slug.util';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegionsService } from '../regions/regions.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
  ) {}

  async create(userId: string, dto: CreateCompanyDto) {
    const existing = await this.prisma.employerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Anda sudah terdaftar di sebuah perusahaan');
    }

    const location = await this.regions.resolveLocation(
      dto.provinceId,
      dto.cityId,
    );
    const slug = await this.generateUniqueSlug(dto.name);

    await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          slug,
          website: dto.website,
          industry: dto.industry,
          description: dto.description,
          provinceId: location.provinceId,
          cityId: location.cityId,
        },
      });

      await tx.employerProfile.create({
        data: {
          userId,
          companyId: company.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          position: dto.position,
          companyRole: 'OWNER',
        },
      });

      // Registrasi mengizinkan role apa pun; membuat company memastikan role
      // EMPLOYER dimiliki (multi-role per akun).
      await tx.userRoleAssignment.upsert({
        where: { userId_role: { userId, role: 'EMPLOYER' } },
        update: {},
        create: { userId, role: 'EMPLOYER' },
      });
    });

    return this.getMine(userId);
  }

  async getMine(userId: string) {
    const membership = await this.prisma.employerProfile.findUnique({
      where: { userId },
      include: { company: true },
    });

    if (!membership) {
      throw new NotFoundException('Anda belum terdaftar di perusahaan');
    }

    const location = await this.regions.describeLocation(
      membership.company.provinceId,
      membership.company.cityId,
    );
    const { provinceId, cityId, ...company } = membership.company;

    return {
      ...company,
      location: { provinceId, cityId, ...location },
      membership: {
        id: membership.id,
        companyRole: membership.companyRole,
        firstName: membership.firstName,
        lastName: membership.lastName,
        position: membership.position,
        isActive: membership.isActive,
      },
    };
  }

  async updateMine(userId: string, dto: UpdateCompanyDto) {
    const membership = await this.prisma.employerProfile.findUnique({
      where: { userId },
      select: { companyId: true },
    });

    if (!membership) {
      throw new NotFoundException('Anda belum terdaftar di perusahaan');
    }

    const { provinceId, cityId, ...fields } = dto;
    // Slug sengaja TIDAK ikut berubah saat nama diganti agar URL publik stabil.
    const data: Prisma.CompanyUncheckedUpdateInput = { ...fields };

    if (provinceId !== undefined || cityId !== undefined) {
      const location = await this.regions.resolveLocation(provinceId, cityId);
      data.provinceId = location.provinceId;
      data.cityId = location.cityId;
    }

    await this.prisma.company.update({
      where: { id: membership.companyId },
      data,
    });

    return this.getMine(userId);
  }

  async getPublicBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
        industry: true,
        description: true,
        provinceId: true,
        cityId: true,
        verification: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Perusahaan tidak ditemukan');
    }

    const location = await this.regions.describeLocation(
      company.provinceId,
      company.cityId,
    );
    const { provinceId, cityId, ...rest } = company;

    return { ...rest, location: { provinceId, cityId, ...location } };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'company';
    let slug = base;
    let counter = 1;

    while (
      await this.prisma.company.findUnique({
        where: { slug },
        select: { id: true },
      })
    ) {
      counter += 1;
      slug = `${base}-${counter}`;
    }

    return slug;
  }
}
