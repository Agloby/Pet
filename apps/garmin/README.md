# Kern for Garmin Connect IQ

This Milestone 7 watch app shows Kern's current mood, fullness, and bond state, keeps the last successful state available offline, and lets the wearer share one snack with the SELECT button. MENU refreshes the state.

The watch never receives the Kern username, password, or browser session token. A signed-in browser creates a one-time 10-minute pairing code. The watch exchanges it for a revocable, watch-only token whose hash is stored by the Kern service.

## Install the toolchain on Windows

1. Open <https://developer.garmin.com/connect-iq/sdk/> and download **Connect IQ SDK Manager**.
2. Run the installer, open **SDK Manager**, select the newest stable Connect IQ SDK, and click **Download**.
3. In Visual Studio Code, open **Extensions**, search for **Monkey C**, and install Garmin's extension.
4. Open this `apps/garmin` folder in Visual Studio Code.
5. Press `Ctrl+Shift+P`, run **Monkey C: Verify Installation**, and choose the SDK downloaded in step 2.
6. Press `Ctrl+Shift+P`, run **Monkey C: Generate a Developer Key**, and save the key outside this repository. The key is local signing material and must not be committed.

## Configure and run in the simulator

1. Open `resources/settings/properties.xml`.
2. Replace `https://your-kern-service.onrender.com/api` with the public HTTPS URL of the live Kern service followed by `/api`. Do not add another trailing slash.
3. Run `npm.cmd test` in this folder to validate the project contract.
4. Press `F5` in Visual Studio Code, select **fenix7**, and wait for the Connect IQ simulator to open Kern.
5. The first screen asks for a pairing code. Leave the simulator open.
6. In the Kern web app, sign in, click the sync status at the top right, scroll to **Garmin Connect IQ**, and click **Create pairing code**.
7. Copy the entire code. In the Connect IQ app settings for the simulator, paste it into **One-time pairing code** and save.
8. Reopen Kern in the simulator or press MENU to retry. The watch should show the same pet name and fullness as the web app.
9. Press SELECT. Confirm the watch says **Snack shared!**, then refresh the web app and verify the care count increased only once.

The exact simulator settings menu label can vary by SDK release. If the settings UI is unavailable, temporarily paste the code into the `pairingCode` property in `properties.xml`, run once, then immediately restore that property to empty. Never commit a live code; it expires in ten minutes and is single-use.

## Install on a physical Fenix 7

1. Pair the watch with the Garmin Connect mobile app.
2. Build or sideload Kern using Garmin's documented developer workflow. Connect IQ Store publication is a separate Garmin review step and is not required for a personal test.
3. In Garmin Connect, tap **More** → **Garmin Devices** → your watch → **Activities, Apps & More** → **Activities & Apps** → **Kern** → **Settings**.
4. Enter the production Kern service URL followed by `/api`.
5. In the Kern web app, create a fresh pairing code and paste it into **One-time pairing code**. Tap **Save**.
6. Open Kern on the watch. Confirm the pet state loads, then press SELECT to share a snack.
7. To revoke the watch, open Kern web sync settings and click **Remove** beside the device. Its next request will require pairing again.

## Local compile command

The repository includes `scripts/build.sh` for a machine with the Garmin SDK. Set `CONNECTIQ_HOME` to the SDK directory and `GARMIN_DEVELOPER_KEY` to the private key, then run the script. `GARMIN_DEVICE` defaults to `fenix7`.

The cloud CI check validates resources, routes, credential boundaries, and source structure. It does not claim a Garmin compiler build because Garmin's licensed SDK and a private developer key are not present in the GitHub runner. Run the Fenix 7 simulator check before sideloading or Store submission.
