# 02 — Database

Sumber kebenaran: [`prisma/schema.prisma`](../prisma/schema.prisma).
Prasyarat: `DATABASE_URL` (aplikasi, port 6543 `pgbouncer=true`) dan
`DIRECT_URL` (migrasi, port 5432). Untuk operasi migrasi Prisma otomatis
memakai `directUrl`.

## Peta model

### Identity & access
| Model | Keterangan |
|---|---|
| `users` | Akun: `email` unik, `username` unik, `password` argon2id, `isActive`, `lastLoginAt`. Tidak menyimpan data role-specific. |
| `user_roles` | Junction multi-role (`JOB_SEEKER`, `EMPLOYER`, `SYS_ADMIN`) + `grantedById`/`grantedAt`. |
| `user_sessions` | Session refresh token: `hashedToken`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`, `lastActive`. |

### Seeker domain
| Model | Keterangan |
|---|---|
| `job_seeker_profiles` | 1:1 user. Nama, headline, summary, kontak, lokasi (`provinceId`/`cityId`), ekspektasi gaji, `openToWork`. |
| `resumes` | Multi-resume per seeker (`isPrimary`, `summary`, `fileKey`). Section terstruktur (pengalaman/pendidikan/skill) menyusul fase berikutnya. |

### Company & employer domain
| Model | Keterangan |
|---|---|
| `companies` | Entitas perusahaan: nama (boleh duplikat), `slug` unik & stabil, profil, lokasi, `verification`, `verifiedAt`. |
| `employer_profiles` | Keanggotaan user di company + profil HR: `companyRole` (`OWNER`/`ADMIN`/`RECRUITER`), `position`, `isActive`. Satu user maksimal satu company (unique `userId`) untuk MVP. |
| `company_invitations` | Undangan bergabung (token di-hash, expiry, role). Belum ada endpoint — fase 1b. |

### Referensi wilayah
| Model | Keterangan |
|---|---|
| `regions` | Hierarki self-relation (`PROVINCE` → `REGENCY` → `DISTRICT` → `VILLAGE`), `code` kode BPS unik. Ter-seed 38 provinsi + 514 kab/kota. |

### Job & application domain
| Model | Keterangan |
|---|---|
| `job_posts` | Lowongan: `slug` unik global (URL publik), tipe kerja (`employmentType`, `workMode`, `experienceLevel`), lokasi, rentang gaji, `status`, `publishedAt`/`expiresAt`, counter `viewCount`/`applicationCount`. |
| `job_applications` | Lamaran: unik per (`jobPostId`, `jobSeekerId`), `resumeSnapshot` (JSON kondisi resume saat melamar), `status`, `viewedAt`, `statusChangedAt`. |
| `application_status_history` | Audit perubahan status: `fromStatus` → `toStatus`, `changedById`, `note`. |

### Engagement & admin
| Model | Keterangan |
|---|---|
| `saved_jobs` | Bookmark lowongan (PK komposit). |
| `company_follows` | Follow company (PK komposit). |
| `audit_logs` | Jejak aksi admin/moderasi (`action`, `entityType`, `entityId`, `before`/`after`). |

## Enum

`Role` (JOB_SEEKER, EMPLOYER, SYS_ADMIN) · `CompanyMemberRole` (OWNER, ADMIN,
RECRUITER) · `VerificationStatus` (UNVERIFIED, PENDING, VERIFIED, REJECTED) ·
`RegionLevel` · `JobStatus` (DRAFT, PUBLISHED, PAUSED, CLOSED, ARCHIVED) ·
`EmploymentType` · `WorkMode` · `ExperienceLevel` · `SalaryPeriod` ·
`ApplicationStatus` (APPLIED, REVIEWING, SHORTLISTED, REJECTED, ACCEPTED, WITHDRAWN).

## Aturan penting

1. **Lamaran sekali per lowongan** — dijaga unique `(job_post_id, job_seeker_id)`;
   service menangkap error Prisma `P2002` menjadi HTTP 409.
2. **Pipeline status** — `APPLIED → REVIEWING → SHORTLISTED → ACCEPTED | REJECTED`;
   `WITHDRAWN` aksi seeker; status terminal: `ACCEPTED`, `REJECTED`, `WITHDRAWN`.
   Setiap perubahan status wajib menulis `application_status_history` dalam
   transaksi yang sama (aturan untuk fase apply flow).
3. **Snapshot resume** — saat melamar, resume dikopi ke `resumeSnapshot` agar
   versi yang dilihat recruiter tidak berubah.
4. **Riwayat tidak hilang** — relasi company/job/lamaran memakai `Restrict` atau
   `SetNull`; penghapusan memakai status arsip, bukan hard delete.
5. **Slug** — `job_posts.slug` unik global (URL publik `/jobs/:slug`) dan
   `companies.slug` stabil (tidak berubah walau nama diganti).
6. **Konvensi kolom** — DB `snake_case` via `@map`/`@@map`, PK `uuid(7)`,
   waktu `@db.Timestamptz(3)`, gaji rupiah `Int`.

## Migrasi

| Migrasi | Isi |
|---|---|
| `20261005110904_init` | Seluruh skema awal (users, profiles, companies, regions, jobs, applications, dll). |
| `20261005130000_password_auth_sessions` | Auth mandiri: hapus `clerk_user_id`, tambah `username`/`password`, tabel `user_sessions`. |
| `20261005140000_job_slug_global_unique` | `job_posts.slug` menjadi unik global untuk URL publik `/jobs/:slug`; index komposit `(company_id, slug)` dihapus. |

### Menjalankan migrasi saat non-interaktif

`prisma migrate dev` butuh konfirmasi saat ada warning (mis. menambah unique
index). Bila shell non-interaktif:

```bash
mkdir -p prisma/migrations/<timestamp>_<nama>
pnpm prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_<nama>/migration.sql
pnpm prisma migrate deploy
```

## Seeding

`pnpm seed` menjalankan `prisma/seed.ts` secara berurutan dan idempoten:

1. `01-preflight` — `CREATE EXTENSION IF NOT EXISTS pg_trgm`.
2. `10-regions` — upsert 38 provinsi + 514 kab/kota dari `seeders/data/regions.json`.
3. `20-users` — buat akun `SYS_ADMIN` dari `SEED_ADMIN_*` bila belum ada
   (tidak menimpa password yang sudah diganti).
