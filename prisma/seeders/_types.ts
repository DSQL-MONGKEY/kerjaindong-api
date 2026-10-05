import type { PrismaClient } from '../../src/generated/client';

export interface ISeeder {
  name: string;

  run(prisma: PrismaClient): Promise<void>;
}
