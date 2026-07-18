# The Church of Pentecost — Kasse Assembly Attendance

Next.js app for biometric attendance (face + thumbprint planned) with **online and offline** kiosk support.

**Stack:** Next.js 15 · Auth.js · MongoDB · Vercel · GitHub

PHP prototype (if present) lives under [`legacy/`](./legacy) and is not deployed.

## Requirements

- Node.js 20+
- MongoDB (local for dev, **Atlas required for Vercel**)
- npm

## Local setup

```bash
cp .env.example .env
# edit MONGODB_URI / AUTH_SECRET as needed

npm install
npm run seed
npm run dev
```

Open http://localhost:3000

| Field    | Value               |
|----------|---------------------|
| Email    | `admin@kasse.church` |
| Password | `Admin@12345`       |


Change the admin password after first login.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` locally, or Atlas `mongodb+srv://…` |
| `MONGODB_DATABASE` | Default `apc_attendance` |
| `AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `AUTH_URL` / `NEXTAUTH_URL` | App URL (`http://localhost:3000` or `https://your-app.vercel.app`) |

## Features (Phase 0–1)

- Login, JWT sessions, RBAC (admin / officer / pastor / member)
- Members, services, attendance, reports (CSV), users
- Kiosk clock in/out (manual until biometrics in Phase 2)
- Hybrid mode: live MongoDB write online; `sync_queue` + IndexedDB offline
- Sync APIs: `/api/sync/push`, `/api/sync/pull`, `/api/sync/status`

## Deploy to Vercel (GitHub)

1. Push this repo to GitHub (`twumasgideon/clock_in` or your fork).
2. In [Vercel](https://vercel.com): **Add New Project** → import the repo.
3. Framework Preset: **Next.js** (auto-detected).
4. Set Environment Variables (Production):
   - `MONGODB_URI` = Atlas connection string  
   - `MONGODB_DATABASE` = `apc_attendance`  
   - `AUTH_SECRET` = long random string  
   - `AUTH_URL` = `https://your-project.vercel.app`  
   - `NEXTAUTH_URL` = same as `AUTH_URL`
5. Deploy.
6. Seed Atlas once from your machine:

```bash
MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/" \
MONGODB_DATABASE=apc_attendance \
npm run seed
```

Atlas network access must allow Vercel (typically `0.0.0.0/0` for serverless).

## Project layout

```
app/           App Router pages + API routes
components/    UI (sidebar, kiosk, badges)
lib/           MongoDB, Auth.js, RBAC, models
scripts/seed.ts
public/sync.js Offline IndexedDB helper
legacy/        Archived PHP prototype
```

## Dual-mode attendance

1. **Online** — clock events write to MongoDB  
2. **Offline** — queue locally / in `sync_queue`  
3. **Reconnect** — flush via `/api/sync/push`; admin can process queue under **Devices & Sync**

## Next (Phase 2)

- Webcam face capture (OpenCV / FaceNet or InsightFace)
- Fingerprint scanner enrollment and match
- Dual-factor verify on the kiosk stage
