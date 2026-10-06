import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QueryRegionDto } from './dto/query-region.dto';

export type LocationSummary = {
  id: string;
  code: string;
  name: string;
  level: string;
};

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QueryRegionDto) {
    return this.prisma.region.findMany({
      where: {
        ...(query.level ? { level: query.level } : {}),
        ...(query.parentCode ? { parent: { code: query.parentCode } } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, level: true, parentId: true },
    });
  }

  /**
   * Validasi + normalisasi pasangan provinsi/kota:
   * - cityId harus region level REGENCY; provinceId otomatis diambil dari parent.
   * - provinceId harus region level PROVINCE.
   * - Jika keduanya diisi, city harus benar-benar anak dari province.
   */
  async resolveLocation(
    provinceId?: string | null,
    cityId?: string | null,
  ): Promise<{ provinceId: string | null; cityId: string | null }> {
    if (cityId) {
      const city = await this.prisma.region.findUnique({
        where: { id: cityId },
        select: { id: true, parentId: true, level: true },
      });

      if (!city || city.level !== 'REGENCY') {
        throw new BadRequestException('Kota/kabupaten tidak valid');
      }

      if (provinceId && provinceId !== city.parentId) {
        throw new BadRequestException(
          'Kota/kabupaten tidak termasuk provinsi yang dipilih',
        );
      }

      return { provinceId: city.parentId, cityId: city.id };
    }

    if (provinceId) {
      const province = await this.prisma.region.findUnique({
        where: { id: provinceId },
        select: { id: true, level: true },
      });

      if (!province || province.level !== 'PROVINCE') {
        throw new BadRequestException('Provinsi tidak valid');
      }

      return { provinceId: province.id, cityId: null };
    }

    return { provinceId: null, cityId: null };
  }

  /** Ambil nama provinsi/kota untuk kebutuhan response (tanpa relasi Prisma). */
  async describeLocation(
    provinceId?: string | null,
    cityId?: string | null,
  ): Promise<{
    province: LocationSummary | null;
    city: LocationSummary | null;
  }> {
    const byId = await this.findByIds([provinceId, cityId]);

    return {
      province: provinceId ? (byId.get(provinceId) ?? null) : null,
      city: cityId ? (byId.get(cityId) ?? null) : null,
    };
  }

  /** Batch lookup region untuk menghindari N+1 pada listing. */
  async findByIds(
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, LocationSummary>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];

    if (unique.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.region.findMany({
      where: { id: { in: unique } },
      select: { id: true, code: true, name: true, level: true },
    });

    return new Map(rows.map((row) => [row.id, row]));
  }
}
