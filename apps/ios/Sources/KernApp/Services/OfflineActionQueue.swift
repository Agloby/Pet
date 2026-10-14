import Foundation

actor OfflineActionQueue {
    private let fileURL: URL
    private var actions: [PendingAction]

    init(fileURL: URL? = nil) {
        let resolvedURL = fileURL ?? Self.defaultURL()
        self.fileURL = resolvedURL
        actions = (try? Data(contentsOf: resolvedURL))
            .flatMap { try? JSONDecoder().decode([PendingAction].self, from: $0) } ?? []
    }

    func enqueue(_ action: PendingAction) throws {
        guard !actions.contains(where: { $0.id == action.id }) else { return }
        actions.append(action)
        try persist()
    }

    func pending(for accountId: String) -> [PendingAction] {
        actions.filter { $0.accountId == accountId }
    }

    func remove(id: String) throws {
        actions.removeAll { $0.id == id }
        try persist()
    }

    func count(for accountId: String) -> Int {
        actions.count { $0.accountId == accountId }
    }

    private func persist() throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try JSONEncoder().encode(actions).write(to: fileURL, options: .atomic)
    }

    private static func defaultURL() -> URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return root.appendingPathComponent("Kern", isDirectory: true)
            .appendingPathComponent("pending-actions.json")
    }
}
