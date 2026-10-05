# 04 — API Endpoints

Semua route memakai prefix `/api/v1`. Response dibungkus `{ success, data }`
oleh `TransformInterceptor` (lihat [01-arsitektur.md](./01-arsitektur.md)).

Keterangan akses: **Public** = `@Public()`, **JWT** = butuh access token,
**JWT+Company** = butuh keanggotaan company (opsional dengan role tertentu).

## Sudah diterapkan

### Health
| Endpoint | Akses | Keterangan |
|---|---|---|
| `GET /health` | Public | Status aplikasi + timestamp. |

### Regions
| Endpoint | Akses | Keterangan |
|---|---|---|
| `GET /regions?level=&parentCode=&search=` | Public | Referensi wilayah Indonesia (kode BPS). |

### Auth
| Endpoint | Akses | Keterangan |
|---|---|---|
| `POST /auth/register` | Public (3/menit) | Daftar akun + auto-login; role default `JOB_SEEKER`. |
| `POST /auth/login` | Public (5/menit) | Login via email **atau** username. |
| `POST /auth/refresh` | Cookie (10/menit) | Rotasi refresh token; access token baru. |
| `POST /auth/logout` | JWT | Cabut session + clear cookie. |

### Users
| Endpoint | Akses | Keterangan |
|---|---|---|
| `GET /users/me` | JWT | Identitas + role + `hasSeekerProfile`/`hasEmployerProfile`. |
| `PATCH /users/me` | JWT | Update `fullName`. |

### Seeker profile
| Endpoint | Akses | Keterangan |
|---|---|---|
| `POST /seeker-profile` | JWT | Buat profil seeker; otomatis menambah role `JOB_SEEKER`; 409 bila sudah ada. |
| `GET /seeker-profile/me` | JWT | Profil milik user + nama provinsi/kota. |
| `PATCH /seeker-profile/me` | JWT | Update parsial; validasi pasangan provinsi/kota. |

### Companies
| Endpoint | Akses | Keterangan |
|---|---|---|
| `POST /companies` | JWT | Buat company + `EmployerProfile(OWNER)` + role `EMPLOYER` dalam satu transaksi; slug unik. |
| `GET /companies/me` | JWT+Company | Company + `membership` user. |
| `PATCH /companies/me` | JWT+Company (`OWNER`/`ADMIN`) | Update data company; slug tidak berubah. |
| `GET /companies/:slug` | Public | Profil publik company (tanpa job list). |

### Jobs
| Endpoint | Akses | Keterangan |
|---|---|---|
| `GET /jobs?q=&cityId=&provinceId=&companyId=&employmentType=&workMode=&experienceLevel=&salaryMin=&limit=&cursor=` | Public | Feed lowongan `PUBLISHED` & belum kedaluwarsa; cursor pagination + `nextCursor`; kartu berisi title, company, location, salary, job type. |
| `GET /jobs/:slug` | Public | Detail publik + increment `viewCount`; 404 bila bukan `PUBLISHED`/kedaluwarsa. |
| `POST /companies/:companyId/jobs` | JWT+Company | Buat lowongan `DRAFT`; slug unik global; validasi rentang gaji & lokasi. |
| `GET /companies/:companyId/jobs?status=&page=&perPage=` | JWT+Company | Daftar semua status + meta pagination. |
| `GET /jobs/:id/manage` | JWT+Company | Detail lowongan milik company. |
| `PATCH /jobs/:id` | JWT+Company | Update parsial; ditolak bila `ARCHIVED`; slug stabil. |
| `POST /jobs/:id/publish \| pause \| close \| archive` | JWT+Company | Transisi status tervalidasi (`job-status.util.ts`); publish pertama mengisi `publishedAt` + `expiresAt` (+30 hari default). |
| `DELETE /jobs/:id` | JWT+Company (`OWNER`/`ADMIN`) | Hanya lowongan `DRAFT`. |

## Rencana (belum diterapkan)

### Fase 1b — Member & undangan company
| Endpoint | Akses |
|---|---|
| `GET /companies/:companyId/members` | JWT+Company |
| `DELETE /companies/:companyId/members/:userId` | JWT+Company (`OWNER`/`ADMIN`) |
| `POST /companies/:companyId/invitations` | JWT+Company (`OWNER`/`ADMIN`) |
| `GET /invitations/:token` | Public |
| `POST /invitations/accept` | JWT |

### Fase 3 — Apply flow & pipeline
| Endpoint                          | Akses                                           |
| --------------------------------- | ----------------------------------------------- |
| `POST /jobs/:jobId/applications`  | JWT (sekali per lowongan, snapshot resume)      |
| `GET /applications/me`            | JWT (seeker)                                    |
| `GET /applications/:id`           | JWT (seeker pemilik / employer company terkait) |
| `POST /applications/:id/withdraw` | JWT (seeker)                                    |
| `GET /jobs/:jobId/applications`   | JWT+Company                                     |
| `PATCH /applications/:id/status`  | JWT+Company (validasi transisi + tulis history) |

### Fase 4 — Engagement
| Endpoint | Akses |
|---|---|
| `POST`/`DELETE /jobs/:id/save` | JWT (seeker) |
| `GET /saved-jobs` | JWT (seeker) |
| `POST`/`DELETE /companies/:id/follow` | JWT (seeker) |
| `GET /followed-companies` | JWT (seeker) |

### Fase 5 — Admin backoffice (`SYS_ADMIN`)
| Endpoint | Akses |
|---|---|
| `GET /admin/companies` + `PATCH /admin/companies/:id/verification` | JWT + `SYS_ADMIN` |
| `GET /admin/users` + `PATCH /admin/users/:id/status` | JWT + `SYS_ADMIN` |
| `GET /admin/jobs` + `PATCH /admin/jobs/:id/status` | JWT + `SYS_ADMIN` |
| `GET /admin/audit-logs` | JWT + `SYS_ADMIN` |

### Ditunda / di luar MVP
- Resume terstruktur multi-section (experience, education, skill, dll).
- Upload file (keputusan MVP: frontend menampilkan inisial nama, tanpa upload).
- Change/forgot/reset password, verifikasi email.
- Notifikasi in-app dan messaging recruiter ↔ seeker.
