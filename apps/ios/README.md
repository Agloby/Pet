# Kern for iPhone

Milestone 6 is Kern's native SwiftUI companion. It shares the production sync API with the web app, stores the session in Keychain, applies care optimistically, queues actions while offline, registers with APNs for native reminders, and publishes the latest care state to a WidgetKit widget.

## Open the project

Requirements: macOS, Xcode 16 or later, and [XcodeGen](https://github.com/yonaskolb/XcodeGen).

```bash
brew install xcodegen
cd apps/ios
xcodegen generate
open Kern.xcodeproj
```

Select the **Kern** scheme and an iPhone running iOS 17 or later. The default API is `https://kern-reef-companion.onrender.com`.

## Signing configuration

Edit `Config/Shared.xcconfig` for your Apple Developer account:

```text
DEVELOPMENT_TEAM = YOUR_TEAM_ID
KERN_APP_BUNDLE_ID = com.yourcompany.kern
KERN_WIDGET_BUNDLE_ID = com.yourcompany.kern.widget
```

Use the same app bundle ID for the server's `KERN_APNS_BUNDLE_ID`. In Certificates, Identifiers & Profiles, enable **Push Notifications** and the **App Groups** capability for both targets. If the app-group identifier changes, update both entitlements and `KernConstants.appGroup`.

## API and APNs environments

Override the server URL without editing Swift by changing `KERN_API_BASE_URL` in `Config/Shared.xcconfig`. Debug builds register sandbox APNs tokens; Release/TestFlight builds register production tokens. Configure the server to match:

- local debug server: `KERN_APNS_ENVIRONMENT=sandbox`
- Render/TestFlight: `KERN_APNS_ENVIRONMENT=production`

Never commit an Apple `.p8` key. Store its text in the hosting provider's secret environment variable.

## Test

Generate the project, then run Product → Test in Xcode, or:

```bash
xcodebuild test -project Kern.xcodeproj -scheme Kern -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

The simulator validates the app, offline queue, widget, and shared care rules. APNs delivery requires a signed build on a physical iPhone.

