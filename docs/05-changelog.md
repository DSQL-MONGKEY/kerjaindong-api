# 05 — Changelog

## 2026-10-05 — Dokumentasi: pemetaan DDD & status implementasi

- Tambah [`06-ddd.md`](./06-ddd.md): bounded context ↔ modul + section schema,
  klasifikasi subdomain, ubiquitous language, context map, tabel aggregate
  invariant + lokasi kode, domain policy/value object/domain service, daftar
  konsep DDD yang sengaja tidak dipakai, dan roadmap opsional.
- `README.md`: indeks dokumen + tabel **status implementasi** per fase
  (0, 1, 2, 3, 4, 5, 1b — semua selesai) dan daftar item yang ditunda.
- `01-arsitektur.md`: ringkasan penerapan DDD + tautan ke `06-ddd.md`;
  deskripsi `04-api-endpoints.md` disesuaikan (kini memuat payload tiap endpoint).
- Tidak ada perubahan kode/perilaku pada pembaruan dokumentasi ini.

## 2026-10-05 — Fase 4: Engagement (saved job & follow company)

**Fitur**
- `POST/DELETE /jobs/:jobId/save` (idempotent) + `GET /saved-jobs`
  (pagination + kartu lowongan + lokasi).
- `POST/DELETE /companies/:companyId/follow` + `GET /followed-companies`.
- Butuh profil seeker (`400` bila belum ada); save hanya untuk lowongan
  `PUBLISHED` yang belum kedaluwarsa.
- `PaginationQueryDto` bersama di `src/common/dto`.

**Test**: `test/engagement.e2e-spec.ts` (6).

## 2026-10-05 — Fase 5: Admin backoffice

**Fitur**
- `GET /admin/companies` + `PATCH /admin/companies/:id/verification`.
- `GET /admin/users` + `PATCH /admin/users/:id/status` (menonaktifkan akun
  mencabut semua session; tidak bisa menonaktifkan diri sendiri atau
  SYS_ADMIN aktif terakhir).
- `GET /admin/jobs` + `PATCH /admin/jobs/:id/status` (moderasi
  `PUBLISHED/PAUSED/ARCHIVED`).
- `GET /admin/audit-logs` + `AuditLogService` yang menulis audit **di dalam
  transaksi** perubahan (`company.verification.update`, `user.status.update`,
  `job.status.update`).
- Semua endpoint dijaga `@Roles('SYS_ADMIN')`.

**Test**: `test/admin.e2e-spec.ts` (6).

## 2026-10-05 — Fase 1b: Member & undangan company

**Fitur**
- `GET /companies/:companyId/members` (semua anggota, termasuk nonaktif) +
  `DELETE .../members/:userId` (soft remove + cabut session; OWNER/diri sendiri
  tidak bisa dihapus).
- `POST/GET /companies/:companyId/invitations` (`OWNER`/`ADMIN`); token undangan
  acak 32 byte, disimpan sebagai hash SHA-256, berlaku 7 hari, dan undangan
  pending lama untuk email yang sama diganti.
- `GET /invitations/:token` (Public, preview) + `POST /invitations/accept`
  (email user harus sama; bisa mengaktifkan kembali member yang pernah
  dinonaktifkan; role `EMPLOYER` ditambahkan otomatis).
- Token mentah hanya dikembalikan sekali di response pembuatan undangan
  (produksi: kirim via email).

**Test**: `test/company-members.e2e-spec.ts` (7).

## 2026-10-05 — Dokumentasi endpoint + payload

- `docs/04-api-endpoints.md` ditulis ulang: format body/query untuk **setiap**
  endpoint, aturan validasi, efek samping, dan format response.
- Total saat ini: unit **22**, e2e **69** (8 suite, dijalankan serial).

## 2026-10-05 — Fase 3: Apply flow, pipeline lamaran & resume

**Fitur**
- Resume minimal (tanpa upload): `POST/GET/PATCH/DELETE /resumes`,
  `POST /resumes/:id/primary`; resume pertama otomatis primary, hanya satu
  primary per seeker (dijaga transaksi).
- Lamaran: `POST /jobs/:jobId/applications` — sekali per lowongan (unique DB +
  409), memilih resume (`resumeId` atau primary otomatis), menulis
  `resumeSnapshot` (job + profil + resume saat melamar), history `null → APPLIED`,
  dan increment `applicationCount` dalam satu transaksi.
- Seeker: `GET /applications/me` (filter status + pagination), `GET /applications/:id`,
  `POST /applications/:id/withdraw`.
- Employer: `GET /jobs/:jobId/applications` (data pelamar + lokasi),
  `PATCH /applications/:id/status` dengan validasi transisi dan penulisan
  `application_status_history`; membuka detail menandai `viewedAt`.
- `application-status.util.ts`: matriks transisi (`APPLIED → REVIEWING →
  SHORTLISTED → ACCEPTED/REJECTED`, `WITHDRAWN` sebelum final; `ACCEPTED`/
  `REJECTED`/`WITHDRAWN` terminal) + status yang boleh diset perusahaan.

**Keputusan**
- `applicationCount` tidak dikurangi saat withdraw/reject (menghitung total
  lamaran yang pernah masuk).
- Snapshot bersifat historis; recruiter melihat kondisi saat melamar walau
  profil/resume diubah kemudian.
