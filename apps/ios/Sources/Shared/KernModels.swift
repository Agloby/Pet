import Foundation

enum KernConstants {
    static let appGroup = "group.com.agloby.kern"
    static let widgetSnapshotKey = "kern.widget.snapshot.v1"
}

struct JournalEntry: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let message: String
    let at: String
}

struct PetState: Codable, Equatable, Sendable {
    var version: Int
    var name: String
    var named: Bool
    var fullness: Double
    var happiness: Double
    var bond: Int
    var careCount: Int
    var lastUpdatedAt: String
    var lastFedAt: String?
    var journal: [JournalEntry]

    static func fresh(at date: Date = .now) -> PetState {
        let timestamp = ISO8601DateFormatter.kern.string(from: date)
        return PetState(
            version: 2,
            name: "Kern",
            named: false,
            fullness: 62,
            happiness: 74,
            bond: 0,
            careCount: 0,
            lastUpdatedAt: timestamp,
            lastFedAt: nil,
            journal: []
        )
    }

    func advanced(to date: Date = .now) -> PetState {
        guard let previous = ISO8601DateFormatter.kern.date(from: lastUpdatedAt) else { return self }
        let elapsedHours = max(0, date.timeIntervalSince(previous)) / 3_600
        guard elapsedHours > 0 else { return self }
        var next = self
        next.fullness = max(0, min(100, fullness - elapsedHours * 2))
        let hungerPenalty = next.fullness < 30 ? 0.9 : 0
        next.happiness = max(0, min(100, happiness - elapsedHours * (0.75 + hungerPenalty)))
        next.lastUpdatedAt = ISO8601DateFormatter.kern.string(from: date)
        return next
    }

    func fed(at date: Date = .now) -> PetState {
        var next = advanced(to: date)
        next.careCount += 1
        next.fullness = min(100, next.fullness + 24)
        next.happiness = min(100, next.happiness + 9)
        next.bond += 1
        let timestamp = ISO8601DateFormatter.kern.string(from: date)
        next.lastFedAt = timestamp
        next.lastUpdatedAt = timestamp
        next.journal.insert(
            JournalEntry(
                id: "\(Int(date.timeIntervalSince1970 * 1_000))-\(next.careCount)",
                message: next.careCount == 1
                    ? "You shared your first snack. \(next.name) is beginning to trust you."
                    : "\(next.name) caught the snack and circled back for a happy wave.",
                at: timestamp
            ),
            at: 0
        )
        next.journal = Array(next.journal.prefix(5))
        return next
    }

    func renamed(_ rawName: String, at date: Date = .now) -> PetState {
        let cleaned = rawName
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
        guard !cleaned.isEmpty else { return self }
        var next = advanced(to: date)
        next.name = String(cleaned.prefix(24))
        next.named = true
        next.lastUpdatedAt = ISO8601DateFormatter.kern.string(from: date)
        next.journal.insert(
            JournalEntry(
                id: "\(Int(date.timeIntervalSince1970 * 1_000))-name",
                message: "\(next.name) has a name and a place to call home.",
                at: next.lastUpdatedAt
            ),
            at: 0
        )
        next.journal = Array(next.journal.prefix(5))
        return next
    }

    var moodLabel: String {
        if fullness < 25 { return "getting hungry" }
        if happiness >= 88 && fullness >= 82 { return "making waves" }
        if careCount == 0 { return "curious about you" }
        return "happy to see you"
    }

    var bondLabel: String {
        if bond >= 12 { return "Trusted navigator" }
        if bond >= 6 { return "Reef companions" }
        if bond >= 2 { return "Getting acquainted" }
        if bond >= 1 { return "First connection" }
        return "New friends"
    }
}

struct Account: Codable, Equatable, Sendable {
    let id: String
    let username: String
}

struct SyncSession: Codable, Equatable, Sendable {
    let token: String
    let account: Account
}

struct AuthResponse: Codable, Sendable {
    let account: Account
    let token: String
    let petState: PetState
    let revision: Int
}

struct PetResponse: Codable, Sendable {
    let account: Account?
    let petState: PetState
    let revision: Int
}

struct ActionResponse: Codable, Sendable {
    let petState: PetState
    let revision: Int
    let duplicate: Bool
}

struct PendingAction: Codable, Equatable, Identifiable, Sendable {
    enum Kind: String, Codable, Sendable {
        case shareSnack = "share_snack"
        case renamePet = "rename_pet"
    }

    let id: String
    let accountId: String
    let type: Kind
    let occurredAt: String
    let name: String?

    static func snack(accountId: String, at date: Date = .now) -> PendingAction {
        PendingAction(
            id: UUID().uuidString,
            accountId: accountId,
            type: .shareSnack,
            occurredAt: ISO8601DateFormatter.kern.string(from: date),
            name: nil
        )
    }

    static func rename(accountId: String, name: String, at date: Date = .now) -> PendingAction {
        PendingAction(
            id: UUID().uuidString,
            accountId: accountId,
            type: .renamePet,
            occurredAt: ISO8601DateFormatter.kern.string(from: date),
            name: name
        )
    }
}

struct NotificationPreferences: Codable, Equatable, Sendable {
    let enabled: Bool
    let fullnessThreshold: Int
    let cooldownHours: Int
    let lastSentAt: String?
}

struct NotificationStateResponse: Codable, Sendable {
    let available: Bool
    let publicKey: String?
    let preferences: NotificationPreferences
    let subscriptionCount: Int
    let nativeDeviceCount: Int
    let nativePushAvailable: Bool
}

struct WidgetSnapshot: Codable, Equatable, Sendable {
    let name: String
    let fullness: Int
    let happiness: Int
    let mood: String
    let updatedAt: Date
}

enum WidgetSnapshotStore {
    static func write(_ pet: PetState) {
        let snapshot = WidgetSnapshot(
            name: pet.name,
            fullness: Int(pet.fullness.rounded()),
            happiness: Int(pet.happiness.rounded()),
            mood: pet.moodLabel,
            updatedAt: .now
        )
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults(suiteName: KernConstants.appGroup)?.set(data, forKey: KernConstants.widgetSnapshotKey)
    }

    static func read() -> WidgetSnapshot {
        guard
            let data = UserDefaults(suiteName: KernConstants.appGroup)?.data(forKey: KernConstants.widgetSnapshotKey),
            let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
        else {
            return WidgetSnapshot(name: "Kern", fullness: 62, happiness: 74, mood: "settling in", updatedAt: .now)
        }
        return snapshot
    }
}

extension ISO8601DateFormatter {
    static let kern: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
