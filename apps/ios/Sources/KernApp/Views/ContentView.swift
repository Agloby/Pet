import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var companion: CompanionStore
    @State private var showAccount = false
    @State private var showRename = false
    @State private var newName = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.015, green: 0.10, blue: 0.15).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 18) {
                        header
                        ReefSceneView(pet: companion.pet)
                            .frame(height: 390)
                            .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 30, style: .continuous)
                                    .stroke(.cyan.opacity(0.22), lineWidth: 1)
                            }
                        stats
                        snackButton
                        recentMoment
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 30)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAccount = true } label: {
                        Image(systemName: companion.isSignedIn ? "person.crop.circle.fill.badge.checkmark" : "person.crop.circle")
                            .font(.title2)
                    }
                    .accessibilityLabel("Account and settings")
                }
            }
            .sheet(isPresented: $showAccount) { AccountView() }
            .alert("Name your companion", isPresented: $showRename) {
                TextField("Name", text: $newName)
                Button("Save") { Task { await companion.renamePet(newName) } }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Choose a name up to 24 characters.")
            }
            .alert("Kern", isPresented: messageBinding) {
                Button("OK", role: .cancel) { companion.message = nil }
            } message: {
                Text(companion.message ?? "")
            }
            .refreshable { await companion.refresh() }
        }
        .tint(Color(red: 0.37, green: 0.88, blue: 0.84))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("MILESTONE 06 · POCKET REEF")
                .font(.caption.weight(.bold))
                .tracking(2)
                .foregroundStyle(.cyan)
            HStack(alignment: .firstTextBaseline) {
                Text("\(companion.pet.name) is")
                    .font(.system(size: 40, weight: .medium, design: .serif))
                Text(companion.pet.moodLabel)
                    .font(.system(size: 40, weight: .medium, design: .serif).italic())
                    .foregroundStyle(Color(red: 0.58, green: 0.94, blue: 0.90))
            }
            .minimumScaleFactor(0.65)
            .lineLimit(2)
            Button("Rename companion") {
                newName = companion.pet.name
                showRename = true
            }
            .font(.subheadline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var stats: some View {
        HStack(spacing: 12) {
            StatCard(title: "Fullness", value: companion.pet.fullness, icon: "fork.knife")
            StatCard(title: "Happiness", value: companion.pet.happiness, icon: "sparkles")
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "link").foregroundStyle(.cyan)
                Text(companion.pet.bondLabel).font(.subheadline.weight(.semibold))
                Text("\(companion.pet.bond) bond").font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
            .padding(12)
            .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 18))
        }
    }

    private var snackButton: some View {
        Button {
            Task { await companion.shareSnack() }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "sparkle")
                    .font(.title3.weight(.bold))
                    .frame(width: 42, height: 42)
                    .background(.white.opacity(0.35), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text("Share a snack").font(.headline)
                    Text(companion.pendingActionCount > 0 ? "Saved offline · sync pending" : "Build trust and refill the belly")
                        .font(.caption)
                        .opacity(0.72)
                }
                Spacer()
                Image(systemName: "arrow.right")
            }
            .foregroundStyle(Color(red: 0.01, green: 0.13, blue: 0.18))
            .padding(14)
            .background(Color(red: 0.39, green: 0.86, blue: 0.82), in: RoundedRectangle(cornerRadius: 22))
        }
        .buttonStyle(.plain)
    }

    private var recentMoment: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("RECENT MOMENT").font(.caption.weight(.bold)).tracking(1.4).foregroundStyle(.cyan)
            Text(companion.pet.journal.first?.message ?? "The reef is quiet. Share a snack to make your first memory.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.82))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 20))
    }

    private var messageBinding: Binding<Bool> {
        Binding(get: { companion.message != nil }, set: { if !$0 { companion.message = nil } })
    }
}

private struct StatCard: View {
    let title: String
    let value: Double
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: icon).foregroundStyle(.cyan)
            Text("\(Int(value.rounded()))%").font(.title3.weight(.bold)).monospacedDigit()
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
        .padding(12)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 18))
    }
}
