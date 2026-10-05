import { ensureExtension, log } from './_helpers';
import { ISeeder } from './_types';

export default class PreflightSeeder implements ISeeder {
  name = 'preflight';

  async run(prisma) {
    await ensureExtension(prisma, 'pg_trgm');
    log(this.name, 'completed');
  }
}
