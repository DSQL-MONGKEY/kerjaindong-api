# 04 — API Endpoints

Base URL: `/api/v1`. Semua request/response JSON.
Header autentikasi: `Authorization: Bearer <accessToken>`.
Refresh token hanya lewat cookie `httpOnly` `refresh_token` (backend yang set).

## Konvensi response

```jsonc
// sukses tanpa message — dibungkus otomatis oleh TransformInterceptor
{ "success": true, "data": { } }

// sukses dengan message — diteruskan apa adanya (passthrough)
{ "message": "Logout berhasil" }

// error (validasi / HTTP)
{
  "statusCode": 400,
  "timestamp": "2026-10-06T00:00:00.000Z",
  "path": "/api/v1/...",
  "message": "..." // string, atau array pesan validasi
}
```

- DTO memakai `whitelist` + `forbidNonWhitelisted` — field di luar kontrak
  ditolak `400`.
- Body request ditulis dengan aturan: field **wajib** dulu, opsional belakangan.
- Response `data` yang berisi named shape merujuk ke bagian
  [Bentuk data bersama](#bentuk-data-bersama).

Legenda akses:
- **Public** — tanpa token.
- **JWT** — butuh access token.
- **JWT+Company** — butuh token + keanggotaan company aktif
  (`CompanyAccessGuard`); sebagian dibatasi role internal `@CompanyRoles(...)`.
- **SYS_ADMIN** — butuh role `SYS_ADMIN`.

---

## Bentuk data bersama

### `UserPublic`
```json
{
  "id": "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  "email": "budi@example.com",
  "username": "budi",
  "fullName": "Budi Santoso",
  "isActive": true,
  "roles": ["JOB_SEEKER"],
  "hasSeekerProfile": true,
  "hasEmployerProfile": false,
  "employerCompanyId": null
}
```

### `LocationSummary` & `location`
```jsonc
// LocationSummary
{ "id": "uuid", "code": "3171", "name": "Kota Adm. Jakarta Pusat", "level": "REGENCY" }

// location (profil/job/company)
{ "province": LocationSummary | null, "city": LocationSummary | null }

// location lengkap dengan ID (seeker profile, company)
{ "provinceId": "uuid|null", "cityId": "uuid|null", "province": LocationSummary | null, "city": LocationSummary | null }
```

### `PaginationMeta`
```json
{ "page": 1, "perPage": 10, "total": 42, "totalPages": 5 }
```

### `JobCard` (feed publik)
```json
{
  "id": "uuid",
  "title": "Backend Engineer",
  "slug": "backend-engineer",
  "employmentType": "FULL_TIME",
  "workMode": "REMOTE",
  "experienceLevel": "MID",
  "salaryMin": 10000000,
  "salaryMax": 20000000,
  "salaryCurrency": "IDR",
  "salaryPeriod": "MONTHLY",
  "publishedAt": "2026-10-05T10:00:00.000Z",
  "createdAt": "2026-10-05T09:00:00.000Z",
  "company": {
    "id": "uuid",
    "name": "PT Kerjain Dong",
    "slug": "pt-kerjain-dong",
    "industry": "Technology",
    "verification": "UNVERIFIED"
  },
  "location": { "province": null, "city": null }
}
```

### `JobDetail`
Semua field `JobCard` plus: `companyId`, `description`, `requirements`,
`benefits`, `status`, `expiresAt`, `closedAt`, `viewCount`,
`applicationCount`, `updatedAt`; `company` ditambah `website` dan
`description`.

### `SeekerProfile`
```json
{
  "id": "uuid", "userId": "uuid",
  "firstName": "Budi", "lastName": "Santoso",
  "headline": "Backend Engineer", "summary": "...", "phone": "0812...",
  "photoKey": null, "expectedSalary": 20000000, "salaryCurrency": "IDR",
  "openToWork": true,
  "createdAt": "...", "updatedAt": "...",
  "location": { "provinceId": null, "cityId": null, "province": null, "city": null }
}
```

### `Resume`
```json
{
  "id": "uuid", "jobSeekerId": "uuid",
  "title": "CV Backend", "isPrimary": true, "summary": "...", "fileKey": null,
  "createdAt": "...", "updatedAt": "..."
}
```

### `MyCompany` (employer)
```json
{
  "id": "uuid", "name": "PT Kerjain Dong", "slug": "pt-kerjain-dong",
  "logoKey": null, "bannerKey": null, "website": "https://...",
  "industry": "Technology", "description": "...",
  "verification": "UNVERIFIED", "verifiedAt": null,
  "createdAt": "...", "updatedAt": "...",
  "location": { "provinceId": null, "cityId": null, "province": null, "city": null },
  "membership": {
    "id": "uuid", "companyRole": "OWNER", "firstName": "Sari",
    "lastName": null, "position": null, "isActive": true
  }
}
```

### `EmployerJob` (manage/create/update/transisi)
```json
{
  "id": "uuid", "companyId": "uuid", "title": "Backend Engineer",
  "slug": "backend-engineer", "description": "...", "requirements": null,
  "benefits": null, "employmentType": "FULL_TIME", "workMode": "ONSITE",
  "experienceLevel": null, "salaryMin": null, "salaryMax": null,
  "salaryCurrency": "IDR", "salaryPeriod": "MONTHLY", "status": "DRAFT",
  "publishedAt": null, "expiresAt": null, "closedAt": null,
  "viewCount": 0, "applicationCount": 0,
  "createdAt": "...", "updatedAt": "...",
  "company": { "id": "uuid", "name": "...", "slug": "...", "industry": null, "verification": "UNVERIFIED" },
  "location": { "province": null, "city": null }
}
```

### `EmployerJobListItem` (daftar lowongan company)
```json
{
  "id": "uuid", "title": "Backend Engineer", "slug": "backend-engineer",
  "status": "DRAFT", "employmentType": "FULL_TIME", "workMode": "ONSITE",
  "experienceLevel": null, "salaryMin": null, "salaryMax": null,
  "salaryCurrency": "IDR", "salaryPeriod": "MONTHLY",
  "applicationCount": 0, "viewCount": 0,
  "publishedAt": null, "expiresAt": null,
  "createdAt": "...", "updatedAt": "...",
  "location": { "province": null, "city": null }
}
```

### `ApplicationDetail`
```json
{
  "id": "uuid", "status": "APPLIED", "coverLetter": "...",
  "resumeId": "uuid|null",
  "resumeSnapshot": {
    "generatedAt": "2026-10-06T00:00:00.000Z",
    "job": { "id": "uuid", "title": "...", "slug": "...", "companyId": "uuid", "companyName": "..." },
    "seeker": {
      "profileId": "uuid", "fullName": "Budi Santoso", "headline": "...",
      "summary": "...", "phone": "...", "email": "budi@example.com",
      "expectedSalary": 20000000, "salaryCurrency": "IDR",
      "provinceId": null, "cityId": null
    },
    "resume": { "id": "uuid", "title": "CV Backend", "summary": "..." }
  },
  "viewedAt": null, "statusChangedAt": "...",
  "createdAt": "...", "updatedAt": "...",
  "job": {
    "id": "uuid", "title": "...", "slug": "...", "status": "PUBLISHED",
    "company": { "id": "uuid", "name": "...", "slug": "..." }
  },
  "applicant": {
    "fullName": "Budi Santoso", "firstName": "Budi", "lastName": "Santoso",
    "headline": "...", "phone": "...", "email": "budi@example.com",
    "expectedSalary": 20000000, "cityId": null
  },
  "history": [
    {
      "fromStatus": null, "toStatus": "APPLIED", "note": null,
      "changedById": "uuid", "createdAt": "..."
    }
  ]
}
```

### `ApplicantListItem` (employer)
```json
{
  "id": "uuid", "status": "APPLIED", "coverLetter": "...",
  "viewedAt": null, "statusChangedAt": "...", "createdAt": "...",
  "applicant": {
    "fullName": "Budi Santoso", "headline": "...", "phone": "...",
    "email": "budi@example.com", "expectedSalary": 20000000,
    "location": null
  }
}
```

### `JobStatus`
`DRAFT` · `PUBLISHED` · `PAUSED` · `CLOSED` · `ARCHIVED`

### `ApplicationStatus`
`APPLIED` · `REVIEWING` · `SHORTLISTED` · `ACCEPTED` · `REJECTED` · `WITHDRAWN`

---

## Health

### `GET /health` — Public

Request: tanpa body/query.

Response `200`:
```json
{ "success": true, "data": { "status": "ok", "timestamp": "2026-10-06T00:00:00.000Z" } }
```

---

## Regions

### `GET /regions` — Public

Query (semua opsional):

| Param | Tipe | Keterangan |
|---|---|---|
| `level` | `PROVINCE\|REGENCY\|DISTRICT\|VILLAGE` | Filter jenjang |
| `parentCode` | string (kode BPS) | Anak dari region dengan kode tsb |
| `search` | string | Cari nama (case-insensitive) |

Response `200`:
```jsonc
{
  "success": true,
  "data": [
    { "id": "uuid", "code": "31", "name": "DKI Jakarta", "level": "PROVINCE", "parentId": null }
  ]
}
```

---

## Auth

### `POST /auth/register` — Public (3 req/menit)

Request:
```json
{
  "email": "budi@example.com",
  "username": "budi",
  "password": "Rahasia123",
  "fullName": "Budi Santoso",
  "role": "JOB_SEEKER"
}
```

| Field | Wajib | Aturan |
|---|---|---|
| `email` | ya | email valid, lowercase otomatis |
| `username` | ya | `^[a-z0-9._-]{3,50}$`, lowercase otomatis |
| `password` | ya | 8–128 karakter, wajib huruf + angka |
| `fullName` | tidak | maks 150 |
| `role` | tidak | `JOB_SEEKER` (default) atau `EMPLOYER` |

Response `201` (header `Set-Cookie: refresh_token=...; HttpOnly; Max-Age=7d`):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "uuid", "email": "budi@example.com", "username": "budi",
      "fullName": "Budi Santoso", "isActive": true, "roles": ["JOB_SEEKER"],
      "hasSeekerProfile": false, "hasEmployerProfile": false, "employerCompanyId": null
    }
  }
}
```

Error: `400` validasi, `409` email/username terpakai.

### `POST /auth/login` — Public (5 req/menit)

Request:
```json
{ "identifier": "budi@example.com", "password": "Rahasia123" }
```

`identifier` boleh email **atau** username.

Response `200`: sama dengan register (`data: { accessToken, user }`) + cookie
refresh baru. Error `401` `{ "message": "Kredensial tidak valid" }`.

### `POST /auth/refresh` — cookie `refresh_token` (10 req/menit)

Request: tanpa body; wajib mengirim cookie (browser:
`credentials: "include"`).

Response `200`:
```json
{
  "success": true,
  "data": { "accessToken": "eyJhbGciOi...", "user": { "...": "UserPublic" } }
}
```
Cookie refresh dirotasi. Error `401` bila cookie tidak ada/revoked/kedaluwarsa.

### `POST /auth/logout` — JWT

Request: tanpa body (token di header).

Response `200`:
```json
{ "message": "Logout berhasil" }
```

---

## Users

### `GET /users/me` — JWT

Request: tanpa body/query.

Response `200`:
```jsonc
{ "success": true, "data": { /* UserPublic */ } }
```

### `PATCH /users/me` — JWT

Request (minimal satu field):
```json
{ "fullName": "Budi Santoso Jr." }
```

Response `200`: `data: UserPublic` (versi terbaru).

---

## Seeker profile

### `POST /seeker-profile` — JWT

Request:
```json
{
  "firstName": "Budi",
  "lastName": "Santoso",
  "headline": "Backend Engineer",
  "summary": "5 tahun pengalaman...",
  "phone": "08123456789",
  "provinceId": "uuid-provinsi",
  "cityId": "uuid-kota",
  "expectedSalary": 20000000,
  "salaryCurrency": "IDR",
  "openToWork": true
}
```

| Field | Wajib | Aturan |
|---|---|---|
| `firstName` | ya | 1–100 |
| `lastName` | tidak | maks 100 |
| `headline` | tidak | maks 255 |
| `summary` | tidak | maks 5000 |
| `phone` | tidak | maks 30 |
| `provinceId` / `cityId` | tidak | UUID region; `cityId` harus anak `provinceId` |
| `expectedSalary` | tidak | integer ≥ 0 (rupiah) |
| `salaryCurrency` | tidak | 3 huruf, default `IDR` |
| `openToWork` | tidak | boolean, default `true` |

Efek: menambah role `JOB_SEEKER` bila belum ada.

Response `201`: `data: SeekerProfile`.
Error: `400` lokasi tidak valid, `409` profil sudah ada.

### `GET /seeker-profile/me` — JWT

Request: tanpa body.

Response `200`: `data: SeekerProfile`. Error `404` bila belum dibuat.

### `PATCH /seeker-profile/me` — JWT

Request: seperti `POST` tetapi semua field opsional, kirim hanya yang berubah:
```json
{ "headline": "Senior Backend Engineer", "cityId": "uuid-kota-baru" }
```

Perubahan `provinceId` tanpa `cityId` akan mengosongkan `cityId`.

Response `200`: `data: SeekerProfile`.

---

## Companies

### `POST /companies` — JWT

Request:
```json
{
  "name": "PT Kerjain Dong",
  "website": "https://kerjaindong.com",
  "industry": "Technology",
  "description": "Perusahaan teknologi...",
  "provinceId": "uuid-provinsi",
  "cityId": "uuid-kota",
  "firstName": "Sari",
  "lastName": "Dewi",
  "position": "Talent Acquisition"
}
```

| Field | Wajib | Aturan |
|---|---|---|
| `name` | ya | 2–255; slug unik dibuat otomatis |
| `website` | tidak | URL, maks 255 |
| `industry` | tidak | maks 100 |
| `description` | tidak | maks 5000 |
| `provinceId` / `cityId` | tidak | UUID region, harus konsisten |
| `firstName` | ya | 1–100 (profil HR/owner) |
| `lastName` | tidak | maks 100 |
| `position` | tidak | maks 100 |

Efek (satu transaksi): buat company + `EmployerProfile(OWNER)` + role
`EMPLOYER`.

Response `201`:
```jsonc
{ "success": true, "data": { /* MyCompany */ } }
```
Error: `400` lokasi tidak valid, `409` user sudah terdaftar di company lain.

### `GET /companies/me` — JWT

Request: tanpa body.

Response `200`: `data: MyCompany`.
Error `404` `{ "message": "Anda belum terdaftar di perusahaan" }` — state
"belum onboarding" (sengaja tanpa `CompanyAccessGuard`).

### `PATCH /companies/me` — JWT+Company (`OWNER`/`ADMIN`)

Request (semua opsional):
```json
{ "description": "Deskripsi baru", "industry": "Fintech" }
```
Field: `name`, `website`, `industry`, `description`, `provinceId`, `cityId`.
`slug` tidak ikut berubah.

Response `200`: `data: MyCompany`.
Error: `403` bukan OWNER/ADMIN atau belum terdaftar.

### `GET /companies/:slug` — Public

Request: tanpa body.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "id": "uuid", "name": "PT Kerjain Dong", "slug": "pt-kerjain-dong",
    "website": "https://...", "industry": "Technology", "description": "...",
    "verification": "UNVERIFIED", "verifiedAt": null, "createdAt": "...",
    "location": { "provinceId": null, "cityId": null, "province": null, "city": null }
  }
}
```
Error `404` perusahaan tidak ditemukan.

