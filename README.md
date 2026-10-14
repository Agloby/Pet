# Kern — Great White Shark Pet

Kern is a custom animated v2 ChatGPT Work pet: a confident, curious great white shark companion created for Armand OS.

The complete source and QA package is in [`Great White Shark`](./Great%20White%20Shark/). The validated upload atlas is:

`Great White Shark/work/final/spritesheet-extended.png`

Final motion previews are in:

`Great White Shark/work/qa/previews-final/`

The Google Drive source copy is preserved separately. The application is available in [`apps/desktop`](./apps/desktop/): milestone 1 renders Kern and persists a complete care interaction locally, milestone 2 adds authenticated offline-first sync, milestone 3 adds pet naming plus a high-resolution animated reef habitat, milestone 4 adds a production PostgreSQL service and containerized deployment, and milestone 5 adds configurable cross-device browser care alerts. Native iPhone and Garmin clients remain future milestones.

Run the desktop prototype with:

```bash
cd apps/desktop
npm run dev
```

Production deployment and recovery instructions are in [`docs/milestone-4-deployment.md`](./docs/milestone-4-deployment.md).
Milestone 5 notification behavior and acceptance checks are in [`docs/milestone-5-notifications.md`](./docs/milestone-5-notifications.md).

Kern is active in ChatGPT Work under stable pet ID `pet_6ac7d43b4cfc8191bbf594d64a231d55`.
