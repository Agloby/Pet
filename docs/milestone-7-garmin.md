# Milestone 7 Garmin companion

Milestone 7 adds a Garmin Connect IQ watch app and a dedicated least-privilege pairing API. It is independent of the deferred Apple Developer Program work.

## Included

- Fenix 7 Connect IQ watch app with vector-rendered reef, pet mood, fullness, and cached offline state.
- SELECT-button snack action and MENU-button refresh.
- Signed, single-use pairing codes that expire after ten minutes.
- Random watch-only bearer tokens; only their SHA-256 hashes are stored server-side.
- Re-pairing replaces the earlier token for the same watch client.
- Signed-in web controls to create/copy a pairing code, list paired watches, and revoke access.
- PostgreSQL and local JSON persistence, capped at five watches per account.
- Server action deduplication shared with browser and iPhone clients.
- API and security tests plus source-contract CI for the Garmin project.

## API boundary

The browser-session routes are `GET /api/garmin/devices`, `POST /api/garmin/pairing-codes`, and `DELETE /api/garmin/devices`. The watch routes are `POST /api/garmin/pair`, `GET /api/garmin/pet`, and `POST /api/garmin/actions`.

The raw watch token is returned only during a successful code exchange. It is not placed in logs, database rows, public device responses, or the repository. Revoking a paired device removes the only accepted hash, immediately invalidating that watch token.

## Acceptance check

1. Confirm `/api/health` returns HTTP 200, healthy storage, and `"version": 7`.
2. Sign into Kern on the web, open sync settings, and create a Garmin pairing code.
3. Confirm the code has a stated expiry and can be copied.
4. Follow `apps/garmin/README.md` to run Kern on a Fenix 7 simulator and enter the code.
5. Confirm the watch shows the same name, mood, and fullness as the web app.
6. Press SELECT once. Refresh the web app and confirm the care count rises by one, not more.
7. Close the service or disable the simulator network and confirm the watch retains the last successful state with an offline message.
8. Remove the watch in web sync settings and confirm the next watch refresh asks to pair again.
9. Run `npm test` in both `apps/desktop` and `apps/garmin`.

Garmin Connect IQ Store publication, expanded device families, and scheduled watch notifications are later release work. The current app refreshes on open or user request; it does not claim background delivery while closed.
