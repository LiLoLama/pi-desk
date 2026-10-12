import AppKit
import SwiftUI

/// "Neu in dieser Version": once after an update that raised major or minor, and on request.
@MainActor final class WhatsNew: NSObject, NSWindowDelegate {
  static let shared = WhatsNew()
  static let seenKey = "whatsNew.seenVersion"

  private var window: NSWindow?
  private var afterClose: [() -> Void] = []

  var isOpen: Bool { window?.isVisible == true }

  /// Runs at launch, before the first automatic update check.
  func showIfNeeded() {
    guard let text = Self.changelog() else { return }
    let installed = AppUpdates.shared.installedVersion
    let result = UpdateLogic.whatsNew(
      changelog: text, seen: UserDefaults.standard.string(forKey: Self.seenKey), installed: installed)
    // Saved before showing: a crash with the window open must not bring it back on every launch.
    UserDefaults.standard.set(result.remember, forKey: Self.seenKey)
    if result.show { present(title: "Neu in Pi Desk \(Self.minor(installed))", notes: result.notes) }
  }

  /// Menu and settings: latest sections up to the installed version; the seen version stays as it is.
  func showAll() {
    let notes =
      Self.changelog().map {
        UpdateLogic.recentNotes(changelog: $0, installed: AppUpdates.shared.installedVersion)
      } ?? ""
    present(title: "Was ist neu in Pi Desk", notes: notes.isEmpty ? "Keine Änderungsnotizen." : notes)
  }

  /// Update dialogs wait until this window is closed.
  func whenClosed(_ action: @escaping () -> Void) {
    if isOpen { afterClose.append(action) } else { action() }
  }

  func close() { window?.close() }

  /// A held update dialog must not wait behind a covered window the user cannot see.
  func bringToFront() {
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  private func present(title: String, notes: String) {
    let view = WhatsNewView(title: title, notes: notes) { [weak self] in self?.close() }
    if let window {
      window.contentViewController = NSHostingController(rootView: view)
    } else {
      let window = NSWindow(contentViewController: NSHostingController(rootView: view))
      window.title = "Neu in Pi Desk"
      window.styleMask = [.titled, .closable]
      window.isReleasedWhenClosed = false
      window.appearance = NSAppearance(named: .darkAqua)
      window.delegate = self
      self.window = window
    }
    window?.center()
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  nonisolated func windowWillClose(_ notification: Notification) {
    MainActor.assumeIsolated {
      let pending = afterClose
      afterClose = []
      // After the close finished, so isOpen is already false for the waiting dialogs.
      DispatchQueue.main.async { pending.forEach { $0() } }
    }
  }

  static func changelog() -> String? {
    Bundle.main.url(forResource: "CHANGELOG", withExtension: "md")
      .flatMap { try? String(contentsOf: $0, encoding: .utf8) }
  }

  private static func minor(_ version: String) -> String {
    version.split(separator: ".").prefix(2).joined(separator: ".")
  }
}

private struct WhatsNewView: View {
  let title: String
  let notes: String
  let close: () -> Void
  private let tint = Color(red: 0.73, green: 0.81, blue: 0.72)

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text(title).font(.system(size: 18, weight: .semibold))
      ScrollView {
        ChatMarkdown(
          text: notes, fontSize: 13, onOpenFile: { _ in }, onRevealFile: { _ in },
          onOpenURL: { value in
            if let url = URL(string: value), ["https", "http"].contains(url.scheme ?? "") {
              NSWorkspace.shared.open(url)
            }
          }
        ).frame(maxWidth: .infinity, alignment: .leading).padding(12)
      }.frame(minHeight: 160, maxHeight: 360)
        .background(Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 8))
      HStack {
        Spacer()
        Button("Verstanden", action: close).keyboardShortcut(.defaultAction)
      }
    }.padding(24).frame(width: 520, alignment: .leading)
      .background(Color(red: 0.105, green: 0.114, blue: 0.118)).preferredColorScheme(.dark).tint(tint)
      // Nothing in this window takes focus, so Esc needs a cancel shortcut rather than onExitCommand.
      .background(Button("", action: close).keyboardShortcut(.cancelAction).opacity(0))
  }
}
