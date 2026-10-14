# Milestone 5 care notifications

Milestone 5 adds opt-in Web Push reminders to the production reef companion. A signed-in user enables alerts separately on each browser and chooses when Kern should check in.

## User flow

1. Sign into a Kern sync profile.
2. Open the sync settings from the status button.
3. Under **Care reminders**, choose the fullness threshold and maximum reminder frequency.
4. Select **Enable alerts** and approve the browser permission prompt.
5. Select **Send test** to verify delivery.

Disabling alerts removes the current browser subscription. Signing out does the same automatically. Preferences and active subscriptions are stored with the account in PostgreSQL and follow the sync profile without exposing endpoint details to the client.

On iPhone and iPad, Web Push requires iOS/iPadOS 16.4 or later and an installed Home Screen web app. In Safari, use **Share → Add to Home Screen**, launch Kern from the new icon, sign in, and then enable alerts. Desktop Chrome, Edge, Firefox, and Safari can request permission directly when supported.

## Delivery behavior

- The server checks opted-in accounts every 15 minutes.
- Pet needs are advanced from the server-authoritative timestamp before a reminder decision.
- A reminder is due when fullness is at or below the selected threshold and the selected cooldown has elapsed.
- Delivery attempts are claimed transactionally so repeated sweeps do not send the same reminder.
- Push services returning `404` or `410` are removed automatically.
- Notification payloads contain the pet name and care message, never account credentials or state history.
- The stable VAPID key pair is derived with domain separation from `KERN_SYNC_SECRET`; the private key is never returned or logged.

Rotating `KERN_SYNC_SECRET` changes the derived VAPID identity as well as signing users out. After a rotation, users must sign in and enable alerts again on each browser.

The scheduler runs inside the Kern application process. The hosting plan must keep that process running for timely reminders. A plan that suspends idle web services can delay alerts until the next wake-up; use an always-on instance for production notification timing.

## Acceptance check

1. Open the deployed HTTPS application and sign in.
2. Enable alerts and send a test. Confirm the notification opens Kern when selected.
3. Change the fullness threshold or cooldown and reload. Confirm the choices persist.
4. Sign in from a second browser, enable alerts there, and confirm both devices are registered.
5. Disable alerts on one browser and confirm the other remains registered.
6. Sign out and confirm the current browser no longer receives tests.
7. Confirm `/api/health` reports the current API version (`6` after the native iPhone milestone), healthy PostgreSQL storage, and HTTP 200.
