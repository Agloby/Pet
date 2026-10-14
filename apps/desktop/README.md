# Kern desktop and sync application

Milestone 1 provides an installable, dependency-free desktop web app. It renders the validated Kern sprite atlas, runs a complete snack-and-reaction care loop, applies time-based need decay, and stores progress in the browser's local storage.

Milestone 2 adds optional sync profiles. A profile keeps one server-authoritative pet state across browser sessions, while an offline action queue lets care continue without a connection and safely retries each action once the service returns.

Milestone 3 makes the companion personal and gives it a living habitat. The first-run naming flow and later renames persist locally and through the offline sync queue. The visual refresh uses high-resolution character and reef artwork, a natural non-repeating swim path, drifting reef depth, moving caustic light, bubbles, passing fish and a sea turtle. Reduced-motion preferences keep the habitat still while preserving the scene. The original validated atlas remains preserved with the source package.

Milestone 4 makes the sync service deployable. Production uses PostgreSQL with transactional action deduplication, a stable environment-provided signing secret, HTTPS enforcement behind a trusted hosting proxy, request rate limits, origin checks, hardened browser headers, health/readiness checks, structured logs, and graceful shutdown. The repository includes a non-root Docker image, a Render Blueprint, CI checks, and a local PostgreSQL Compose stack.

Milestone 5 lets the reef reach back. Signed-in users can enable Web Push care alerts on each browser, choose a fullness threshold and reminder cooldown, and send an immediate test. Subscriptions and preferences are stored with the sync profile, expired endpoints are removed automatically, and the server evaluates authoritative pet decay every 15 minutes. VAPID keys are deterministically derived from the existing stable sync secret, so deployments do not need another manually paired secret.

## Run locally

From this directory:

```bash
npm run dev
```

Open `http://127.0.0.1:4173`. The development server exposes the canonical atlas from `Great White Shark/work/final/spritesheet-extended.png` without duplicating it.

On Windows PowerShell, use the command wrapper if script execution is restricted:

```powershell
$env:PORT = "4174"
npm.cmd run dev
```

Open the port printed by the server. `PORT`, `HOST`, and `KERN_DATA_FILE` can override the development defaults. Run `npm install` once after pulling Milestone 4 because the production server now includes the PostgreSQL driver.

## Sync behavior

- Create a profile from the status button in the top-right corner. The current local pet state becomes the profile's starting state.
- Sign in with the same profile in another browser session to restore the server state.
- Care and naming changes update the local UI first. If the service is unavailable, they remain in the browser queue and flush automatically after reconnection.
- Action IDs are retained by the server to prevent duplicate changes when a request is retried.
- During local development, sync accounts, password hashes, the signing secret, and pet state are stored in `.data/kern-sync.json`. The directory is ignored by Git.
- In production, accounts and pet state use PostgreSQL while `KERN_SYNC_SECRET` keeps authentication tokens valid across service restarts.

## Validate and build

```bash
npm run check
```

The static client bundle is written to `dist/`, including a copy of the validated atlas. The generated directory is intentionally not committed. The Node sync service runs from the source checkout with `npm start`. Repository CI runs the same check and builds the production container.

## Production deployment

See [`../../docs/milestone-4-deployment.md`](../../docs/milestone-4-deployment.md) for the Render Blueprint, Docker Compose validation, required environment variables, backup guidance, and recovery procedure.

See [`../../docs/milestone-5-notifications.md`](../../docs/milestone-5-notifications.md) for browser support, care-alert behavior, and notification acceptance checks.

## Figma handoff

Generate the self-contained desktop design with:

```bash
npm run design:export
```

Import `design/kern-reef-companion-desktop.svg` into a blank Figma design file by dragging it onto the canvas. The 1440×1024 composition includes editable text, shapes, meters, panels, and named groups; the production reef and character images are embedded so the import has no external asset dependencies.

## Security and current boundary

The service hashes passwords with scrypt and issues signed 30-day session tokens. Local development writes its data file atomically and binds to `127.0.0.1`. Production refuses to start without PostgreSQL and a signing secret, expects HTTPS at the hosting proxy, and adds rate limits, origin validation, security headers, database readiness checks, and structured logs. The hosting account must enable managed database backups before real user data is stored.

Push endpoints are treated as account data and are never included in request logs. Signing out removes this browser's subscription. Alerts require HTTPS outside localhost and a continuously running application process. Native iPhone and Garmin clients remain later milestones.