---

## Company members & invitations

### `GET /companies/:companyId/members` — JWT+Company

Request: tanpa body.

Response `200`:
```jsonc
{
  "success": true,
  "data": [
    {
      "id": "uuid", "userId": "uuid", "firstName": "Sari", "lastName": null,
      "position": null, "companyRole": "OWNER", "isActive": true,
      "joinedAt": "...", "user": { "email": "sari@...", "username": "sari", "fullName": "Sari" }
    }
  ]
}
```

### `DELETE /companies/:companyId/members/:userId` — JWT+Company (`OWNER`/`ADMIN`)

Request: tanpa body.

Response `200`:
```json
{ "message": "Anggota dinonaktifkan" }
```
Error: `400` target OWNER atau diri sendiri, `403` bukan member/role kurang,
`404` anggota tidak ditemukan.

### `POST /companies/:companyId/invitations` — JWT+Company (`OWNER`/`ADMIN`)

Request:
```json
{ "email": "rekruter@example.com", "role": "RECRUITER" }
```
`role`: `ADMIN` atau `RECRUITER`. Undangan berlaku 7 hari; undangan pending
lama untuk email yang sama diganti.

Response `201` (token mentah **hanya muncul sekali**):
```json
{
  "success": true,
  "data": {
    "id": "uuid", "email": "rekruter@example.com", "role": "RECRUITER",
    "expiresAt": "...", "token": "sJ8...base64url"
  }
}
```
Error `409` email sudah aktif di sebuah perusahaan.

