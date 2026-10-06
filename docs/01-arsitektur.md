# 01 — Arsitektur

## Stack

| Lapisan | Teknologi |
|---|---|
| Runtime | Node.js 22, TypeScript 5.7 |
| Framework | NestJS 11 (CommonJS) |
| ORM | Prisma 6.16 (generator `prisma-client`, output `src/generated`) |
| Database | PostgreSQL (Supabase), transaction pooler untuk aplikasi + session pooler untuk migrasi |
| Auth | argon2id + JWT (access 15 menit) + refresh token 7 hari (cookie httpOnly) |
| Validasi | class-validator + class-transformer (DTO) |
| Proteksi | helmet, CORS allow-list, rate limit `@nestjs/throttler` |

## Struktur folder

```
prisma/
  schema.prisma                 sumber kebenaran skema
  migrations/                   riwayat migrasi
  seed.ts                       orchestrator seeder
  seeders/
    01-preflight.seeder.ts      extension pg_trgm
    10-regions.seeder.ts        provinsi + kab/kota (kode BPS)
    20-users.seeder.ts          akun SYS_ADMIN
  seeders/data/regions.json     dataset wilayah (38 provinsi, 514 kab/kota)

src/
  infra/prisma/                 PrismaService + PrismaModule (@Global)
  common/
    decorators/                 @Public, @Roles, @CompanyRoles, @CurrentCompany,
                                @GetCurrentUser, @GetCurrentUserId
    guards/                     AtGuard, RtGuard, RolesGuard, CompanyAccessGuard
    filters/                    HttpExceptionFilter
    interceptors/               TransformInterceptor (response wrapper)
    health/                     HealthController (/api/v1/health)
    utils/                      slugify
  modules/
    auth/                       register/login/refresh/logout + strategies + sessions
    users/                      GET/PATCH /users/me
    seeker-profiles/            profil job seeker (onboarding)
    companies/                  company + employer profile (onboarding)
    company-access/             keanggotaan company, role internal & undangan
    jobs/                       job posting employer + feed & detail publik
    resumes/                    resume seeker (minimal, tanpa upload)
    applications/               lamaran, pipeline status, history, snapshot
    engagement/                 saved job & follow company
    admin/                      backoffice SYS_ADMIN + audit log
    regions/                    referensi wilayah + validasi lokasi

test/
  app.e2e-spec.ts               smoke: health + regions
  auth.e2e-spec.ts              alur auth penuh
  onboarding.e2e-spec.ts        alur onboarding seeker + company
  jobs.e2e-spec.ts              posting, feed, filter, pagination, status
  applications.e2e-spec.ts      lamaran, pipeline, history, resume
  engagement.e2e-spec.ts        saved job & follow company
  admin.e2e-spec.ts             verifikasi, status user, moderasi, audit
  company-access.e2e-spec.ts    undangan, accept, role, soft remove
```

Prinsip: `src/generated/` adalah artefak Prisma — **jangan diedit manual** dan
tidak di-commit. Segala aturan bisnis berada di service; controller hanya
menerjemahkan HTTP.

## Penerapan DDD

Pendekatan yang dipakai adalah **strategic DDD penuh + tactical DDD sebagian**
(DDD-lite), bukan DDD penuh dengan entity kaya/repository/domain event:

- **Bounded context** = satu modul Nest + satu section di `schema.prisma`
  (IAM, Seeker, Company & Employer, Job & Application, Engagement & Admin,
  Regions sebagai reference).
- **Aggregate invariant** dijaga transaksi DB: apply sekali + history
  (`applications.service.ts`), satu resume primary (`resumes.service.ts`),
  company selalu ber-OWNER (`companies.service.ts`), undangan sekali pakai
  (`company-access.service.ts`), audit atomik (`admin.service.ts`).
- **Domain policy murni** diekstrak: `jobs/job-status.util.ts`,
  `applications/application-status.util.ts`, `common/utils/slug.util.ts`,
  `RegionsService.resolveLocation()`.
