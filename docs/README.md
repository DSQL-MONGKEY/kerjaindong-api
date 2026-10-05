# Dokumentasi Kerjaindong API

Backend job portal dengan dua aktor: **Job Seeker** dan **Company/Employer**.

| Dokumen | Isi |
|---|---|
| [01-arsitektur.md](./01-arsitektur.md) | Stack, struktur folder, request lifecycle, response wrapper |
| [02-database.md](./02-database.md) | Skema Prisma, relasi, aturan, migrasi & seeding |
| [03-auth.md](./03-auth.md) | Register/login/refresh/logout, session, hardening keamanan |
| [04-api-endpoints.md](./04-api-endpoints.md) | Semua endpoint aktif + payload request/query tiap endpoint |
| [05-changelog.md](./05-changelog.md) | Riwayat perubahan sampai saat ini |
| [06-ddd.md](./06-ddd.md) | Pemetaan bounded context, aggregate invariant, domain policy |

Panduan kerja untuk agent/kontributor ada di [`../AGENTS.md`](../AGENTS.md).

## Status implementasi

Semua fase yang disepakati **selesai dan terverifikasi**.

| Fase | Cakupan | Status |
|---|---|---|
| 0 — Setup | Prisma 6 + Supabase, seed wilayah (38 provinsi + 514 kab/kota), auth mandiri, response wrapper, health | Selesai |
| 1 — Onboarding | `users/me`, profil seeker, company + owner membership, `CompanyAccessGuard` | Selesai |
| 2 — Jobs | CRUD employer + state machine status, feed publik (filter + cursor), detail + `viewCount` | Selesai |
| 3 — Apply & Pipeline | Resume minimal, apply sekali + snapshot, pipeline + history, withdraw, daftar pelamar | Selesai |
| 4 — Engagement | Saved job + follow company | Selesai |
| 5 — Admin | Verifikasi company, status user, moderasi job, audit log | Selesai |
| 1b — Members | Undangan, accept, role internal, soft remove | Selesai |

Verifikasi terakhir: `pnpm lint` (0 masalah), `pnpm build`, unit **22/22**,
e2e **69/69** (8 suite, `--runInBand`).

### Ditunda / di luar MVP

Notifikasi in-app & messaging, change/forgot/reset password, verifikasi email,
upload file (diganti inisial nama), resume multi-section, transfer ownership /
keluar company, indexing full-text/trgm, event analytics, pembersihan session
berkala, seed district/village, account lockout.
