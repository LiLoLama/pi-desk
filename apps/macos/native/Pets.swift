import AppKit
import Combine
import SwiftUI

@MainActor final class PetPreferences: ObservableObject {
  static let shared = PetPreferences()
  @Published var enabled: Bool {
    didSet { UserDefaults.standard.set(enabled, forKey: "pet.enabled") }
  }
  @Published var species: String {
    didSet { UserDefaults.standard.set(species, forKey: "pet.species") }
  }
  @Published var size: Double { didSet { UserDefaults.standard.set(size, forKey: "pet.size") } }
  init() {
    let d = UserDefaults.standard
    enabled = d.object(forKey: "pet.enabled") as? Bool ?? true
    let s = d.string(forKey: "pet.species") ?? "miso"
    species = ["miso", "pip", "kumo"].contains(s) ? s : "miso"
    let n = d.double(forKey: "pet.size")
    size = [0.8, 1.0, 1.3].contains(n) ? n : 1.0
  }
  var name: String { species == "pip" ? "Pip" : species == "kumo" ? "Kumo" : "Miso" }
}

struct PetOptions: View {
  @ObservedObject var prefs = PetPreferences.shared
  var body: some View {
    Button(prefs.enabled ? "Pet schlafen legen" : "Pet aufwecken") { prefs.enabled.toggle() }
    Divider()
    Picker("Begleiter", selection: $prefs.species) {
      Text("Miso · Katze").tag("miso")
      Text("Pip · Fuchs").tag("pip")
      Text("Kumo · Wolke").tag("kumo")
    }
    Picker("Größe", selection: $prefs.size) {
      Text("Klein").tag(0.8)
      Text("Mittel").tag(1.0)
      Text("Groß").tag(1.3)
    }
    Divider()
    Button("Zurück an den Bildschirmrand") { PetWindow.shared.resetPosition() }
  }
}

/// Original pixel artwork; crisp vector cells, no remote assets or rendering engine.
struct PetSprite: View {
  let species: String
  let mood: PetActivity.Mood
  let time: Double
  let still: Bool
  private var rows: [String] {
    if species == "kumo" {
      return [
        "........................", ".........oooooo.........", ".......ooaaaaaaoo.......",
        ".....ooaaahhaaaaaoo.....", "....oaaaahhhaaaaaaao....", "...oaaaahhhaaaaaaaaao...",
        "...oaaaaaaaaaaaaaaaao...", "..oaaaaaaaaaaaaaaaaaao..", "..oaaaaaaaaaaaaaaaaaao..",
        "..oaaaaaeaaaaaaeaaaaao..", "..oaaaaaeaaaaaaeaaaaao..",
        "..oaaabbaammaabbaa aaao..".replacingOccurrences(of: " ", with: ""),
        "...oaaaaaaaaaaaaaaaao...", "...oaaaaaaaaaaaaaaaao...", "....oaaaaaaaaaaaaaao....",
        ".....ooaaooaaaooaao.....", ".......oo..ooo..oo......", "........................",
      ]
    }
    if species == "pip" {
      return [
        "....oo............oo....", "...oaao..........oaao...", "...oabbaooooooooabbao...",
        "...oabaaaaaaaaaaaabao...", "...oaaaaaaaaaaaaaaaao...", "..oaaaaaaaaaaaaaaaaaao..",
        "..oaaaaaeaaaaaaeaaaaao..", "..oaaaaaeaaaaaaeaaaaao..", "...oaahhhhaaaahhhhaao...",
        "...oahhhhhhmhhhhhhhao...", "....oahhhhhhhhhhhhao....", ".....ooahhhhhhhaoo......",
        ".......oaaaaaaaao.......", "......oaahhhhaaaao..oo..", "......oaahhhhaaaaaooaao.",
        "......oaahhhhaaaaaahhho.", ".......ooooooooooooooo..", ".......oo..oo..oo.......",
      ]
    }
    return [
      "....oo..........oo......", "...oaao........oaao.....", "...oabbaooooooabbao.....",
      "...oabaaaaaaaaabao......", "...oaaaaaaaaaaaaao......", "..oaaaaaaaaaaaaaaao.....",
      "..oaaaaeaaaaaeaaaao.....", "..oaaaaeaaaaaeaaaao.....", "..oaabbaamaabbaaao......",
      "...oaaaaamaaaaaao.......", "....ooaaaaaaaaoo........", "......oaaaaaaao.........",
      ".....oaahhhaaaao....oo..", ".....oaahhhaaaao...oaao.", ".....oaahhhaaaaaoooaao..",
      "......oaaaaaaaaaaaao....", "......ooooooooooooo.....", "......ooo.....ooo.......",
    ]
  }
  var body: some View {
    Canvas { context, size in
      let unit = min(size.width / 24, size.height / 19)
      let body: Color =
        species == "pip"
        ? Color(red: 0.87, green: 0.51, blue: 0.29)
        : species == "kumo"
          ? Color(red: 0.64, green: 0.78, blue: 0.73) : Color(red: 0.83, green: 0.79, blue: 0.66)
      let blink = !still && time.truncatingRemainder(dividingBy: 5.5) > 5.25
      let palette: [Character: Color] = [
        "o": Color(red: 0.20, green: 0.23, blue: 0.24), "a": body,
        "h": Color(red: 0.94, green: 0.90, blue: 0.78),
        "b": Color(red: 0.86, green: 0.58, blue: 0.56),
        "e": Color(red: 0.17, green: 0.20, blue: 0.21),
        "m": Color(red: 0.43, green: 0.34, blue: 0.33),
      ]
      for (y, row) in rows.enumerated() {
        for (x, c) in row.enumerated() {
          if let color = palette[c] {
            let closed = (blink || mood == .disconnected) && c == "e"
            let rect = CGRect(
              x: Double(x) * unit, y: Double(y) * unit + (closed ? unit * 0.65 : 0),
              width: unit + 0.1, height: closed ? unit * 0.35 : unit + 0.1)
            context.fill(Path(rect), with: .color(color))
          }
        }
      }
    }.frame(width: 120, height: 95)
      .rotationEffect(.degrees(!still && mood == .waiting ? -5 : 0))
      .offset(
        y: still
          ? 0
          : mood == .working ? sin(time * 5) * 2 : mood == .finished ? -abs(sin(time * 7)) * 7 : 0
      )
      .accessibilityHidden(true)
  }
}

