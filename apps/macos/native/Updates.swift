import AppKit
import Sparkle
import SwiftUI

/// Sparkle-backed updates with a Quiet Studio dialog. Sparkle verifies the EdDSA signature; this type decides when to ask.
@MainActor final class AppUpdates: NSObject, ObservableObject, SPUUpdaterDelegate, NSWindowDelegate {
  static let shared = AppUpdates()

  enum Phase: Equatable {
    case idle, checking, upToDate, installing, moveToApplications
    case available(version: String, notes: String)
    case downloading(progress: Double?)
    case extracting(progress: Double)
    case ready(version: String)
    case failed(String)
  }

  @Published private(set) var phase: Phase = .idle
  @Published private(set) var lastCheck: Date?
  @Published var automaticChecks = true {
    didSet {
      if let updater, updater.automaticallyChecksForUpdates != automaticChecks {
        updater.automaticallyChecksForUpdates = automaticChecks
      }
    }
  }
  let installedVersion =
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
  /// Set once the user agreed to interrupt running work, so quitting does not ask twice.
  private(set) var confirmedRestart = false

  private var updater: SPUUpdater?
  private var driver: UpdateDriver?
  private var window: NSWindow?
  private var offered: [(version: String, notes: String)] = []
  private var offeredVersion = ""
  private var dismissedVersion = ""
  private var reply: ((SPUUserUpdateChoice) -> Void)?
  private var cancelDownload: (() -> Void)?
  private var expectedBytes: UInt64 = 0
  private var receivedBytes: UInt64 = 0
  private var userInitiated = false
  private var installWhenFound = false
  private var locationHintShown = false

