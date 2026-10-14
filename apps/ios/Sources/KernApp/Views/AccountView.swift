import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var companion: CompanionStore
    @Environment(\.dismiss) private var dismiss
    @State private var username = ""
    @State private var password = ""
    @State private var createAccount = false

    var body: some View {
        NavigationStack {
            Form {
                if companion.isSignedIn { signedInContent } else { signInContent }
            }
            .navigationTitle("Reef account")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var signInContent: some View {
        Section {
            Picker("Mode", selection: $createAccount) {
                Text("Sign in").tag(false)
                Text("Create account").tag(true)
            }
            .pickerStyle(.segmented)
            TextField("Username", text: $username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField("Password", text: $password)
            Button(createAccount ? "Create reef account" : "Sign in") {
                Task { await companion.authenticate(username: username, password: password, createAccount: createAccount) }
            }
            .disabled(companion.isBusy)
        } header: {
            Text("Sync across devices")
        } footer: {
            Text("Your session is protected in this iPhone’s Keychain. Care actions made offline sync when the reef is reachable.")
        }
    }

    @ViewBuilder
    private var signedInContent: some View {
        Section("Account") {
            LabeledContent("Signed in as", value: companion.accountName)
            LabeledContent("Offline actions", value: "\(companion.pendingActionCount)")
            Button("Sync now") { Task { await companion.refresh() } }
        }

        Section {
            LabeledContent("Server support", value: companion.nativePushAvailable ? "Ready" : "Needs APNs setup")
            LabeledContent("This iPhone", value: companion.pushEnabled ? "Enabled" : "Not enabled")
            Button(companion.pushEnabled ? "Register again" : "Enable care reminders") {
                Task { await companion.enableNotifications() }
            }
            .disabled(!companion.nativePushAvailable)
            Button("Send test notification") {
                Task { await companion.sendTestNotification() }
            }
            .disabled(!companion.pushEnabled)
        } header: {
            Text("Care reminders")
        } footer: {
            Text("Kern can send an alert when fullness drops below the care threshold. Scheduled delivery requires an always-on server.")
        }

        Section {
            Button("Sign out", role: .destructive) {
                Task { await companion.signOut() }
            }
        }
    }
}