@MainActor final class PetWindow {
  static let shared = PetWindow()
  private var panel: NSPanel?
  private var observation: AnyCancellable?
  private var screenObserver: NSObjectProtocol?
  private var dragOrigin: NSPoint?
  func start() {
    guard panel == nil else { return }
    let p = NSPanel(
      contentRect: NSRect(x: 0, y: 0, width: 220, height: 180),
      styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    p.title = "Pi Desk Pet"
    p.isOpaque = false
    p.backgroundColor = .clear
    p.hasShadow = false
    p.level = .floating
    p.hidesOnDeactivate = false
    p.isReleasedWhenClosed = false
    p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    p.isExcludedFromWindowsMenu = true
    p.contentView = NSHostingView(
      rootView: PetView(desk: Desk.shared, prefs: PetPreferences.shared))
    panel = p
    let defaults = UserDefaults.standard
    if defaults.object(forKey: "pet.x") != nil {
      p.setFrameOrigin(
        NSPoint(x: defaults.double(forKey: "pet.x"), y: defaults.double(forKey: "pet.y")))
      clamp()
    } else {
      resetPosition()
    }
    observation = PetPreferences.shared.$enabled.sink { [weak self] enabled in
      if enabled { self?.panel?.orderFrontRegardless() } else { self?.panel?.orderOut(nil) }
    }
    screenObserver = NotificationCenter.default.addObserver(
      forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
    ) { [weak self] _ in Task { @MainActor in self?.clamp() } }
  }
  func resetPosition() {
    guard let p = panel, let screen = NSScreen.main ?? NSScreen.screens.first else { return }
    p.setFrameOrigin(NSPoint(x: screen.visibleFrame.maxX - 230, y: screen.visibleFrame.minY + 20))
    save()
  }
  func drag(_ translation: CGSize) {
    guard let p = panel else { return }
    if dragOrigin == nil { dragOrigin = p.frame.origin }
    if let origin = dragOrigin {
      p.setFrameOrigin(NSPoint(x: origin.x + translation.width, y: origin.y - translation.height))
    }
  }
  func endDrag() {
    dragOrigin = nil
    clamp()
    save()
  }
  private func clamp() {
    guard let p = panel else { return }
    let midpoint = NSPoint(x: p.frame.midX, y: p.frame.midY)
    guard
      let screen = NSScreen.screens.first(where: { $0.visibleFrame.contains(midpoint) })
        ?? NSScreen.main
    else { return }
    let v = screen.visibleFrame
    p.setFrameOrigin(
      NSPoint(
        x: min(max(p.frame.minX, v.minX), v.maxX - p.frame.width),
        y: min(max(p.frame.minY, v.minY), v.maxY - p.frame.height)))
  }
  private func save() {
    guard let p = panel else { return }
    UserDefaults.standard.set(p.frame.minX, forKey: "pet.x")
    UserDefaults.standard.set(p.frame.minY, forKey: "pet.y")
  }
  func activate() {
    NSApp.activate(ignoringOtherApps: true)
    NSApp.windows.first(where: { $0.identifier?.rawValue == "main" })?.makeKeyAndOrderFront(nil)
    if let id = Desk.shared.petActivity.attentionTask,
      Desk.shared.tasks.contains(where: { $0.id == id }), id != Desk.shared.selected
    {
      Task { await Desk.shared.select(id) }
    }
  }
}

struct PetView: View {
  @ObservedObject var desk: Desk
  @ObservedObject var prefs: PetPreferences
  @Environment(\.accessibilityReduceMotion) var reduceMotion
  @State private var hover = false
  var body: some View {
    if prefs.enabled {
      TimelineView(.periodic(from: .now, by: reduceMotion ? 1 : 0.15)) { timeline in
        let mood = desk.petActivity.mood(connected: desk.connected, now: timeline.date)
        VStack(spacing: 3) {
          HStack(spacing: 5) {
            Image(systemName: symbol(mood))
            Text(label(mood)).lineLimit(1)
          }.font(.system(size: 10, weight: .medium)).padding(.horizontal, 10).padding(.vertical, 6)
            .background(.regularMaterial, in: Capsule()).opacity(
              hover || [.waiting, .problem, .finished].contains(mood) ? 1 : 0
            ).accessibilityHidden(!hover && ![.waiting, .problem, .finished].contains(mood))
          PetSprite(
            species: prefs.species, mood: mood, time: timeline.date.timeIntervalSinceReferenceDate,
            still: reduceMotion
          )
          .scaleEffect(prefs.size, anchor: .bottom).frame(
            width: 160, height: 120, alignment: .bottom)
        }.frame(width: 220, height: 180, alignment: .bottom).padding(.bottom, 8)
          .contentShape(Rectangle())
          .onHover { hover = $0 }
          .onTapGesture { PetWindow.shared.activate() }
          .gesture(
            DragGesture(minimumDistance: 4).onChanged { PetWindow.shared.drag($0.translation) }
              .onEnded { _ in PetWindow.shared.endDrag() }
          )
          .contextMenu {
            Button("Pi Desk öffnen") { PetWindow.shared.activate() }
            Divider()
            PetOptions()
          }
          .accessibilityElement(children: .ignore).accessibilityLabel(
            "\(prefs.name), \(label(mood))"
          )
          .accessibilityAddTraits(.isButton).accessibilityAction { PetWindow.shared.activate() }
          .help("\(prefs.name) · Klicken: Pi Desk öffnen · Ziehen: verschieben · Rechtsklick: Pets")
      }
    }
  }
  private func label(_ mood: PetActivity.Mood) -> String {
    switch mood {
    case .idle: return prefs.name + " ist bereit"
    case .working: return "Arbeitet gerade"
    case .waiting: return "Braucht deine Entscheidung"
    case .finished: return "Aufgabe abgeschlossen"
    case .problem: return "Bitte kurz nachsehen"
    case .disconnected: return "Wartet auf Verbindung"
    }
  }
  private func symbol(_ mood: PetActivity.Mood) -> String {
    switch mood {
    case .idle: return "pawprint"
    case .working: return "ellipsis"
    case .waiting: return "hand.raised"
    case .finished: return "checkmark"
    case .problem: return "exclamationmark.circle"
    case .disconnected: return "moon"
    }
  }
}
