# Kern desktop prototype

Milestone 1 is an installable, dependency-free desktop web prototype. It renders the validated Kern sprite atlas, runs a complete snack-and-reaction care loop, applies time-based need decay, and stores progress in the browser's local storage.

## Run locally

From this directory:

```bash
npm run dev
```

Open `http://127.0.0.1:4173`. The development server exposes the canonical atlas from `Great White Shark/work/final/spritesheet-extended.png` without duplicating it.

## Validate and build

```bash
npm run check
```

The production-ready static bundle is written to `dist/`, including a copy of the validated atlas. The generated directory is intentionally not committed.

## Current boundary

State is local to one browser profile. Authentication, cloud synchronization, notifications, and native iPhone or Garmin clients belong to later milestones.
