import SwiftUI
import WidgetKit

struct KernTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> KernEntry {
        KernEntry(date: .now, snapshot: WidgetSnapshotStore.read())
    }

    func getSnapshot(in context: Context, completion: @escaping (KernEntry) -> Void) {
        completion(KernEntry(date: .now, snapshot: WidgetSnapshotStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KernEntry>) -> Void) {
        let entry = KernEntry(date: .now, snapshot: WidgetSnapshotStore.read())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60))))
    }
}

struct KernEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct KernWidgetView: View {
    let entry: KernEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.02, green: 0.19, blue: 0.26), Color(red: 0.01, green: 0.08, blue: 0.13)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: 8) {
                Text(entry.snapshot.name.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(1.5)
                    .foregroundStyle(.cyan)
                Text(entry.snapshot.mood.capitalized)
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Label("\(entry.snapshot.fullness)% full", systemImage: "fork.knife")
                Label("\(entry.snapshot.happiness)% happy", systemImage: "sparkles")
            }
            .font(.caption)
            .foregroundStyle(.white.opacity(0.82))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(4)
        }
        .containerBackground(for: .widget) { Color(red: 0.01, green: 0.10, blue: 0.15) }
    }
}

struct KernStatusWidget: Widget {
    let kind = "KernStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: KernTimelineProvider()) { entry in
            KernWidgetView(entry: entry)
        }
        .configurationDisplayName("Kern’s reef")
        .description("Keep fullness, happiness, and mood in view.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct KernWidgetBundle: WidgetBundle {
    var body: some Widget {
        KernStatusWidget()
    }
}