- E2E dijalankan serial (`--runInBand`) agar lima suite tidak saling
  mengganggu data/rate limit saat berjalan paralel ke satu Supabase.

**Test**: `application-status.util.spec.ts` (5), `test/applications.e2e-spec.ts` (16).
Total saat ini: unit 22, e2e 49.

## 2026-10-05 — Fase 2: Job posting & feed publik

**Fitur**
- Feed publik `GET /jobs`: filter `q` (judul), `cityId`, `provinceId`, `companyId`,
  `employmentType`, `workMode`, `experienceLevel`, `salaryMin`; hanya `PUBLISHED`
  yang belum kedaluwarsa; cursor pagination + `nextCursor`; kartu berisi title,
  company, location, salary, dan job type.
- `GET /jobs/:slug`: detail publik + increment `viewCount`; 404 untuk non-published.
- Employer: `POST /companies/:companyId/jobs` (DRAFT), `GET /companies/:companyId/jobs`
  (semua status + meta pagination), `GET /jobs/:id/manage`, `PATCH /jobs/:id`,
  `DELETE /jobs/:id` (DRAFT, `OWNER`/`ADMIN`).
- Transisi status `publish`/`pause`/`close`/`archive` tervalidasi
  (`job-status.util.ts`); publish pertama mengisi `publishedAt` + `expiresAt`
  (+30 hari default).
- `RegionsService.findByIds` untuk batch lokasi (anti N+1 di listing).

**Keputusan**
- `job_posts.slug` menjadi **unik global** agar `/jobs/:slug` unambiguous;
  slug stabil saat judul diubah.
- Filter gaji `salaryMin` memakai `salaryMax >= salaryMin` job (lowongan dengan
  batas atas di bawah ekspektasi disembunyikan).

**Migrasi**: `20261005140000_job_slug_global_unique`.

**Test**: `job-status.util.spec.ts` (4), `test/jobs.e2e-spec.ts` (16).
Total saat ini: unit 17, e2e 35.

## 2026-10-05 — Fase 1: Onboarding

**Fitur**
- `GET /users/me`, `PATCH /users/me` (modul `users`; `GET /auth/me` dipindah ke sini).
- `POST /seeker-profile`, `GET/PATCH /seeker-profile/me` — otomatis menambah role
  `JOB_SEEKER`; validasi provinsi/kota lewat `RegionsService`.
- `POST /companies` (transaksi: company + `EmployerProfile(OWNER)` + role
  `EMPLOYER`), `GET/PATCH /companies/me`, publik `GET /companies/:slug`.
- Infrastruktur: `CompanyAccessGuard` + `@CompanyRoles`/`@CurrentCompany`,
  `slugify` util, `RegionsService.resolveLocation/describeLocation`.

**Keputusan**
- Tanpa upload file — frontend memakai inisial nama; kolom `*Key` dibiarkan kosong.
- Satu user = satu company (unique `employer_profiles.userId`) untuk MVP.
- `/auth/me` dihapus, diganti `/users/me` mengikuti pola rjm.
- Tanpa migrasi baru (schema sudah memadai).

**Test**: `slug.util.spec.ts`, `test/onboarding.e2e-spec.ts` (12 skenario).
Total saat ini: unit 13, e2e 19.

## 2026-10-05 — Auth mandiri (mengganti Clerk)

**Perubahan**
- Clerk dibatalkan: `src/infra/clerk` dan `ClerkAuthGuard` dihapus.
- Registrasi/login email & username + password; hash **argon2id** (64 MB, t=3, p=1).
- JWT access 15 menit + refresh token 7 hari; refresh hanya lewat cookie
  `httpOnly`, disimpan sebagai hash di tabel baru `user_sessions`.
- Refresh rotation + reuse detection (revoke seluruh session), verifikasi ulang
  user/role tiap request di `AtStrategy`.
- Hardening: helmet, cookie-parser, `trust proxy`, rate limit per endpoint auth,
  pesan login seragam + dummy hash, `forbidNonWhitelisted`, CORS dari env.
- Seeder `20-users.seeder.ts` membuat akun `SYS_ADMIN` dari `SEED_ADMIN_*`.

**Migrasi**: `20261005130000_password_auth_sessions`
(drop `clerk_user_id`, tambah `username`/`password`, tabel `user_sessions`).

**Test**: unit 7 (roles guard + transform interceptor), `test/auth.e2e-spec.ts` (5 skenario).

## 2026-10-05 — Setup awal

- Inisialisasi Prisma 6.16 mengikuti pola rjm: `prisma.config.ts`, seed
  bertahap, generator `prisma-client` ke `src/generated` (tidak di-commit).
- Skema lengkap: users/user_roles, seeker & employer profiles, companies,
  regions, job_posts, job_applications + history, saved_jobs, company_follows,
  audit_logs.
- Koneksi Supabase (transaction pooler + session pooler), migrasi
  `20261005110904_init`.
- Seed wilayah: 38 provinsi + 514 kab/kota (kode BPS).
- Kerangka `common/`: TransformInterceptor (`{ success, data }`), HttpExceptionFilter,
  decorator, guard pipeline (`ThrottlerGuard` → `AtGuard` → `RolesGuard`),
  health check, modul `regions` sebagai slice pertama.
- `AGENTS.md` + dokumentasi `docs/`.
