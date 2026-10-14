# Milestone 4 deployment

Milestone 4 runs the Kern web client and sync API as one HTTPS service backed by PostgreSQL. Local development continues to use the ignored JSON store, while production refuses to start without durable PostgreSQL storage and a stable signing secret.

Milestone 5 uses the same service and secret for Web Push care alerts; no additional production variable is required. Milestone 6 optionally adds Apple Push Notification service credentials for the native iPhone app. See [`milestone-5-notifications.md`](./milestone-5-notifications.md) and [`milestone-6-ios.md`](./milestone-6-ios.md).

## Deploy with Render

The repository includes a Render Blueprint in `render.yaml`. In Render, create a new Blueprint from `https://github.com/Agloby/Pet`. The Blueprint provisions:

- the Dockerized Kern web service;
- a private PostgreSQL database in the same region;
- a generated `KERN_SYNC_SECRET`;
- health checks at `/api/health`; and
- automatic deployments from `main`.

After the first deployment, open the Render service URL and create a sync profile. Sign into that same profile from a private browser window or another device to confirm that the name and care history follow the account.

Render plan availability changes over time. If `free` is unavailable for either resource, choose the smallest supported plan without changing the service or database wiring.

## Required production configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Required in production. |
| `KERN_SYNC_SECRET` | Stable token-signing secret containing at least 32 characters. Required in production. |
| `NODE_ENV=production` | Enables the built client, HTTPS enforcement, trusted proxy handling, and JSON logs. |
| `PORT` | HTTP port inside the hosting platform. Defaults to `4173`; the container sets `10000`. |
| `HOST` | Bind address. Defaults to `0.0.0.0` in production. |
| `KERN_PUBLIC_ORIGIN` | Optional canonical HTTPS origin. Render supplies `RENDER_EXTERNAL_URL` automatically. |
| `KERN_REQUIRE_HTTPS` | Optional boolean override. Defaults to `true` in production. |
| `KERN_TRUST_PROXY` | Optional boolean override. Defaults to `true` in production. |
| `KERN_APNS_KEY_ID` | Optional Apple APNs authentication key ID; all four APNs identity fields are required together. |
| `KERN_APNS_TEAM_ID` | Optional Apple Developer Team ID. |
| `KERN_APNS_PRIVATE_KEY` | Optional secret contents of the APNs `.p8` private key. |
| `KERN_APNS_BUNDLE_ID` | Optional native app bundle ID used as the APNs topic. |
| `KERN_APNS_ENVIRONMENT` | `production` by default; use `sandbox` for Debug device builds. |

Never commit the database URL or signing secret. Rotating `KERN_SYNC_SECRET` signs out existing sessions but does not delete account data.

## Local production simulation

Docker Compose exercises the same container and PostgreSQL path without requiring cloud credentials:

```bash
docker compose up --build
```

Open `http://localhost:4174` and check `http://localhost:4174/api/health`. Stop it with `docker compose down`. The named database volume deliberately survives restarts; use `docker compose down --volumes` only when intentionally discarding local test accounts.

## Operations and recovery

- The process emits structured JSON request logs in production without request bodies, credentials, or authorization tokens.
- `/api/health` returns `503` if the database is unavailable, allowing the platform to stop routing traffic to an unhealthy instance.
- PostgreSQL transactions lock an account while applying a pet action, preserving deduplication during concurrent requests.
- Enable the hosting provider's automatic PostgreSQL backups before inviting real users. Periodically restore a backup into a separate database and verify `/api/health`, login, and pet-state retrieval.
- A deployment rollback can restore the previous application image. Database restoration is separate and should only be used for confirmed data loss or corruption.
