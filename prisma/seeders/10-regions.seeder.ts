import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './_helpers';
import { ISeeder } from './_types';

type RegionData = {
  provinces: { code: string; name: string }[];
  regencies: { code: string; provinceCode: string; name: string }[];
};

export default class RegionsSeeder implements ISeeder {
  name = 'regions';

  async run(prisma) {
    const data = JSON.parse(
      readFileSync(join(__dirname, 'data', 'regions.json'), 'utf-8'),
    ) as RegionData;

    const provinceIds = new Map<string, string>();

    for (const province of data.provinces) {
      const row = await prisma.region.upsert({
        where: { code: province.code },
        update: { name: province.name, level: 'PROVINCE', parentId: null },
        create: { code: province.code, name: province.name, level: 'PROVINCE' },
      });
      provinceIds.set(province.code, row.id);
    }
    log(this.name, `${data.provinces.length} provinsi`);

    let done = 0;
    for (const regency of data.regencies) {
      const parentId = provinceIds.get(regency.provinceCode) ?? null;
      await prisma.region.upsert({
        where: { code: regency.code },
        update: { name: regency.name, level: 'REGENCY', parentId },
        create: {
          code: regency.code,
          name: regency.name,
          level: 'REGENCY',
          parentId,
        },
      });
      done += 1;
      if (done % 100 === 0) {
        log(this.name, `${done}/${data.regencies.length} kab/kota`);
      }
    }
    log(this.name, `${done} kab/kota`);
  }
}
