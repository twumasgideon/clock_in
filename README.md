# Asokwa Pentecost Church — Member Attendance System

Biometric attendance (facial recognition + thumbprint) with **online and offline** kiosk support.  
Stack: **PHP 8.3**, **MongoDB**, Bootstrap admin UI.

## Requirements

- PHP 8.1+ with `ext-mongodb` enabled
- [Composer](https://getcomposer.org/)
- Local MongoDB listening on `127.0.0.1:27017`

## Quick start

```bash
cp .env.example .env
composer install
php scripts/install.php
php -S localhost:8080 -t public
```

Open http://localhost:8080

| Field    | Value                 |
|----------|-----------------------|
| Email    | `admin@asokwa.church` |
| Password | `Admin@12345`         |

Change the admin password after first login.

## Environment

`.env` (local MongoDB defaults):

```
APP_URL=http://localhost:8080
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=apc_attendance
```

## What works now (Phase 0–1)

- Login, sessions, CSRF, role-based access (admin / officer / pastor / member)
- Members, services, attendance list, reports (CSV), users
- Kiosk clock in/out (manual until biometrics land in Phase 2)
- Hybrid mode: live MongoDB write online; `sync_queue` when offline
- Sync APIs: `/api/sync/push.php`, `/api/sync/pull.php`, `/api/sync/status.php`

## Project layout

```
config/          App + MongoDB settings
database/        Collection shapes + indexes
includes/        Helpers + layout
public/          Web root (pages, assets, API)
scripts/         install.php
src/             Auth, Sync, Database helpers
storage/         Local/offline artifacts
```

## Dual-mode attendance

1. **Online** — clock events write straight to MongoDB  
2. **Offline** — events queue locally / in `sync_queue`  
3. **Reconnect** — kiosk pushes queue; admin can process pending sync under **Devices & Sync**

Enrollment stays online-only; kiosks pull roster when connected.

## Next (Phase 2)

- Webcam face capture (OpenCV / FaceNet or InsightFace)
- Fingerprint scanner enrollment and match
- Dual-factor verify on the kiosk stage