  func start() {
    let driver = UpdateDriver(model: self)
    let updater = SPUUpdater(hostBundle: .main, applicationBundle: .main, userDriver: driver, delegate: self)
    do { try updater.start() } catch {
      phase = .failed("Updates sind nicht verfügbar: \(error.localizedDescription)")
      return
    }
    self.driver = driver
    self.updater = updater
    automaticChecks = updater.automaticallyChecksForUpdates
    lastCheck = updater.lastUpdateCheckDate
    DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
      guard let updater = self?.updater, updater.automaticallyChecksForUpdates, updater.canCheckForUpdates
      else { return }
      updater.checkForUpdatesInBackground()
    }
  }

  // MARK: User actions

  func checkNow() {
    guard let updater else { return }
    userInitiated = true
    if updater.canCheckForUpdates { updater.checkForUpdates() } else { showWindow() }
  }
  func install() { answer(.install) }
  func later() {
    if case .available(let version, _) = phase { dismissedVersion = version }
    answer(.dismiss)
    finish()
  }
  func skip() {
    answer(.skip)
    finish()
  }
  func close() {
    answer(.dismiss)
    finish()
  }
  func cancelDownloading() {
    cancelDownload?()
    cancelDownload = nil
    finish()
  }
  func restartNow() {
    if Desk.shared.updateBlocked && !Desk.confirmQuitWhileBusy() { return }
    confirmedRestart = true
    if reply != nil {
      answer(.install)
    } else {
      installWhenFound = true
      updater?.checkForUpdates()
    }
  }

  private func answer(_ choice: SPUUserUpdateChoice) {
    let pending = reply
    reply = nil
    pending?(choice)
  }
  private func finish() {
    userInitiated = false
    if case .ready = phase {} else { phase = .idle }
    window?.orderOut(nil)
  }

  // MARK: Sparkle callbacks (main thread)

  func didStartUserCheck() {
    phase = .checking
    showWindow()
  }
  func found(_ item: SUAppcastItem, stage: SPUUserUpdateStage, reply: @escaping (SPUUserUpdateChoice) -> Void) {
    lastCheck = Date()
    let bundle = Bundle.main.bundleURL
    let writable = FileManager.default.isWritableFile(atPath: bundle.deletingLastPathComponent().path)
    guard UpdateLogic.canReplace(bundlePath: bundle.path, parentWritable: writable) else {
      reply(.dismiss)
      if userInitiated || !locationHintShown {
        locationHintShown = true
        phase = .moveToApplications
        showWindow()
      }
      return
    }
    offeredVersion = item.displayVersionString
    switch stage {
    case .downloaded:
      if installWhenFound {
        installWhenFound = false
        reply(.install)
        return
      }
      self.reply = reply
      phase = .ready(version: offeredVersion)
      showWindow()
    case .installing:
      reply(.install)
    default:
      if !userInitiated && offeredVersion == dismissedVersion {
        reply(.dismiss)
        return
      }
      self.reply = reply
      let items = offered.isEmpty ? [(version: offeredVersion, notes: item.itemDescription ?? "")] : offered
      let notes = UpdateLogic.notes(items, newerThan: installedVersion)
      phase = .available(version: offeredVersion, notes: notes.isEmpty ? "Keine Änderungsnotizen." : notes)
      showWindow()
    }
  }
  func notFound() {
    lastCheck = Date()
    if userInitiated {
      phase = .upToDate
      showWindow()
    } else {
      phase = .idle
    }
  }
  func failed(_ error: Error) {
    let loading: Bool
    switch phase {
    case .downloading, .extracting, .installing: loading = true
    default: loading = false
    }
    cancelDownload = nil
    confirmedRestart = false
    guard userInitiated || loading else {
      phase = .idle
      return
    }
    phase = .failed(
      loading
        ? "Das Update konnte nicht geladen oder bestätigt werden. Es wurde nichts verändert."
        : "Update-Server nicht erreichbar. Bitte später erneut versuchen.")
    showWindow()
  }
  func downloadStarted(cancel: @escaping () -> Void) {
    cancelDownload = cancel
    expectedBytes = 0
    receivedBytes = 0
    phase = .downloading(progress: nil)
    showWindow()
  }
  func expected(_ bytes: UInt64) {
    expectedBytes = bytes
    receivedBytes = 0
  }
  func received(_ bytes: UInt64) {
    receivedBytes += bytes
    phase = .downloading(
      progress: expectedBytes > 0 ? min(1, Double(receivedBytes) / Double(expectedBytes)) : nil)
  }
  func extracting(_ progress: Double) {
    cancelDownload = nil
    phase = .extracting(progress: progress)
  }
  func readyToInstall(_ reply: @escaping (SPUUserUpdateChoice) -> Void) {
    if Desk.shared.updateBlocked {
      self.reply = reply
      phase = .ready(version: offeredVersion)
      showWindow()
    } else {
      confirmedRestart = true
      reply(.install)
    }
  }
  func installing() { phase = .installing }
  func dismissed() {
    reply = nil
    cancelDownload = nil
    userInitiated = false
    if case .ready = phase { return }
    phase = .idle
    window?.orderOut(nil)
  }

  // MARK: Window

  func showWindow() {
    if window == nil {
      let window = NSWindow(contentViewController: NSHostingController(rootView: UpdateView(updates: self)))
      window.title = "Pi Desk aktualisieren"
      window.styleMask = [.titled, .closable]
      window.isReleasedWhenClosed = false
      window.appearance = NSAppearance(named: .darkAqua)
      window.delegate = self
      window.center()
      self.window = window
    }
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }
  nonisolated func windowWillClose(_ notification: Notification) {
    MainActor.assumeIsolated {
      if reply != nil { later() } else { finish() }
    }
  }

  // MARK: SPUUpdaterDelegate

  nonisolated func feedURLString(for updater: SPUUpdater) -> String? {
    guard Bundle.main.object(forInfoDictionaryKey: "PIDeskDevBuild") as? Bool == true else { return nil }
    return ProcessInfo.processInfo.environment["PI_DESK_UPDATE_FEED"]
  }
  nonisolated func updater(_ updater: SPUUpdater, didFinishLoading appcast: SUAppcast) {
    let items = appcast.items.map { (version: $0.displayVersionString, notes: $0.itemDescription ?? "") }
    MainActor.assumeIsolated { offered = items }
  }
}

/// Bridges Sparkle's user-driver callbacks, which arrive on the main thread, to AppUpdates.
final class UpdateDriver: NSObject, SPUUserDriver {
  private let model: AppUpdates
  init(model: AppUpdates) { self.model = model }
  private func main(_ body: @MainActor (AppUpdates) -> Void) { MainActor.assumeIsolated { body(model) } }

  func show(_ request: SPUUpdatePermissionRequest, reply: @escaping (SUUpdatePermissionResponse) -> Void) {
    reply(SUUpdatePermissionResponse(automaticUpdateChecks: true, sendSystemProfile: false))
  }
  func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) { main { $0.didStartUserCheck() } }
  func showUpdateFound(
    with appcastItem: SUAppcastItem, state: SPUUserUpdateState, reply: @escaping (SPUUserUpdateChoice) -> Void
  ) { main { $0.found(appcastItem, stage: state.stage, reply: reply) } }
  func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {}
  func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) {}
  func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) {
    main { $0.notFound() }
    acknowledgement()
  }
  func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) {
    main { $0.failed(error) }
    acknowledgement()
  }
  func showDownloadInitiated(cancellation: @escaping () -> Void) { main { $0.downloadStarted(cancel: cancellation) } }
  func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) {
    main { $0.expected(expectedContentLength) }
  }
  func showDownloadDidReceiveData(ofLength length: UInt64) { main { $0.received(length) } }
  func showDownloadDidStartExtractingUpdate() { main { $0.extracting(0) } }
  func showExtractionReceivedProgress(_ progress: Double) { main { $0.extracting(progress) } }
  func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) {
    main { $0.readyToInstall(reply) }
  }
  func showInstallingUpdate(
    withApplicationTerminated applicationTerminated: Bool, retryTerminatingApplication: @escaping () -> Void
  ) { main { $0.installing() } }
  func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) {
    acknowledgement()
  }
  func showUpdateInFocus() { main { $0.showWindow() } }
  func dismissUpdateInstallation() { main { $0.dismissed() } }
}

