import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    // optional: custom folder migrations
    path: path.join('prisma', 'migrations'),
    // jalankan seed setelah migrate atau via `prisma db seed`
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
});
