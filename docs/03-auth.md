# 03 — Autentikasi

Auth dikelola sendiri oleh backend (bukan Clerk). Password di-hash dengan
**argon2id**, token memakai JWT, session refresh tersimpan di database.

## Endpoint

| Method & path | Akses | Keterangan |
|---|---|---|
| `POST /api/v1/auth/register` | Public, 3 req/menit | `{ email, username, password, fullName?, role? }`. Role default `JOB_SEEKER`; `EMPLOYER` diizinkan. Langsung auto-login. |
| `POST /api/v1/auth/login` | Public, 5 req/menit | `{ identifier, password }` — identifier boleh **email atau username**. |
| `POST /api/v1/auth/refresh` | RtGuard + cookie, 10 req/menit | Rotasi refresh token; response hanya `accessToken` + user. |
| `POST /api/v1/auth/logout` | JWT | Hapus session milik token + clear cookie. |
| `GET /api/v1/users/me` | JWT | Identitas + role + status profil. |
| `PATCH /api/v1/users/me` | JWT | Update `fullName`. |

## Token & session

- **Access token** JWT 15 menit (`JWT_ACCESS_EXPIRES_IN`), payload
  `{ sub, username, email, roles, sessionId }`. Dikirim via header
  `Authorization: Bearer <token>`.
- **Refresh token** JWT 7 hari (`JWT_REFRESH_EXPIRES_IN`), hanya dikirim lewat
  cookie `httpOnly` (`refresh_token`, `sameSite=lax`, `secure` di production,
  `maxAge` 7 hari). Tidak pernah ada di body response.
- **Session** disimpan di `user_sessions`; yang disimpan adalah hash argon2 dari
  refresh token, plus user agent, IP, `expiresAt`, `revokedAt`, `lastActive`.

## Alur

```
register ──> hash argon2id ──> user + user_roles ──> buat session ──> access token + cookie
login    ──> argon2.verify ──> hapus session kedaluwarsa/revoked ──> session baru ──> token + cookie
refresh  ──> verifikasi JWT (cookie) ──> cocokkan hash session ──> rotasi hash & expiry ──> access token baru
logout   ──> hapus session ──> clear cookie
```

## Keamanan yang diterapkan

1. **argon2id** dengan parameter eksplisit: memory 64 MB, timeCost 3, parallelism 1.
2. **Anti user-enumeration** — pesan login seragam "Kredensial tidak valid";
   saat user tidak ada, tetap verifikasi dummy hash agar waktu respons mirip.
3. **Refresh token rotation** — setiap refresh menghasilkan token baru dan
   mengganti hash di database.
4. **Reuse detection** — memakai refresh token dari session yang sudah revoked
   atau hash tidak cocok akan mencabut **semua** session user tersebut.
5. **Validasi ulang per request** — `AtStrategy.validate` selalu membaca user
   dan role dari database; akun non-aktif langsung ditolak dan perubahan role
   berlaku tanpa menunggu token kedaluwarsa.
6. **Rate limit** — Throttler global 100/menit + limit ketat per endpoint auth.
7. **helmet**, **CORS allow-list** (`CORS_ORIGINS`), **cookie httpOnly**,
   `forbidNonWhitelisted`, `trust proxy` untuk IP asli.
8. **Validasi input** — email/username dinormalisasi lowercase; username
   `[a-z0-9._-]{3,50}`; password 8–128 karakter, wajib huruf + angka.
9. **Session hygiene** — session kedaluwarsa/revoked dihapus saat login;
   `lastLoginAt` diperbarui.

## Konfigurasi

```env
JWT_SECRET=...            # 48 byte random, base64url
JWT_REFRESH_SECRET=...    # HARUS berbeda dari JWT_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Akun admin awal dibuat seeder dari `SEED_ADMIN_*` dan diberi role `SYS_ADMIN`.

## Belum diterapkan (ditunda)

- Change password (`PATCH /auth/password`) + revoke semua session.
- Forgot/reset password (butuh tabel token + provider email).
- Verifikasi email.
- Account lockout setelah N kali gagal (saat ini mengandalkan rate limit).

## Cakupan test

- Unit: `src/common/guards/roles.guard.spec.ts`, `transform.interceptor.spec.ts`.
- E2E: `test/auth.e2e-spec.ts` — register, duplikat 409, `/users/me`, login salah
  401, login + refresh cookie + logout, refresh setelah logout 401.
