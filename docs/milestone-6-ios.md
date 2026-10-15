# Milestone 6 native iPhone companion

Milestone 6 adds a native SwiftUI app and WidgetKit extension while keeping the existing Kern account and care state authoritative on the shared production API.

## Included

- Native animated reef with Kern, fish, turtle, bubbles, layered habitat drift, and Reduce Motion support.
- Snack and rename actions with immediate local feedback.
- Ordered, persistent offline action queue with server-side action deduplication on replay.
- Sync session stored in the iOS Keychain.
- APNs device registration, removal on sign-out, reminder status, and test-delivery controls.
- Home Screen widget for current mood, fullness, and happiness.
- XcodeGen project definition and a macOS CI build/test workflow.
- PostgreSQL migration for APNs device tokens without discarding existing accounts or Web Push subscriptions.

## Server configuration for native notifications

The web service continues to start without APNs, but the iPhone UI reports that native push support needs setup. Add all of these secrets/settings to Render to enable it:

| Variable | Value |
| --- | --- |
| `KERN_APNS_KEY_ID` | Key ID shown for the Apple Push Notifications authentication key. |
| `KERN_APNS_TEAM_ID` | Apple Developer Team ID. |
| `KERN_APNS_PRIVATE_KEY` | Complete contents of the downloaded `.p8` file. Escaped `\\n` newlines are accepted. |
| `KERN_APNS_BUNDLE_ID` | Exact iPhone app bundle ID, default `com.agloby.kern`. |
| `KERN_APNS_ENVIRONMENT` | `production` for TestFlight/App Store or `sandbox` for local Debug builds. |

The API rejects a partial APNs configuration. Device tokens are scoped to sandbox or production, capped per account, excluded from logs and API responses, and removed after APNs reports them invalid or unregistered.

## Acceptance check

1. Confirm `/api/health` returns HTTP 200, the current API version (`7` after the Garmin milestone), and healthy storage.
2. Generate the project with `xcodegen generate`; build and run the Kern scheme on an iPhone.
3. Create or sign into the same Kern profile used on the web app. Confirm name and care state match.
4. Turn off network access, share a snack, and confirm the UI changes and shows a pending action.
5. Restore the network and pull to refresh. Confirm the pending count returns to zero and the web app shows the same state.
6. Rename the companion and confirm the name syncs across native and web clients.
7. Add the Kern widget and confirm it displays the latest mood and care values.
8. On a physical signed iPhone, enable care reminders and send a test. Background the app and confirm the alert arrives and opens Kern.
9. Sign out and confirm the iPhone device registration is removed.

TestFlight distribution and APNs delivery require the repository owner's Apple Developer team, bundle identifiers, signing profile, and APNs key. Those credentials intentionally remain outside Git.

