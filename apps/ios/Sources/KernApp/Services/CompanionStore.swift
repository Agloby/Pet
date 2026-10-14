import Combine
import Foundation
import UIKit
import UserNotifications
import WidgetKit

@MainActor
final class CompanionStore: ObservableObject {
    @Published private(set) var pet = PetState.fresh()
    @Published private(set) var session: SyncSession?
    @Published private(set) var pendingActionCount = 0
    @Published private(set) var pushEnabled = false
    @Published private(set) var nativePushAvailable = false
    @Published private(set) var isBusy = false
    @Published var message: String?

    private let api: APIClient
    private let queue: OfflineActionQueue
    private let keychain: KeychainStore
    private var deviceToken: String?
    private var observers: [NSObjectProtocol] = []

    init(
        api: APIClient = APIClient(baseURL: AppConfiguration.apiBaseURL),
        queue: OfflineActionQueue = OfflineActionQueue(),
        keychain: KeychainStore = KeychainStore()
    ) {
        self.api = api
        self.queue = queue
        self.keychain = keychain
        observers.append(NotificationCenter.default.addObserver(
            forName: .kernDeviceToken,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let token = notification.object as? String else { return }
            Task { @MainActor in await self?.registerDeviceToken(token) }
        })
        observers.append(NotificationCenter.default.addObserver(
            forName: .kernPushRegistrationFailed,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor in
                self?.message = notification.object as? String ?? "This iPhone could not register for notifications."
            }
        })
        Task { await restore() }
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    var isSignedIn: Bool { session != nil }
    var accountName: String { session?.account.username ?? "Local companion" }

    func restore() async {
        guard let restored = keychain.load() else {
            publishSnapshot()
            return
        }
        session = restored
        await api.setToken(restored.token)
        await refresh()
    }

    func authenticate(username: String, password: String, createAccount: Bool) async {
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              password.count >= 8 else {
            message = "Enter a username and a password of at least 8 characters."
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let response = try await (createAccount
                ? api.register(username: username, password: password, initialState: pet)
                : api.login(username: username, password: password))
            let newSession = SyncSession(token: response.token, account: response.account)
            try keychain.save(newSession)
            session = newSession
            pet = response.petState
            await api.setToken(response.token)
            await updatePendingCount()
            await refreshNotificationState()
            publishSnapshot()
            message = createAccount ? "Your reef account is ready." : "Welcome back to the reef."
        } catch {
            message = error.localizedDescription
        }
    }

    func shareSnack() async {
        let now = Date()
        pet = pet.fed(at: now)
        publishSnapshot()
        guard let accountId = session?.account.id else {
            message = "Snack shared locally. Sign in to keep it in sync."
            return
        }
        let action = PendingAction.snack(accountId: accountId, at: now)
        do {
            try await queue.enqueue(action)
            await updatePendingCount()
            await flushQueue()
        } catch {
            message = "The snack could not be saved for sync."
        }
    }

    func renamePet(_ name: String) async {
        let cleaned = name.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        let containsControlCharacter = cleaned.unicodeScalars.contains {
            CharacterSet.controlCharacters.contains($0)
        }
        guard (1...24).contains(cleaned.count), !containsControlCharacter else {
            message = "Choose a name between 1 and 24 characters."
            return
        }
        let now = Date()
        pet = pet.renamed(cleaned, at: now)
        publishSnapshot()
        guard let accountId = session?.account.id else {
            message = "Name saved on this iPhone. Sign in to sync it."
            return
        }
        do {
            try await queue.enqueue(.rename(accountId: accountId, name: cleaned, at: now))
            await updatePendingCount()
            await flushQueue()
        } catch {
            message = "The name could not be saved for sync."
        }
    }

    func refresh() async {
        guard session != nil else { return }
        await flushQueue()
        do {
            let response = try await api.pet()
            pet = response.petState.advanced()
            publishSnapshot()
            await refreshNotificationState()
        } catch KernAPIError.offline {
            message = pendingActionCount > 0
                ? "Offline — \(pendingActionCount) care action(s) will sync later."
                : "Offline — showing the last reef state."
        } catch {
            message = error.localizedDescription
        }
    }

    func enableNotifications() async {
        guard session != nil else {
            message = "Sign in before enabling care reminders."
            return
        }
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else {
                message = "Notifications are disabled. You can enable them in iPhone Settings."
                return
            }
            UIApplication.shared.registerForRemoteNotifications()
            message = "Registering this iPhone for care reminders…"
        } catch {
            message = "Notification permission could not be requested."
        }
    }

    func sendTestNotification() async {
        do {
            _ = try await api.sendTestNotification()
            message = "Test sent. It may take a few seconds to arrive."
        } catch {
            message = error.localizedDescription
        }
    }

    func signOut() async {
        if let deviceToken {
            _ = try? await api.removeNativeDevice(token: deviceToken)
        }
        keychain.clear()
        await api.setToken(nil)
        session = nil
        pushEnabled = false
        nativePushAvailable = false
        pendingActionCount = 0
        message = "Signed out. Your local companion is still here."
    }

    private func flushQueue() async {
        guard let accountId = session?.account.id else { return }
        for action in await queue.pending(for: accountId) {
            do {
                let response = try await api.apply(action)
                pet = response.petState
                try await queue.remove(id: action.id)
            } catch KernAPIError.offline {
                break
            } catch KernAPIError.server(_, let status) where status == 401 {
                message = "Your session expired. Sign in again to sync."
                break
            } catch {
                message = error.localizedDescription
                break
            }
        }
        await updatePendingCount()
        publishSnapshot()
    }

    private func updatePendingCount() async {
        guard let accountId = session?.account.id else {
            pendingActionCount = 0
            return
        }
        pendingActionCount = await queue.count(for: accountId)
    }

    private func refreshNotificationState() async {
        guard session != nil else { return }
        do {
            let state = try await api.notificationState()
            nativePushAvailable = state.nativePushAvailable
            pushEnabled = state.preferences.enabled && state.nativeDeviceCount > 0
        } catch {
            // Notification state is helpful but should never block pet sync.
        }
    }

    private func registerDeviceToken(_ token: String) async {
        deviceToken = token
        guard session != nil else { return }
        do {
            let state = try await api.registerNativeDevice(
                token: token,
                environment: AppConfiguration.apnsEnvironment
            )
            nativePushAvailable = state.nativePushAvailable
            pushEnabled = state.preferences.enabled && state.nativeDeviceCount > 0
            message = "Care reminders are on for this iPhone."
        } catch {
            message = error.localizedDescription
        }
    }

    private func publishSnapshot() {
        WidgetSnapshotStore.write(pet)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

extension Notification.Name {
    static let kernDeviceToken = Notification.Name("kern.device-token")
}

