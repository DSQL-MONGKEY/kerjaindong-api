# 06 — Penerapan Domain Driven Design

Dokumen ini memetakan secara jujur di mana konsep DDD dipakai di codebase ini.

**Ringkasan pendekatan:** *strategic DDD* diterapkan penuh (bounded context,
ubiquitous language, context map) dan *tactical DDD* sebagian (aggregate
invariant, domain policy, value object, domain service). Yang **tidak** dipakai:
folder `domain/` dengan entity kaya, repository interface/Unit of Work, domain
event/outbox, dan CQRS. Keputusan ini pragmatis: modular monolith, hindari
lapisan yang belum memberi nilai nyata.

## 1. Strategic DDD

### Bounded context

Setiap context = satu modul Nest + satu section di `prisma/schema.prisma`:

| Context | Modul | Section schema |
|---|---|---|
| Identity & Access (IAM) | `modules/auth`, `modules/users` | baris 13 `BOUNDED CONTEXT: IDENTITY & ACCESS (IAM)` |
| Seeker | `modules/seeker-profiles`, `modules/resumes` | baris 77 `SEEKER DOMAIN` |
| Company & Employer | `modules/companies`, `modules/company-access` | baris 126 `COMPANY & EMPLOYER DOMAIN` |
| Job & Application | `modules/jobs`, `modules/applications` | baris 230 `JOB & APPLICATION DOMAIN` |
| Engagement & Admin | `modules/engagement`, `modules/admin` | baris 355 `ENGAGEMENT & ADMIN` |
| Reference wilayah | `modules/regions` | section `REFERENCE: WILAYAH INDONESIA` (generic subdomain) |

### Klasifikasi subdomain

- **Core domain** — pembeda produk: `jobs`, `applications`, `companies`.
- **Supporting** — mendukung core: `seeker-profiles`, `resumes`, `engagement`,
  `company-access`, `admin`.
- **Generic** — bisa dibeli/diganti: IAM (`auth`/`users`), `regions`.

### Ubiquitous language

Nama model, enum, dan aksi memakai bahasa bisnis, bukan istilah teknis:
`JobPost`, `JobApplication`, `EmployerProfile`, `CompanyMemberRole(OWNER/ADMIN/RECRUITER)`,
`ApplicationStatus(APPLIED/REVIEWING/SHORTLISTED/ACCEPTED/REJECTED/WITHDRAWN)`,
`VerificationStatus`, aksi `publish/pause/close/archive`.

### Context map

```
                    ┌──────────────────────┐
                    │  IAM (auth, users)   │  upstream: identitas + role
                    └──────────┬───────────┘
                               │ (JWT, user_roles, guards)
        ┌──────────────────────┼───────────────────────┐
        ▼                      ▼                       ▼
┌───────────────┐      ┌───────────────┐       ┌────────────────┐
│    Seeker     │      │   Company     │       │  Engagement    │
│ profile+resume│      │ +members      │       │ saved + follow │
└───────┬───────┘      └───────┬───────┘       └───────┬────────┘
        │ resumeSnapshot       │ 1:N                   │
        ▼                      ▼                       ▼
┌───────────────────────────────────────────────────────────────┐
│                  Job  ──────────▶  Application                │
└───────────────────────────────────────────────────────────────┘
        ▲                      ▲                       ▲
        └──────────── Regions (reference) ─────────────┘  shared
                               │
                    ┌──────────┴──────────┐
                    │  Admin (moderasi)   │  audit log cross-cutting
                    └─────────────────────┘
```

Pola integrasi antar-context yang dipakai:

1. **Shared kernel/reference** — `RegionsModule` mengekspor `RegionsService`;
   enam modul mengimpornya (`jobs`, `applications`, `companies`,
   `seeker-profiles`, `engagement`, `admin`). Tidak ada modul lain yang
   mengimpor module lain secara langsung.
2. **Published language / anti-corruption** — saat melamar, data lintas context
   **dibekukan** ke `resumeSnapshot` (`applications.service.ts`). Recruiter
   melihat kondisi saat melamar; perubahan profil/resume setelahnya tidak
   mempengaruhi lamaran.
