import SwiftUI

struct ReefSceneView: View {
    let pet: PetState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : 1 / 30)) { timeline in
            let seconds = timeline.date.timeIntervalSinceReferenceDate
            ZStack {
                Image("reef-habitat")
                    .resizable()
                    .scaledToFill()
                    .scaleEffect(1.06)
                    .offset(x: reduceMotion ? 0 : sin(seconds * 0.06) * 12)

                LinearGradient(
                    colors: [.clear, Color(red: 0.01, green: 0.12, blue: 0.18).opacity(0.45)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                Image("reef-fish")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 104)
                    .opacity(0.65)
                    .offset(
                        x: reduceMotion ? 110 : cos(seconds * 0.12) * 145,
                        y: -88 + sin(seconds * 0.2) * 14
                    )

                Image("sea-turtle")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 126)
                    .opacity(0.72)
                    .offset(
                        x: reduceMotion ? -120 : sin(seconds * 0.08) * 155,
                        y: 96 + cos(seconds * 0.13) * 12
                    )

                ForEach(0..<8, id: \.self) { index in
                    Bubble(
                        x: bubbleX(index, seconds: seconds),
                        y: bubbleY(index, seconds: seconds),
                        size: CGFloat(5 + index % 4 * 3)
                    )
                }

                Image("kern-hd")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 390)
                    .shadow(color: .black.opacity(0.34), radius: 20, y: 12)
                    .rotationEffect(.degrees(reduceMotion ? 0 : sin(seconds * 0.9) * 1.6))
                    .scaleEffect(x: 1, y: reduceMotion ? 1 : 1 + cos(seconds * 1.2) * 0.012)
                    .offset(
                        x: reduceMotion ? 0 : sin(seconds * 0.42) * 20,
                        y: reduceMotion ? 12 : 12 + cos(seconds * 0.64) * 11
                    )
                    .accessibilityLabel("\(pet.name), a great white shark, swimming in the reef")
            }
        }
        .clipped()
        .background(Color(red: 0.01, green: 0.12, blue: 0.18))
    }

    private func bubbleX(_ index: Int, seconds: Double) -> CGFloat {
        guard !reduceMotion else { return CGFloat(index * 41 - 140) }
        return CGFloat(index * 49 - 170) + sin(seconds * 0.7 + Double(index)) * 9
    }

    private func bubbleY(_ index: Int, seconds: Double) -> CGFloat {
        guard !reduceMotion else { return CGFloat(index * 24 - 90) }
        let travel = (seconds * Double(15 + index % 3 * 4) + Double(index * 61))
            .truncatingRemainder(dividingBy: 360)
        return CGFloat(190 - travel)
    }
}

private struct Bubble: View {
    let x: CGFloat
    let y: CGFloat
    let size: CGFloat

    var body: some View {
        Circle()
            .stroke(Color.cyan.opacity(0.35), lineWidth: 1)
            .background(Circle().fill(.white.opacity(0.05)))
            .frame(width: size, height: size)
            .offset(x: x, y: y)
            .accessibilityHidden(true)
    }
}
