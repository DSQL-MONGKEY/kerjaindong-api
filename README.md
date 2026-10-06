# Kerjaindong API (Backend)

Backend REST portal lowongan kerja **Kerjaindong** — melayani pencari kerja
(job seeker), perusahaan (employer), dan admin (SYS_ADMIN).

Repo ini adalah bagian backend dari dua repo:

| Repo | Isi |
|---|---|
| **kerjaindong-api** (repo ini) | REST API: NestJS 11 + Prisma 6 + PostgreSQL (Supabase) |
| [kerjaindong-fe](https://github.com/DSQL-MONGKEY/kerjaindong-fe) | Antarmuka web: React 19 + Vite 8 + Tailwind CSS v4 |

## Stack

- NestJS 11 + TypeScript
- Prisma 6 + PostgreSQL (Supabase)
- Auth mandiri: argon2id + JWT access/refresh (session tersimpan di database)
- Validasi class-validator, response envelope, audit log, rate limiting
- Testing: Jest (unit) + Supertest (e2e)

## Prasyarat

- **Git**
- **Node.js 22+** dan **pnpm 10+** (`npm install -g pnpm`)
- **PostgreSQL** — dev memakai Supabase (connection string tersedia di Google Docs)

## Setup

### 1. Clone repo

```bash
git clone https://github.com/DSQL-MONGKEY/kerjaindong-api.git
git clone https://github.com/DSQL-MONGKEY/kerjaindong-fe.git
cd kerjaindong-api
```

### 2. Install dependency

```bash
pnpm install
```

`postinstall` otomatis menjalankan `prisma generate`.

### 3. Environment variables

Buat file `.env` di root repo ini dengan **menyalin variabel environment dari
Google Docs tim** (minta akses ke maintainer). File `.env` tidak di-commit —
jangan pernah push isinya ke GitHub.

Variabel yang dipakai backend:

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NODE_ENV` | Ya | `development` / `production` |
| `PORT` | Tidak | Port API (default `3000`) |
| `DATABASE_URL` | Ya | Koneksi aplikasi lewat pooler Supabase (port `6543`, `pgbouncer=true`) |
| `DIRECT_URL` | Ya | Koneksi langsung untuk migrasi Prisma (port `5432`) |
| `JWT_SECRET` | Ya | Secret access token |
| `JWT_REFRESH_SECRET` | Ya | Secret refresh token |
| `JWT_ACCESS_EXPIRES_IN` | Tidak | Masa berlaku access token (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Tidak | Masa berlaku refresh token (default `7d`) |
| `CORS_ORIGINS` | Tidak | Daftar origin dipisah koma (default `http://localhost:3000,http://localhost:3100`) |
| `SEED_ADMIN_USERNAME` | Tidak | Username akun admin hasil seed (default `superadmin`) |
| `SEED_ADMIN_EMAIL` | Tidak | Email akun admin hasil seed |
| `SEED_ADMIN_PASSWORD` | Ya* | Password akun admin; jika kosong, seed admin dilewati |

Struktur/format lengkapnya bisa dilihat di [`.env.example`](./.env.example).

### 4. Migrasi database

```bash
pnpm prisma migrate deploy
```

### 5. Seed data awal

```bash
pnpm seed
```

Seed bersifat idempoten: extension `pg_trgm`, 38 provinsi + 514 kab/kota, dan
akun `SYS_ADMIN` dari `SEED_ADMIN_*` (password yang sudah diganti tidak
ditimpa).

### 6. Jalankan API

```bash
pnpm start:dev     # http://localhost:3000/api/v1
```

## Verifikasi

1. Health check: `http://localhost:3000/api/v1/health` → `{"status":"ok","timestamp":"..."}`.
2. Login admin hasil seed:

   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"identifier":"superadmin","password":"<SEED_ADMIN_PASSWORD>"}'
   ```

   Respons berisi `accessToken` + data user.
3. Jalankan frontend [kerjaindong-fe](https://github.com/DSQL-MONGKEY/kerjaindong-fe)
   (`pnpm dev` di repo-nya, port `3100`) dan pastikan daftar lowongan tampil.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm start:dev` | Dev server dengan watch mode (port dari `.env`) |
| `pnpm build` | Build produksi ke `dist/` |
| `pnpm start:prod` | Jalankan hasil build (`node dist/main`) |
| `pnpm lint` | ESLint + auto-fix |
| `pnpm test` | Unit test (Jest) |
| `pnpm test:e2e` | E2E test — butuh koneksi Supabase, membuat & membersihkan data uji |
| `pnpm seed` | Seed data awal (idempoten) |
| `pnpm prisma migrate deploy` | Apply migrasi (non-interaktif) |
| `pnpm prisma migrate dev --name <nama>` | Buat + apply migrasi baru (interaktif) |

## Troubleshooting

- **Gagal konek database** — cek `DATABASE_URL` (pooler, port `6543`) dan
  `DIRECT_URL` (port `5432`); migrasi selalu memakai `DIRECT_URL`.
- **`prisma migrate dev` berhenti menunggu konfirmasi** — jalankan di shell
  interaktif atau gunakan `migrate deploy`; detail di
  [`docs/02-database.md`](./docs/02-database.md).
- **Frontend kena CORS** — tambahkan origin frontend ke `CORS_ORIGINS`, lalu
  restart API.
- **Login berhasil tapi ter-logout saat refresh di production** — cookie refresh
  memakai `SameSite=None; Secure`; API dan frontend harus diakses lewat HTTPS
  dan origin frontend terdaftar di `CORS_ORIGINS`.
- **`pnpm test:e2e` gagal** — pastikan `.env` valid dan database uji bisa
  diakses; suite ini membersihkan datanya sendiri.

## Struktur folder

```
src/
├── main.ts              # bootstrap: prefix /api/v1, CORS, cookie, filter
├── modules/             # domain: auth, users, seeker-profiles, companies, jobs,
│                        # applications, engagement, admin, regions, ...
├── common/              # guard, decorator, filter, interceptor, DTO, utils
├── infra/prisma/        # PrismaService
└── generated/           # Prisma Client (hasil generate, jangan diedit manual)
prisma/
├── schema.prisma        # sumber kebenaran skema
├── migrations/          # riwayat migrasi
└── seeders/             # preflight, regions, users
```

## Dokumentasi

- [`docs/01-arsitektur.md`](./docs/01-arsitektur.md) — stack, struktur, request lifecycle
- [`docs/02-database.md`](./docs/02-database.md) — skema, migrasi, seeding
- [`docs/03-auth.md`](./docs/03-auth.md) — auth & session
- [`docs/04-api-endpoints.md`](./docs/04-api-endpoints.md) — daftar endpoint
- [`docs/05-changelog.md`](./docs/05-changelog.md) — riwayat perubahan
- [`docs/06-ddd.md`](./docs/06-ddd.md) — bounded context & domain policy
- [`AGENTS.md`](./AGENTS.md) — panduan kontributor/coding agent
