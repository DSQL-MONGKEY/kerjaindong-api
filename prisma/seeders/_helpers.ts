import type { PrismaClient } from '../../src/generated/client';

export const log = (name: string, msg: string) => {
  console.log(`[SEED: ${name}] ${msg}`);
};

export async function ensureExtension(prisma: PrismaClient, extension: string) {
  await prisma.$executeRawUnsafe(
    `CREATE EXTENSION IF NOT EXISTS "${extension}";`,
  );
}
