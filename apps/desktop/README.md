# Kern desktop and sync prototype

Milestone 1 provides an installable, dependency-free desktop web app. It renders the validated Kern sprite atlas, runs a complete snack-and-reaction care loop, applies time-based need decay, and stores progress in the browser's local storage.

Milestone 2 adds optional sync profiles. A profile keeps one server-authoritative pet state across browser sessions, while an offline action queue lets care continue without a connection and safely retries each action once the service returns.

Milestone 3 makes the companion personal and gives it a living habitat. The first-run naming flow and later renames persist locally and through the offline sync queue. The visual refresh uses high-resolution character and reef artwork, subtle ambient depth, mood lighting, and reduced-motion support. The original validated atlas remains preserved with the source package.

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

Open the port printed by the server. `PORT`, `HOST`, and `KERN_DATA_FILE` can override the defaults.

## Sync behavior

- Create a profile from the status button in the top-right corner. The current local pet state becomes the profile's starting state.
- Sign in with the same profile in another browser session to restore the server state.
- Care and naming changes update the local UI first. If the service is unavailable, they remain in the browser queue and flush automatically after reconnection.
- Action IDs are retained by the server to prevent duplicate changes when a request is retried.
- Sync accounts, password hashes, the signing secret, and pet state are stored in `.data/kern-sync.json` by default. The directory is ignored by Git.

## Validate and build

```bash
npm run check
```

The static client bundle is written to `dist/`, including a copy of the validated atlas. The generated directory is intentionally not committed. The Node sync service runs from the source checkout with `npm start`.

## Figma handoff

Generate the self-contained desktop design with:

```bash
npm run design:export
```

Import `design/kern-reef-companion-desktop.svg` into a blank Figma design file by dragging it onto the canvas. The 1440×1024 composition includes editable text, shapes, meters, panels, and named groups; the production reef and character images are embedded so the import has no external asset dependencies.

## Security and current boundary

The local service hashes passwords with scrypt, issues signed 30-day session tokens, writes its data file atomically, and binds to `127.0.0.1` by default. This is suitable for development and same-computer browser testing. A public or multi-device deployment still requires HTTPS, managed secrets, backups, rate limiting, and a hosted data store.

Notifications and native iPhone or Garmin clients remain later milestones.