### `GET /companies/:companyId/invitations` — JWT+Company (`OWNER`/`ADMIN`)

Request: tanpa body.

Response `200`:
```jsonc
{
  "success": true,
  "data": [
    {
      "id": "uuid", "email": "rekruter@example.com", "role": "RECRUITER",
      "expiresAt": "...", "acceptedAt": null, "createdAt": "...",
      "status": "PENDING" // PENDING | ACCEPTED | EXPIRED
    }
  ]
}
```

### `GET /invitations/:token` — Public

Request: tanpa body.

Response `200`:
```json
{
  "success": true,
  "data": {
    "company": { "name": "PT Kerjain Dong", "slug": "pt-kerjain-dong" },
    "email": "rekruter@example.com", "role": "RECRUITER",
    "expiresAt": "...", "status": "PENDING"
  }
}
```
Error `404` token tidak valid.

### `POST /invitations/accept` — JWT

Request:
```json
{ "token": "sJ8...base64url" }
```

Response `200` (passthrough):
```json
{ "message": "Berhasil bergabung dengan perusahaan", "companyId": "uuid", "role": "RECRUITER" }
```
Error: `400` dipakai/kedaluwarsa, `403` email tidak cocok, `409` sudah di
company lain.

---

## Jobs

### `GET /jobs` — Public

