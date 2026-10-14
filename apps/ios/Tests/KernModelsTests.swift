import XCTest
@testable import Kern

final class KernModelsTests: XCTestCase {
    func testCareStateMatchesTheSharedProductRules() {
        let start = Date(timeIntervalSince1970: 1_760_443_200)
        let later = start.addingTimeInterval(6 * 3_600)
        let original = PetState.fresh(at: start)
        let decayed = original.advanced(to: later)

        XCTAssertEqual(decayed.fullness, 50, accuracy: 0.001)
        XCTAssertEqual(decayed.happiness, 69.5, accuracy: 0.001)

        let fed = decayed.fed(at: later)
        XCTAssertEqual(fed.fullness, 74, accuracy: 0.001)
        XCTAssertEqual(fed.happiness, 78.5, accuracy: 0.001)
        XCTAssertEqual(fed.bond, 1)
        XCTAssertEqual(fed.careCount, 1)
        XCTAssertEqual(fed.journal.count, 1)
    }

    func testRenamePreservesCareProgress() {
        let start = Date(timeIntervalSince1970: 1_760_443_200)
        let fed = PetState.fresh(at: start).fed(at: start)
        let renamed = fed.renamed("  Mako   Blue  ", at: start)

        XCTAssertEqual(renamed.name, "Mako Blue")
        XCTAssertTrue(renamed.named)
        XCTAssertEqual(renamed.careCount, fed.careCount)
        XCTAssertEqual(renamed.bond, fed.bond)
    }

    func testOfflineQueuePersistsAndDeduplicates() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let file = directory.appendingPathComponent("queue.json")
        let action = PendingAction.snack(accountId: "account-1")
        let first = OfflineActionQueue(fileURL: file)
        try await first.enqueue(action)
        try await first.enqueue(action)

        let firstCount = await first.count(for: "account-1")
        XCTAssertEqual(firstCount, 1)
        let restored = OfflineActionQueue(fileURL: file)
        let restoredActions = await restored.pending(for: "account-1")
        XCTAssertEqual(restoredActions, [action])
        try await restored.remove(id: action.id)
        let finalCount = await restored.count(for: "account-1")
        XCTAssertEqual(finalCount, 0)
        try? FileManager.default.removeItem(at: directory)
    }
}
