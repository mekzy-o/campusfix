# Deploying CampusFix

CampusFix runs as **one Render web service** that serves the API, the Socket.IO
real-time channel and the built React app from the same address, connected to
a **Neon PostgreSQL** database. Both have free plans.

## 1. Create the database (Neon)

1. Sign in at https://neon.tech with GitHub and create a project named `campusfix`
   (region: AWS Europe, Frankfurt is closest to Nigeria).
2. On the project dashboard, open **Connect** and copy the connection string.
   It looks like:
   `postgresql://neondb_owner:••••@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

## 2. Create the web service (Render)

1. Sign in at https://render.com with GitHub.
2. Choose **New → Blueprint** and select the `campusfix` repository. Render reads
   `render.yaml` and proposes one web service.
3. When asked for `DATABASE_URL`, paste the Neon connection string.
4. Click **Apply**. Render installs dependencies, builds the React app and starts
   the server.

On first start the server automatically:
- runs the database migrations (creates all tables), and
- loads the demo data because the database is empty (`SEED_IF_EMPTY=true`).

## 3. Check it works

- `https://<your-service>.onrender.com/api/health` should return
  `{"status":"ok","database":"connected"}`. This confirms the deployed app is
  connected to the database.
- `https://<your-service>.onrender.com/api/docs` shows the Swagger documentation.
- Sign in with `admin@campusfix.app` / `CampusFix@2026`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (SSL is detected automatically) |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens (Render generates one) |
| `NODE_ENV` | `production`: secure cookies, migrations on start, hidden error details |
| `SEED_IF_EMPTY` | `true` loads demo data into an empty database |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Optional e-mail notifications |

## Notes

- The free Render plan sleeps after 15 minutes of inactivity; the next request
  wakes it in about 30–60 seconds.
- Uploaded photos are stored in PostgreSQL, so they survive redeploys (Render's
  free disk is wiped on every deploy).
- Every push to `main` redeploys automatically.