- **Anti-corruption/published language**: `resumeSnapshot` membekukan data
  lintas context saat melamar.
- **Shared kernel**: `RegionsModule` mengekspor `RegionsService`; tidak ada
  dependency antar-modul lain secara langsung.

Yang sengaja tidak dipakai (beserta alasannya) dirinci di
[06-ddd.md](./06-ddd.md).

## Peta module ↔ route

Module adalah **batas kapabilitas domain**, bukan pengelompokan URL. Satu
prefix bisa dilayani beberapa module, dan satu module bisa melayani beberapa
prefix:

| Module | Prefix/route yang dilayani | Catatan |
|---|---|---|
| `auth` | `/auth/*` | register/login/refresh/logout |
| `users` | `/users/me` | identitas pengguna |
| `seeker-profiles` | `/seeker-profile/me` | onboarding seeker |
| `resumes` | `/resumes/*` | resume seeker |
| `companies` | `/companies`, `/companies/me`, `/companies/:slug` | profil perusahaan |
| `company-access` | `/companies/:companyId/members`, `/companies/:companyId/invitations`, `/invitations/*` | keanggotaan & undangan; sebagian route **tidak** ber-prefix `/companies` |
| `jobs` | `/jobs`, `/companies/:companyId/jobs` | lowongan (employer + publik) |
| `applications` | `/applications/*`, `/jobs/:jobId/applications` | lamaran & pipeline |
| `engagement` | `/jobs/:jobId/save`, `/saved-jobs`, `/companies/:companyId/follow`, `/followed-companies` | bookmark & follow |
| `admin` | `/admin/*` | moderasi (menyentuh company/job/user lewat kapabilitas admin) |
| `regions` | `/regions` | referensi wilayah |
| `common/health` | `/health` | kesehatan aplikasi |

Implikasi praktis: memindahkan route tanpa mengubah module (atau sebaliknya)
adalah perubahan yang murah; yang perlu dijaga adalah arah dependensi antar
module (saat ini hanya `RegionsModule` yang diekspor lintas module).

## Request lifecycle

1. `helmet()` + `cookieParser()` + CORS + `ValidationPipe`
   (`transform`, `whitelist`, `forbidNonWhitelisted`).
2. Guard global berurutan (didaftarkan via `APP_GUARD` di `app.module.ts`):
   - `ThrottlerGuard` — limit default 100 req/menit per IP; endpoint auth lebih ketat.
   - `AtGuard` — validasi bearer access token lewat `AtStrategy`; melewati route
     `@Public()`. Hasil validasi selalu mengecek ulang user + role dari database.
   - `RolesGuard` — cek `@Roles(...)` berdasarkan role di `request.user`.
3. Guard per-controller: `CompanyAccessGuard` + `@CompanyRoles(...)` untuk
   endpoint yang butuh keanggotaan company.
4. Handler memanggil service.
5. `TransformInterceptor` membungkus payload menjadi `{ success: true, data }`
   (object yang sudah punya `data`/`message` diteruskan apa adanya).
6. `HttpExceptionFilter` menormalkan error menjadi
   `{ statusCode, timestamp, path, message }`.

## Konvensi response

```jsonc
// sukses (otomatis dibungkus interceptor)
{ "success": true, "data": { "id": "...", "...": "..." } }

// sukses dengan pesan (diteruskan apa adanya)
{ "message": "Logout berhasil" }

// error
{ "statusCode": 404, "timestamp": "...", "path": "/api/v1/...", "message": "..." }
```

## Konfigurasi runtime

- Global prefix `api`, versioning URI → semua route di `/api/v1/...`.
- Port dari `PORT` (default 3000).
- `trust proxy` aktif agar IP asli terbaca di belakang reverse proxy.
- CORS dari `CORS_ORIGINS` (dipisah koma), `credentials: true` (cookie refresh).
