import { PrismaClient } from '../src/generated/client';
import { ISeeder } from './seeders/_types';
import PreflightSeeder from './seeders/01-preflight.seeder';
import RegionsSeeder from './seeders/10-regions.seeder';
import UsersSeeder from './seeders/20-users.seeder';

const prisma = new PrismaClient();

async function runSeeder(seeder: ISeeder) {
  const label = seeder.name;
  const start = Date.now();
  console.log(`\n> ${label}`);
  await seeder.run(prisma);
  console.log(`OK ${label} (${Date.now() - start}ms)`);
}

async function main() {
  const seeders: ISeeder[] = [
    new PreflightSeeder(),
    new RegionsSeeder(),
    new UsersSeeder(),
  ];

  for (const s of seeders) {
    await runSeeder(s);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\nSeeding completed successfully.');
  })
  .catch(async (e) => {
    console.error('\nSeed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