struct UpdateView: View {
  @ObservedObject var updates: AppUpdates
  private let tint = Color(red: 0.73, green: 0.81, blue: 0.72)

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      switch updates.phase {
      case .checking:
        ProgressView("Suche nach Updates …")
      case .upToDate:
        Text("Pi Desk \(updates.installedVersion) ist aktuell.").font(.headline)
        actions { Button("OK") { updates.close() }.keyboardShortcut(.defaultAction) }
      case .available(let version, let notes):
        Text("Pi Desk \(version) ist verfügbar").font(.system(size: 18, weight: .semibold))
        Text("Du hast \(updates.installedVersion).").foregroundStyle(.secondary)
        ScrollView {
          ChatMarkdown(
            text: notes, fontSize: 13, onOpenFile: { _ in }, onRevealFile: { _ in },
            onOpenURL: { value in
              if let url = URL(string: value), ["https", "http"].contains(url.scheme ?? "") {
                NSWorkspace.shared.open(url)
              }
            }
          ).frame(maxWidth: .infinity, alignment: .leading).padding(12)
        }.frame(minHeight: 160, maxHeight: 320)
          .background(Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 8))
        HStack {
          Button("Diese Version überspringen") { updates.skip() }
          Spacer()
          Button("Später") { updates.later() }.keyboardShortcut(.cancelAction)
          Button("Jetzt aktualisieren") { updates.install() }.keyboardShortcut(.defaultAction)
        }
      case .downloading(let progress):
        Text("Update wird geladen …").font(.headline)
        if let progress { ProgressView(value: progress) } else { ProgressView().progressViewStyle(.linear) }
        actions { Button("Abbrechen") { updates.cancelDownloading() } }
      case .extracting(let progress):
        Text("Update wird geprüft …").font(.headline)
        ProgressView(value: progress)
      case .ready(let version):
        Text("Pi Desk \(version) ist bereit").font(.system(size: 18, weight: .semibold))
        Text("Ein Vorgang läuft noch. Das Update wird beim nächsten Beenden installiert.")
          .foregroundStyle(.secondary)
        actions {
          Button("Beim Beenden installieren") { updates.later() }
          Button("Jetzt neu starten") { updates.restartNow() }.keyboardShortcut(.defaultAction)
        }
      case .installing:
        ProgressView("Update wird installiert …")
      case .moveToApplications:
        Text("Updates benötigen den Programme-Ordner").font(.headline)
        Text("Bitte Pi Desk in den Programme-Ordner verschieben und von dort starten, um Updates zu erhalten.")
          .foregroundStyle(.secondary)
        actions { Button("OK") { updates.close() }.keyboardShortcut(.defaultAction) }
      case .failed(let message):
        Text("Update nicht möglich").font(.headline)
        Text(message).foregroundStyle(.secondary)
        actions {
          Button("Schließen") { updates.close() }
          Button("Erneut versuchen") { updates.checkNow() }.keyboardShortcut(.defaultAction)
        }
      case .idle:
        EmptyView()
      }
    }.padding(24).frame(width: 520, alignment: .leading)
      .background(Color(red: 0.105, green: 0.114, blue: 0.118)).preferredColorScheme(.dark).tint(tint)
  }

  private func actions<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    HStack {
      Spacer()
      content()
    }
  }
}

struct UpdateSettingsView: View {
  @ObservedObject var updates: AppUpdates

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      LabeledContent("Installierte Version", value: updates.installedVersion)
      LabeledContent(
        "Letzte Prüfung",
        value: updates.lastCheck.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "Noch nicht geprüft")
      Toggle("Automatisch nach Updates suchen", isOn: $updates.automaticChecks)
      HStack {
        Button("Jetzt nach Updates suchen") { updates.checkNow() }
        if case .ready = updates.phase { Button("Jetzt neu starten") { updates.restartNow() } }
      }
      if case .moveToApplications = updates.phase {
        Label(
          "Bitte Pi Desk in den Programme-Ordner verschieben und von dort starten, um Updates zu erhalten.",
          systemImage: "exclamationmark.circle"
        ).foregroundStyle(.orange)
      }
      Text("Pi Desk sucht beim Start und danach alle 6 Stunden. Vor jeder Installation siehst du, was neu ist.")
        .font(.caption).foregroundStyle(.secondary)
    }
  }
}
