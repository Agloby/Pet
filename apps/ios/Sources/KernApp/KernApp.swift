import SwiftUI

@main
struct KernApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var companion = CompanionStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(companion)
                .preferredColorScheme(.dark)
        }
    }
}
