import AppKit
import SwiftUI

@MainActor final class DeskShortcuts: ObservableObject {
  static let shared = DeskShortcuts()
  enum Action: String, CaseIterable, Identifiable {
    case newTask, openProject, search, inspector
    var id: String { rawValue }
    var title: String {
      switch self {
      case .newTask: "Neue Aufgabe"
      case .openProject: "Projekt öffnen"
      case .search: "Chats suchen"
      case .inspector: "Dateien und Vorschau"
      }
    }
  }
  struct Binding: Codable, Equatable {
    var key: String
    var command = true
    var shift = false
    var option = false
    var control = false
    var modifiers: EventModifiers {
      var m: EventModifiers = []
      if command { m.insert(.command) }
      if shift { m.insert(.shift) }
      if option { m.insert(.option) }
      if control { m.insert(.control) }
      return m
    }
    var label: String {
      (control ? "⌃" : "") + (option ? "⌥" : "") + (shift ? "⇧" : "") + (command ? "⌘" : "")
        + key.uppercased()
    }
  }
  static let defaults: [String: Binding] = [
    "newTask": Binding(key: "n"), "openProject": Binding(key: "o"), "search": Binding(key: "k"),
    "inspector": Binding(key: "i", option: true),
  ]
  @Published private var values: [String: Binding]
  init() {
    let data = UserDefaults.standard.data(forKey: "desk.shortcuts")
    let saved = data.flatMap { try? JSONDecoder().decode([String: Binding].self, from: $0) } ?? [:]
    values = Self.defaults.merging(saved) { _, new in new }
  }
  func binding(_ action: Action) -> Binding {
    values[action.rawValue] ?? Self.defaults[action.rawValue]!
  }
  func shortcut(_ action: Action) -> KeyboardShortcut {
    let b = binding(action)
    return KeyboardShortcut(KeyEquivalent(b.key.first ?? "n"), modifiers: b.modifiers)
  }
  func assign(_ b: Binding, to action: Action) -> String? {
    if let other = Action.allCases.first(where: { $0 != action && binding($0) == b }) {
      return "Bereits für „\(other.title)“ verwendet."
    }
    values[action.rawValue] = b
    persist()
    return nil
  }
  func reset() {
    values = Self.defaults
    persist()
  }
  private func persist() {
    if let data = try? JSONEncoder().encode(values) {
      UserDefaults.standard.set(data, forKey: "desk.shortcuts")
    }
  }
}

struct ShortcutSettings: View {
  @ObservedObject var shortcuts = DeskShortcuts.shared
  @State private var recording: DeskShortcuts.Action?
  @State private var error = ""
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text("Klicke auf ein Kürzel und drücke die neue Tastenkombination.").font(.caption)
        .foregroundStyle(.secondary)
      ForEach(DeskShortcuts.Action.allCases) { action in
        HStack {
          Text(action.title)
          Spacer()
          Button(shortcuts.binding(action).label) {
            error = ""
            recording = action
          }
          .frame(minWidth: 90).help("Tastenkürzel ändern: \(action.title)")
          .popover(
            isPresented: Binding(get: { recording == action }, set: { if !$0 { recording = nil } })
          ) {
            VStack(alignment: .leading, spacing: 12) {
              Text("Neues Kürzel für „\(action.title)“").font(.headline)
              Text("Mit ⌘, ⌃ oder ⌥ kombinieren. Esc bricht ab.").font(.caption).foregroundStyle(
                .secondary)
              ShortcutCapture { binding, message in
                if let binding {
                  error = shortcuts.assign(binding, to: action) ?? ""
                  if error.isEmpty { recording = nil }
                } else if let message {
                  error = message
                } else {
                  recording = nil
                }
              }.frame(width: 300, height: 4)
              if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.orange) }
            }.padding(20)
          }
        }.padding(.vertical, 8)
        Divider().opacity(0.3)
      }
      Button("Standardkürzel wiederherstellen") { shortcuts.reset() }.padding(.top, 10)
      Text(
        "Standardbefehle wie Kopieren, Einfügen, Schließen und Einstellungen bleiben macOS vorbehalten."
      ).font(.caption).foregroundStyle(.secondary)
    }
  }
}

private struct ShortcutCapture: NSViewRepresentable {
  let captured: (DeskShortcuts.Binding?, String?) -> Void
  final class Capture: NSView {
    var captured: ((DeskShortcuts.Binding?, String?) -> Void)?
    override var acceptsFirstResponder: Bool { true }
    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      window?.makeFirstResponder(self)
    }
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
      handle(event)
      return true
    }
    override func keyDown(with event: NSEvent) { handle(event) }
    private func handle(_ event: NSEvent) {
      if event.keyCode == 53 {
        captured?(nil, nil)
        return
      }
      let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
      guard let key = event.charactersIgnoringModifiers?.lowercased(), key.count == 1,
        key.range(of: "^[a-z0-9]$", options: .regularExpression) != nil,
        flags.contains(.command) || flags.contains(.control) || flags.contains(.option)
      else {
        captured?(nil, "Bitte Buchstabe oder Ziffer mit ⌘, ⌃ oder ⌥ kombinieren.")
        return
      }
      if flags.contains(.command) && !flags.contains(.control) && !flags.contains(.option)
        && "qwhmcxvaz".contains(key)
      {
        captured?(nil, "Dieses Kürzel ist für einen macOS-Standardbefehl reserviert.")
        return
      }
      captured?(
        DeskShortcuts.Binding(
          key: key, command: flags.contains(.command), shift: flags.contains(.shift),
          option: flags.contains(.option), control: flags.contains(.control)), nil)
    }
  }
  func makeNSView(context: Context) -> Capture {
    let view = Capture()
    view.captured = captured
    view.setAccessibilityLabel("Tastenkürzel aufnehmen")
    return view
  }
  func updateNSView(_ view: Capture, context: Context) { view.captured = captured }
}
