# AGENTS.md

Panduan untuk coding agent (dan kontributor) yang bekerja di repo `kerjaindong-api`.

## Ringkasan proyek

Backend job portal dengan dua aktor: **Job Seeker** dan **Company/Employer**.
Stack: NestJS 11, Prisma 6 + PostgreSQL (Supabase), auth mandiri (argon2id + JWT).

- Identity & akses ada di `users` + `user_roles` (multi-role per akun).
- Profil dipisah per role: `job_seeker_profiles`, `companies` + `employer_profiles`.
- Lowongan & lamaran: `job_posts`, `job_applications`, `application_status_history`.
- Wilayah Indonesia: tabel `regions` (kode BPS, provinsi + kab/kota ter-seed).

Detail arsitektur, skema, auth, dan endpoint ada di `docs/`.

## Perintah penting

```
pnpm install        # sekaligus prisma generate (postinstall)
pnpm start:dev      # dev server (port dari .env, default 3000)
pnpm lint           # eslint --fix
pnpm build          # nest build sekaligus typecheck
pnpm test           # unit test (jest)
pnpm test:e2e       # e2e test (butuh koneksi Supabase; membuat & membersihkan data uji)
pnpm seed           # jalankan prisma/seed.ts (preflight -> regions -> users)
pnpm prisma migrate dev --name <nama>   # buat + apply migrasi (interaktif)
pnpm prisma migrate deploy              # apply migrasi (non-interaktif)
```

**Sebelum menyatakan tugas selesai**, jalankan:
`pnpm lint && pnpm build && pnpm test && pnpm test:e2e`

Catatan lingkungan: pengembangan di Windows (bash). `prisma migrate dev` bisa gagal
non-interaktif bila ada warning; alternatifnya lihat `docs/02-database.md`.

## Environment

`.env` **tidak pernah di-commit** (sudah di `.gitignore`). Variabel yang dipakai:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler (port 6543, `pgbouncer=true`) — dipakai aplikasi |
| `DIRECT_URL` | Supabase session pooler (port 5432) — dipakai migrasi |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | secret terpisah untuk access & refresh token |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | default `15m` / `7d` |
| `CORS_ORIGINS` | daftar origin dipisah koma |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | akun SYS_ADMIN saat seed |

## Struktur folder

```
prisma/            schema.prisma, migrations, seed.ts + seeders bertahap
src/generated/     Prisma client hasil generate (JANGAN edit manual, tidak di-commit)
src/infra/         PrismaService, dsb (module global)
src/common/        guards, decorators, filters, interceptors, health, utils, dto
src/modules/       bounded context: auth, users, seeker-profiles, companies,
                   company-access, jobs, resumes, applications, engagement,
                   admin, regions
test/              e2e spec (app, auth, onboarding, jobs, applications,
                   engagement, admin, company-access)
docs/              dokumentasi teknis (payload tiap endpoint di 04)
```

## Konvensi kode yang wajib diikuti

1. **Response wrapper** — JANGAN membungkus response manual. `TransformInterceptor`
   global sudah membungkus menjadi `{ success, data }`; object ber-`message`/`data`
   diteruskan apa adanya. Error ditangani `HttpExceptionFilter`.
2. **Guard berlapis** (urutan global): `ThrottlerGuard` → `AtGuard` → `RolesGuard`.
   Route publik ditandai `@Public()`. Guard per-controller (mis.
   `CompanyAccessGuard`) dipasang eksplisit di controller.
3. **Decorator param**: `@GetCurrentUserId()`, `@GetCurrentUser()`, `@CurrentCompany()`,
   `@Roles(...)`, `@CompanyRoles(...)`. Jangan membaca `request.user` langsung di controller.
4. **DTO ala rjm**: class-validator + class-transformer di `dto/`, update memakai
   `PartialType` dari `@nestjs/mapped-types`. `ValidationPipe` global:
   `transform`, `whitelist`, `forbidNonWhitelisted`.
5. **Prisma**: kolom DB `snake_case` via `@map`/`@@map`; PK `uuid(7)`, `@db.Uuid`;
   waktu `@db.Timestamptz(3)`; uang rupiah `Int`. Relasi destruktif pakai
   `Restrict`/`SetNull` — riwayat tidak boleh hilang.
6. **Service memegang aturan bisnis** (validasi transisi status, penulisan history,
   penambahan role). Controller hanya menerjemahkan HTTP.
7. **Test**: unit `*.spec.ts` di samping file; e2e di `test/*.e2e-spec.ts` dan
   wajib membersihkan data ujinya di `afterAll`.
8. **Jangan tambah dependency baru** tanpa alasan kuat; ikuti versi mayor yang sama
   dengan rjm-nest-api (Nest/Passport v11 CJS, bukan v12 ESM).

## Alur kerja database

1. Ubah `prisma/schema.prisma`.
2. `pnpm prisma migrate dev --name <deskriptif>` (atau diff + `migrate deploy`).
3. `pnpm prisma generate` bila perlu (postinstall biasanya sudah).
4. Seeder idempoten: tambahkan file `prisma/seeders/NN-nama.seeder.ts`, daftarkan
   di `prisma/seed.ts`. Jangan menimpa data user (cek dulu, skip bila ada).