Query:

| Param | Tipe | Keterangan |
|---|---|---|
| `q` | string ≤100 | Cari judul (case-insensitive) |
| `cityId`, `provinceId`, `companyId` | UUID | Filter lokasi/perusahaan |
| `employmentType` | `FULL_TIME\|PART_TIME\|CONTRACT\|INTERNSHIP\|FREELANCE` | Filter tipe |
| `workMode` | `ONSITE\|REMOTE\|HYBRID` | Filter mode |
| `experienceLevel` | `ENTRY\|JUNIOR\|MID\|SENIOR\|LEAD` | Filter level |
| `salaryMin` | int ≥0 | Tampil bila `salaryMax >= salaryMin` job |
| `limit` | int 1–50 (default 10) | Jumlah per halaman |
| `cursor` | UUID | `nextCursor` halaman sebelumnya |

Hanya `PUBLISHED` dan belum kedaluwarsa.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [ { /* JobCard */ } ],
    "nextCursor": "uuid|null"
  }
}
```

### `GET /jobs/:slug` — Public

Request: tanpa body. `viewCount` bertambah setiap akses.

Response `200`:
```jsonc
{ "success": true, "data": { /* JobDetail */ } }
```
Error `404` bila non-published/kedaluwarsa/tidak ada.

### `POST /companies/:companyId/jobs` — JWT+Company

Request:
```json
{
  "title": "Backend Engineer",
  "description": "Bangun API...",
  "requirements": "NestJS, PostgreSQL",
  "benefits": "BPJS, remote allowance",
  "employmentType": "FULL_TIME",
  "workMode": "REMOTE",
  "experienceLevel": "MID",
  "provinceId": "uuid-provinsi",
  "cityId": "uuid-kota",
  "salaryMin": 10000000,
  "salaryMax": 20000000,
  "salaryCurrency": "IDR",
  "salaryPeriod": "MONTHLY",
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```
`title` (3–255) & `description` wajib; `employmentType` wajib; sisanya opsional.
`salaryMin`/`salaryMax` integer ≥ 0 dengan `salaryMax >= salaryMin`.

Response `201`: `data: EmployerJob` (status awal `DRAFT`).
Error: `400` gaji/lokasi tidak valid, `403` bukan member company.

### `GET /companies/:companyId/jobs` — JWT+Company

Query: `status` (`JobStatus`), `page` ≥1, `perPage` 1–100 (default 20).

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [ { /* EmployerJobListItem */ } ],
    "meta": { "page": 1, "perPage": 20, "total": 3, "totalPages": 1 }
  }
}
```

### `GET /jobs/:id/manage` — JWT+Company

Request: tanpa body.

Response `200`: `data: EmployerJob`. Error `404` bila bukan milik company.

### `PATCH /jobs/:id` — JWT+Company

Request: seperti `POST` versi partial:
```json
{ "title": "Backend Engineer (Senior)", "salaryMax": 25000000 }
```

Response `200`: `data: EmployerJob`. Slug tidak berubah.
Error `400` bila `ARCHIVED` atau salary tidak valid.

### `POST /jobs/:id/publish` — JWT+Company

Request: tanpa body. `DRAFT|PAUSED|CLOSED → PUBLISHED`; mengisi `publishedAt`
dan `expiresAt` (+30 hari) bila kosong.

Response `200`: `data: EmployerJob` (status `PUBLISHED`).

### `POST /jobs/:id/pause` — JWT+Company

Request: tanpa body. `PUBLISHED → PAUSED`.

Response `200`: `data: EmployerJob`.

### `POST /jobs/:id/close` — JWT+Company

Request: tanpa body. `PUBLISHED|PAUSED → CLOSED` + `closedAt`.

Response `200`: `data: EmployerJob`.

### `POST /jobs/:id/archive` — JWT+Company

Request: tanpa body. Menuju `ARCHIVED` (final).

Response `200`: `data: EmployerJob`.

Transisi tidak valid → `400`
`{ "message": "Status DRAFT tidak dapat diubah menjadi PAUSED" }`.

### `DELETE /jobs/:id` — JWT+Company (`OWNER`/`ADMIN`)

Request: tanpa body. Hanya status `DRAFT`.

Response `200`:
```json
{ "message": "Lowongan dihapus" }
```
Error `400` bila bukan DRAFT.

---

## Resumes

### `POST /resumes` — JWT (seeker)

Request:
```json
{ "title": "CV Backend", "summary": "5 tahun pengalaman", "isPrimary": true }
```
`title` (1–150) wajib; resume pertama otomatis `isPrimary`.

Response `201`: `data: Resume`.
Error `400` bila profil seeker belum ada.

### `GET /resumes` — JWT (seeker)

Request: tanpa body.

Response `200`:
```jsonc
{ "success": true, "data": [ { /* Resume */ } ] }
```
Urutan: primary lebih dulu, lalu `updatedAt` terbaru.

### `GET /resumes/:id` — JWT (seeker)

Response `200`: `data: Resume`. Error `404`.

### `PATCH /resumes/:id` — JWT (seeker)

Request:
```json
{ "title": "CV Backend v2", "isPrimary": false }
```

Response `200`: `data: Resume`.

### `DELETE /resumes/:id` — JWT (seeker)

Response `200`:
```json
{ "message": "Resume dihapus" }
```

### `POST /resumes/:id/primary` — JWT (seeker)

Response `200`: `data: Resume` (yang dijadikan primary).

---

## Applications

### `POST /jobs/:jobId/applications` — JWT (seeker)

Request:
```json
{ "resumeId": "uuid-resume", "coverLetter": "Saya tertarik..." }
```
Kedua field opsional; bila `resumeId` kosong memakai resume primary.

Response `201`:
```jsonc
{ "success": true, "data": { /* ApplicationDetail */ } }
```
Error: `400` profil belum ada / lowongan tidak menerima lamaran, `404`
lowongan/resume, `409` sudah pernah melamar.

### `GET /applications/me` — JWT (seeker)

Query: `status` (`ApplicationStatus`), `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid", "status": "APPLIED", "viewedAt": null,
        "statusChangedAt": "...", "createdAt": "...", "updatedAt": "...",
        "job": {
          "id": "uuid", "title": "...", "slug": "...", "status": "PUBLISHED",
          "company": { "id": "uuid", "name": "...", "slug": "..." }
        }
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

### `GET /applications/:id` — JWT

Bisa diakses seeker pemilik ATAU employer dari company pemilik lowongan
(akses employer menandai `viewedAt`).

Response `200`: `data: ApplicationDetail`. Error `403` pihak lain.

### `POST /applications/:id/withdraw` — JWT (seeker)

Request: tanpa body. Hanya sebelum status final.

Response `200`: `data: ApplicationDetail` (status `WITHDRAWN`, history
bertambah). Error `400` bila sudah final.

### `GET /jobs/:jobId/applications` — JWT+Company

Query: `status`, `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [ { /* ApplicantListItem */ } ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

### `PATCH /applications/:id/status` — JWT+Company

Request:
```json
{ "status": "REVIEWING", "note": "CV sesuai kualifikasi" }
```
`status`: `REVIEWING|SHORTLISTED|REJECTED|ACCEPTED`; `note` opsional maks 500.

Transisi valid: `APPLIED → REVIEWING|SHORTLISTED|REJECTED`,
`REVIEWING → SHORTLISTED|REJECTED`, `SHORTLISTED → ACCEPTED|REJECTED`.

Response `200`: `data: ApplicationDetail` (history wajib bertambah).
Error `400` transisi/status tidak valid.

---

## Engagement

### `POST /jobs/:jobId/save` — JWT (seeker)

Request: tanpa body. Idempotent; hanya lowongan `PUBLISHED` yang belum
kedaluwarsa.

Response `200`:
```json
{ "message": "Lowongan disimpan" }
```
Error `400` lowongan tidak tersedia, `404` tidak ditemukan.

### `DELETE /jobs/:jobId/save` — JWT (seeker)

Response `200`:
```json
{ "message": "Lowongan dihapus dari simpanan" }
```

### `GET /saved-jobs` — JWT (seeker)

Query: `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "savedAt": "...",
        /* field JobCard + "status": "PUBLISHED" */
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

### `POST /companies/:companyId/follow` — JWT (seeker)

Idempotent.

Response `200`:
```json
{ "message": "Mengikuti perusahaan" }
```

### `DELETE /companies/:companyId/follow` — JWT (seeker)

Response `200`:
```json
{ "message": "Berhenti mengikuti perusahaan" }
```

### `GET /followed-companies` — JWT (seeker)

Query: `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "followedAt": "...", "id": "uuid", "name": "...", "slug": "...",
        "industry": null, "verification": "UNVERIFIED",
        "location": { "province": null, "city": null }
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

---

## Admin backoffice

Semua endpoint wajib role `SYS_ADMIN` (error `403` untuk selain itu).
Setiap aksi tulis menulis `audit_logs` dalam transaksi yang sama.

### `GET /admin/companies` — SYS_ADMIN

Query: `verification` (`UNVERIFIED|PENDING|VERIFIED|REJECTED`), `q` (nama),
`page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid", "name": "...", "slug": "...", "industry": null,
        "verification": "UNVERIFIED", "verifiedAt": null, "createdAt": "...",
        "location": { "province": null, "city": null },
        "_count": { "jobPosts": 2, "employers": 1 }
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

### `PATCH /admin/companies/:id/verification` — SYS_ADMIN

Request:
```json
{ "status": "VERIFIED", "note": "Dokumen lengkap" }
```
`status`: `PENDING|VERIFIED|REJECTED`; `VERIFIED` mengisi `verifiedAt`.

Response `200`:
```json
{ "success": true, "data": { "id": "uuid", "verification": "VERIFIED", "verifiedAt": "..." } }
```
Audit: `company.verification.update`.

### `GET /admin/users` — SYS_ADMIN

Query: `q` (email/username/fullName), `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid", "email": "...", "username": "...", "fullName": "...",
        "isActive": true, "lastLoginAt": "...", "createdAt": "...",
        "roles": ["JOB_SEEKER"]
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

### `PATCH /admin/users/:id/status` — SYS_ADMIN

Request:
```json
{ "isActive": false, "note": "Pelanggaran ringan" }
```
Menonaktifkan akan mencabut semua session user tersebut.

Response `200`:
```json
{ "success": true, "data": { "id": "uuid", "isActive": false } }
```
Error `400` bila menonaktifkan diri sendiri atau SYS_ADMIN aktif terakhir.
Audit: `user.status.update`.

### `GET /admin/jobs` — SYS_ADMIN

Query: `status`, `companyId`, `q` (judul), `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid", "title": "...", "slug": "...", "status": "PUBLISHED",
        "applicationCount": 3, "viewCount": 120,
        "publishedAt": "...", "expiresAt": "...", "createdAt": "...",
        "company": { "id": "uuid", "name": "...", "slug": "..." }
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 1, "totalPages": 1 }
  }
}
```

### `PATCH /admin/jobs/:id/status` — SYS_ADMIN

Request:
```json
{ "status": "PAUSED", "note": "Menunggu klarifikasi" }
```
`status`: `PUBLISHED|PAUSED|ARCHIVED`.

Response `200`:
```json
{ "success": true, "data": { "id": "uuid", "status": "PAUSED" } }
```
Audit: `job.status.update`.

### `GET /admin/audit-logs` — SYS_ADMIN

Query: `entityType` (`company|user|job`), `entityId` (UUID), `actorUserId`
(UUID), `page`, `perPage`.

Response `200`:
```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid", "action": "company.verification.update",
        "entityType": "company", "entityId": "uuid",
        "before": { "verification": "UNVERIFIED" },
        "after": { "verification": "VERIFIED", "note": "Dokumen lengkap" },
        "ip": "127.0.0.1", "userAgent": "Mozilla/5.0 ...",
        "createdAt": "...",
        "actor": { "id": "uuid", "username": "superadmin", "email": "admin@..." }
      }
    ],
    "meta": { "page": 1, "perPage": 10, "total": 5, "totalPages": 1 }
  }
}
```

---

## Belum diterapkan / ditunda

- Notifikasi in-app dan messaging recruiter ↔ seeker.
- Change password, forgot/reset password, verifikasi email.
- Upload file (keputusan MVP: frontend memakai inisial nama).
- Resume terstruktur multi-section (pengalaman, pendidikan, skill, dll).
- Transfer ownership / keluar dari company secara sukarela.