3. **Referensi ID antar-aggregate** — `JobApplication → JobPost → Company`,
   bukan object graph.
4. **Catatan batasan** — beberapa service membaca tabel context lain via Prisma
   (mis. `applications.service` membaca `jobSeekerProfile`/`employerProfile`).
   Boundary dijaga di level modul/route, belum dienforce tooling import.

## 2. Tactical DDD

### Aggregate & invariant (dijaga transaksi DB)

| Aggregate | Invariant | Lokasi |
|---|---|---|
| `JobApplication` | 1 lamaran per lowongan; history wajib pada setiap perubahan status; counter konsisten | `modules/applications/applications.service.ts:109` (apply), `:288` (withdraw), `:425` (update status) |
| `Resume` | maksimal satu `isPrimary` per seeker | `modules/resumes/resumes.service.ts:21`, `:65`, `:98` |
| `Company` | company selalu punya OWNER + role `EMPLOYER` saat dibuat | `modules/companies/companies.service.ts:36` |
| `CompanyInvitation` | token sekali pakai, expiry 7 hari, email harus cocok, reaktivasi member lama | `modules/company-access/company-access.service.ts:222` |
| `EmployerProfile` | soft remove + cabut session, OWNER/diri sendiri dilindungi | `modules/company-access/company-access.service.ts:72` |
| Admin/moderation | audit log ditulis dalam transaksi yang sama | `modules/admin/admin.service.ts:96`, `:197`, `:287` |

### Domain policy (aturan murni, terpisah dari I/O)

- `modules/jobs/job-status.util.ts` — state machine `JobPost` + mapping aksi →
  status (`publish/pause/close/archive`).
- `modules/applications/application-status.util.ts` — state machine lamaran +
  aturan status yang boleh ditetapkan perusahaan.
- `common/utils/slug.util.ts` — transformasi nilai (slug URL).
- `RegionsService.resolveLocation()` (`modules/regions/regions.service.ts`) —
  invariant "kota harus anak provinsi", provinsi otomatis diturunkan dari kota.

### Value object

- `resumeSnapshot` — salinan immutable fakta lamaran.
- Slug (company stabil, job unik global), enum status/wilayah.
- `LocationSummary` — bentuk ringkas region untuk read model.

### Domain service

- `RegionsService` — aturan wilayah dipakai lintas context.
- `AuditLogService` (`modules/admin/audit-log.service.ts`) — cross-cutting
  concern, menerima `tx` agar audit atomik dengan perubahan.

### Read model / mapper

- `modules/users/user-response.ts` (`USER_WITH_ACCESS_INCLUDE` + `toPublicUser`)
  — containment `password`, bentuk response konsisten di auth & users.

## 3. Yang sengaja tidak diterapkan

| Konsep | Alasan |
|---|---|
| Entity kaya / folder `domain/` | Model Prisma anemic; perilaku di service. Reorganisasi bisa dilakukan kapan pun tanpa mengubah perilaku. |
| Repository interface / Unit of Work | Hanya bernilai bila infrastruktur akan diganti; Prisma sudah menjadi UoW via `$transaction`. |
| Domain event / outbox | Belum ada konsumen event. `ApplicationStatusHistory` = audit trail, `AuditLog` = jejak aksi admin, bukan event bus. |
| CQRS / read model terpisah | Volume & kompleksitas belum menuntut; query langsung di service. |
| Import boundary enforcement | Belum ada `eslint-plugin-boundaries`; disiplin manual. |

## 4. Roadmap bila ingin lebih DDD (opsional)

1. Pindahkan util status ke `modules/<context>/domain/` (mis.
   `jobs/domain/job-status.ts`) + test — reorganisasi, tanpa ubah perilaku.
2. Tambah aturan import antar-context (eslint boundaries) untuk menjaga context map.
3. Domain event + tabel outbox **saat** notifikasi/messaging dikerjakan.
4. Repository interface **hanya bila** pindah ORM/infra.

Detail arsitektur ada di [01-arsitektur.md](./01-arsitektur.md); aturan data ada
di [02-database.md](./02-database.md).
