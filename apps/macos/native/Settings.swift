import AppKit
import SwiftUI

private enum SettingsSection: String, CaseIterable, Identifiable {
  case models = "Anbieter & APIs"
  case localModels = "Lokale Modelle"
  case skills = "Skills"
  case mcp = "MCP-Verbindungen"
  case plugins = "Plugins & Hooks"
  case rules = "Projektregeln"
  case agent = "Agent"
  case appearance = "Darstellung"
  case shortcuts = "Tastaturkürzel"
  var id: String { rawValue }
  var symbol: String {
    switch self {
    case .models: "network"
    case .localModels: "internaldrive"
    case .skills: "sparkle"
    case .mcp: "point.3.connected.trianglepath.dotted"
    case .plugins: "puzzlepiece.extension"
    case .rules: "doc.text"
    case .agent: "slider.horizontal.3"
    case .appearance: "textformat.size"
    case .shortcuts: "keyboard"
    }
  }
}

struct DeskSettingsView: View {
  @ObservedObject var desk: Desk
  @State private var section: SettingsSection = .models
  @State private var connections: [Object] = []
  @State private var instructions = ""
  @State private var thinking = "auto"
  @State private var browser = false
  @State private var browserHeadless = true
  @State private var browserCdpUrl = ""
  @State private var lsp = true
  @State private var pty = false
  @State private var webSearch = true
  @State private var github = false
  @State private var securityScan = false
  @State private var memory = "off"
  @State private var advisor = false
  @State private var autoCompaction = true
  @State private var autoRetry = true
  @State private var extensionsEnabled = false
  @State private var xdev = true
  @State private var fastMode = false
  @State private var steeringMode = "all"
  @State private var followUpMode = "all"
  @State private var interruptMode = "immediate"
  @State private var mcpProject = false
  @State private var computer = false
  @State private var prewalk = false
  @State private var loaded = false
  @State private var working = false
  @State private var notice = ""
  @State private var failure = ""
  @State private var editConnection: Object?
  @State private var connectionOpen = false
  @State private var removeTarget: String?
  @State private var accountOpen = false
  @AppStorage("chatFontSize") private var fontSize = 13.0
  @AppStorage("reduceAnimations") private var reduceAnimations = false
  private let tint = Color(red: 0.73, green: 0.81, blue: 0.72)

  private func load() async {
    do {
      let result = try await desk.api("settings")
      connections = result["connections"] as? [Object] ?? []
      instructions = result["instructions"] as? String ?? ""
      thinking = result["thinking"] as? String ?? "auto"
      browser = result["browser"] as? Bool ?? false
      browserHeadless = result["browserHeadless"] as? Bool ?? true
      browserCdpUrl = result["browserCdpUrl"] as? String ?? ""
      lsp = result["lsp"] as? Bool ?? true
      pty = result["pty"] as? Bool ?? false
      webSearch = result["webSearch"] as? Bool ?? true
      github = result["github"] as? Bool ?? false
      securityScan = result["securityScan"] as? Bool ?? false
      memory = result["memory"] as? String ?? "off"
      advisor = result["advisor"] as? Bool ?? false
      autoCompaction = result["autoCompaction"] as? Bool ?? true
      autoRetry = result["autoRetry"] as? Bool ?? true
      extensionsEnabled = result["extensions"] as? Bool ?? false
      xdev = result["xdev"] as? Bool ?? true
      fastMode = result["fastMode"] as? Bool ?? false
      steeringMode = result["steeringMode"] as? String ?? "all"
      followUpMode = result["followUpMode"] as? String ?? "all"
      interruptMode = result["interruptMode"] as? String ?? "immediate"
      mcpProject = result["mcpProject"] as? Bool ?? false
      computer = result["computer"] as? Bool ?? false
      prewalk = result["prewalk"] as? Bool ?? false
      loaded = true
      failure = ""
    } catch { failure = error.localizedDescription }
  }
  private func saveAgent() {
    working = true
    failure = ""
    notice = ""
    Task {
      do {
        _ = try await desk.api(
          "settings/agent",
          body: [
            "instructions": instructions, "thinking": thinking, "browser": browser,
            "browserHeadless": browserHeadless, "browserCdpUrl": browserCdpUrl,
            "lsp": lsp, "pty": pty, "webSearch": webSearch, "github": github,
            "securityScan": securityScan, "memory": memory, "advisor": advisor,
            "autoCompaction": autoCompaction, "autoRetry": autoRetry,
            "extensions": extensionsEnabled, "xdev": xdev, "fastMode": fastMode,
            "steeringMode": steeringMode, "followUpMode": followUpMode,
            "interruptMode": interruptMode, "mcpProject": mcpProject,
            "computer": computer, "prewalk": prewalk,
          ])
        notice =
          browser
          ? "Gespeichert. Browser-Use gilt nach dem nächsten Leerlauf für alle Projekte."
          : "Gespeichert. Gilt für alle Projekte in Pi Desk."
        if let id = desk.selected { await desk.select(id) }
      } catch { failure = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    HStack(spacing: 0) {
      VStack(alignment: .leading, spacing: 6) {
        Text("Einstellungen").font(.system(size: 18, weight: .semibold)).padding(.bottom, 24)
        ForEach(SettingsSection.allCases) { item in
          Button {
            section = item
            notice = ""
            failure = ""
          } label: {
            Label(item.rawValue, systemImage: item.symbol)
              .font(.system(size: 12)).frame(maxWidth: .infinity, alignment: .leading)
              .padding(.horizontal, 10).padding(.vertical, 11)
              .background(
                section == item ? Color.white.opacity(0.08) : .clear,
                in: RoundedRectangle(cornerRadius: 7)
              )
              .contentShape(Rectangle())
          }.buttonStyle(.plain)
        }
        Spacer()
        Text("Pi Desk · OMP 18.4.10").font(.caption2).foregroundStyle(.secondary)
      }.padding(20).frame(width: 205).background(Color.white.opacity(0.025))
      Divider().opacity(0.3)
      VStack(alignment: .leading, spacing: 22) {
        HStack {
          Text(section.rawValue).font(.system(size: 23, weight: .medium))
          Spacer()
          if working { ProgressView().controlSize(.small) }
        }
        if !loaded {
          if failure.isEmpty {
            ProgressView("Einstellungen laden …")
          } else {
            Button("Erneut versuchen") { Task { await load() } }
          }
          Spacer(minLength: 0)
        } else {
          switch section {
          case .models: modelsContent
          case .localModels: LocalModelsView(desk: desk)
          case .skills: CapabilitySettingsView(desk: desk, skillsMode: true).id("skills")
          case .mcp: CapabilitySettingsView(desk: desk, skillsMode: false).id("mcp")
          case .plugins: ExtensionSettingsView(desk: desk).id("plugins")
          case .rules: ScrollView { ProjectRulesView(desk: desk).padding(.bottom, 16) }
          case .agent, .appearance, .shortcuts:
            ScrollView {
              Group {
                switch section {
                case .agent: agentContent
                case .appearance: appearanceContent
                default: ShortcutSettings()
                }
              }.frame(maxWidth: .infinity, alignment: .topLeading).padding(.bottom, 16)
            }
          }
        }
        if !notice.isEmpty {
          Label(notice, systemImage: "checkmark.circle").font(.caption).foregroundStyle(tint)
        }
        if !failure.isEmpty {
          Label(failure, systemImage: "exclamationmark.circle").font(.caption).foregroundStyle(
            .orange
          ).textSelection(.enabled)
        }
      }.padding(30).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }.frame(minWidth: 790, idealWidth: 850, minHeight: 570, idealHeight: 610)
      .background(Color(red: 0.105, green: 0.114, blue: 0.118)).preferredColorScheme(.dark).tint(
        tint
      )
      .task { await load() }
      .sheet(isPresented: $connectionOpen) {
        ConnectionEditor(desk: desk, existing: editConnection) { Task { await load() } }
      }
      .sheet(isPresented: $accountOpen) {
        LoginView(desk: desk, onClose: { accountOpen = false })
      }
      .alert(
        "Verbindung entfernen?",
        isPresented: Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } }),
        presenting: removeTarget
      ) { id in
        Button("Abbrechen", role: .cancel) { removeTarget = nil }
        Button("Entfernen", role: .destructive) {
          working = true
          Task {
            do {
              _ = try await desk.api("settings/connection-remove", body: ["id": id])
              await load()
              notice = "Verbindung entfernt."
              if let selected = desk.selected { await desk.select(selected) }
            } catch { failure = error.localizedDescription }
            working = false
          }
        }
      } message: { _ in
        Text(
          "Gespeicherte Chats bleiben erhalten. Für betroffene Chats kannst du ein anderes Modell wählen."
        )
      }
  }
  private var modelsContent: some View {
    VStack(alignment: .leading, spacing: 20) {
      HStack {
        VStack(alignment: .leading, spacing: 5) {
          Text("Anbieter-Konto").font(.headline)
          Text("Abo oder Zugangsdaten eines Anbieters verbinden.").font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        Button("Verbinden …") {
          accountOpen = true
          Task { await desk.loadLogin() }
        }
      }
      Divider().opacity(0.4)
      HStack {
        Text("Server & eigene APIs").font(.headline)
        Spacer()
        Button {
          editConnection = nil
          connectionOpen = true
        } label: {
          Image(systemName: "plus")
        }
        .help("Modellverbindung hinzufügen").accessibilityLabel("Modellverbindung hinzufügen")
      }
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          ForEach(Array(connections.filter { $0["managed"] as? Bool != true }.enumerated()), id: \.offset) { _, connection in
            HStack(spacing: 12) {
              Image(
                systemName: connection["kind"] as? String == "openai"
                  ? "network" : "desktopcomputer"
              ).foregroundStyle(.secondary)
              VStack(alignment: .leading, spacing: 5) {
                Text(connection["name"] as? String ?? "Verbindung").font(
                  .system(size: 13, weight: .medium))
                Text(connection["baseUrl"] as? String ?? "").font(.caption).foregroundStyle(
                  .secondary
                ).lineLimit(2)
              }
              Spacer()
              Button("Bearbeiten") {
                editConnection = connection
                connectionOpen = true
              }.disabled(working)
              Button {
                removeTarget = connection["id"] as? String
              } label: {
                Image(systemName: "minus.circle")
              }
              .help("Verbindung entfernen").accessibilityLabel("Verbindung entfernen").disabled(
                working)
            }.padding(.vertical, 15)
            Divider().opacity(0.3)
          }
          if connections.filter({ $0["managed"] as? Bool != true }).isEmpty {
            Text("Noch keine Server verbunden. Mit + eine bestehende Ollama-, LM-Studio- oder OpenAI-kompatible API hinzufügen.")
              .font(.system(size: 12)).foregroundStyle(.secondary).padding(.vertical, 18)
          }
        }
      }
      Divider().opacity(0.3)
      HStack {
        VStack(alignment: .leading, spacing: 5) {
          Text("Modelle auf diesem Mac").font(.headline)
          Text("Vorhandene Modelle laden oder neue entdecken – ohne andere App.").font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        Button("Bibliothek öffnen") { section = .localModels }
      }
    }
  }
  private var agentContent: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("Persönliche Hinweise").font(.headline)
      Text(
        "Zum Beispiel Sprache, Antwortstil oder Arbeitsweise. Ergänzt die OMP-Anweisungen für alle Projekte."
      ).font(.caption).foregroundStyle(.secondary)
      TextEditor(text: $instructions).font(.system(size: 13)).scrollContentBackground(.hidden)
        .padding(8).frame(height: 210).background(
          Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 8)
        )
        .accessibilityLabel("Persönliche Hinweise")
      HStack {
        Text("Denkaufwand")
        Spacer()
        Picker("Denkaufwand", selection: $thinking) {
          Text("Automatisch").tag("auto")
          Text("Aus").tag("off")
          Text("Minimal").tag("minimal")
          Text("Niedrig").tag("low")
          Text("Mittel").tag("medium")
          Text("Hoch").tag("high")
          Text("Sehr hoch").tag("xhigh")
          Text("Maximal").tag("max")
        }.labelsHidden().frame(width: 170)
      }
      Text(
        "Verfügbare Denkstufen hängen vom Modell ab. Speichern ist möglich, wenn alle Aufgaben und Anmeldungen im Leerlauf sind."
      )
      .font(.caption).foregroundStyle(.secondary)
      Divider().opacity(0.4).padding(.vertical, 5)
      Toggle("Browser-Use", isOn: $browser)
      Text(
        "OMP darf Seiten in Chromium öffnen und bedienen (Puppeteer). Standard ist aus. Befehle brauchen weiterhin eine Genehmigung, außer im Vollzugriff."
      ).font(.caption).foregroundStyle(.secondary)
      if browser {
        Toggle("Browser unsichtbar starten", isOn: $browserHeadless)
        TextField("CDP-Adresse · optional", text: $browserCdpUrl)
          .textFieldStyle(.roundedBorder).autocorrectionDisabled()
        Text(
          "Leer: OMP startet Chromium selbst. Oder eine laufende Chrome-Instanz, z. B. http://127.0.0.1:9222."
        ).font(.caption).foregroundStyle(.secondary)
      }
      Divider().opacity(0.4).padding(.vertical, 5)
      Text("Werkzeuge").font(.headline)
      Toggle("LSP", isOn: $lsp)
      Toggle("Interaktive Shell (PTY)", isOn: $pty)
      Toggle("Websuche", isOn: $webSearch)
      Toggle("GitHub-CLI", isOn: $github)
      Toggle("Sicherheitsprüfung", isOn: $securityScan)
      Toggle("xd:// für seltene Werkzeuge", isOn: $xdev)
      Text("read, write, edit, bash, grep, glob, eval, lsp, task, todo und die übrigen Built-ins sind aktiv. GitHub und Security bleiben optional.").font(.caption).foregroundStyle(.secondary)
      Divider().opacity(0.4).padding(.vertical, 5)
      Text("Verhalten").font(.headline)
      Toggle("Advisor", isOn: $advisor)
      Toggle("Automatische Komprimierung", isOn: $autoCompaction)
      Toggle("Automatische Wiederholung", isOn: $autoRetry)
      Toggle("Schnellmodus als Vorgabe", isOn: $fastMode)
      Toggle("Erweiterungen laden", isOn: $extensionsEnabled)
      Toggle("Projekt-MCP aus dem Repo", isOn: $mcpProject)
      Toggle("Computer-Use", isOn: $computer)
      Toggle("Prewalk", isOn: $prewalk)
      Text("Computer-Use steuert den Mac über Eval (Fenster, Eingabe, Screenshots). Prewalk wechselt nach dem Plan auf das schnelle Modell.").font(.caption).foregroundStyle(.secondary)
      HStack {
        Text("Gedächtnis")
        Spacer()
        Picker("Gedächtnis", selection: $memory) {
          Text("Aus").tag("off")
          Text("Lokal").tag("local")
          Text("Hindsight").tag("hindsight")
          Text("Mnemopi").tag("mnemopi")
        }.labelsHidden().frame(width: 150)
      }
      HStack {
        Text("Steering")
        Spacer()
        Picker("Steering", selection: $steeringMode) {
          Text("Alle").tag("all")
          Text("Nacheinander").tag("one-at-a-time")
        }.labelsHidden().frame(width: 150)
      }
      HStack {
        Text("Follow-up")
        Spacer()
        Picker("Follow-up", selection: $followUpMode) {
          Text("Alle").tag("all")
          Text("Nacheinander").tag("one-at-a-time")
        }.labelsHidden().frame(width: 150)
      }
      HStack {
        Text("Eingreifen")
        Spacer()
        Picker("Eingreifen", selection: $interruptMode) {
          Text("Sofort").tag("immediate")
          Text("Warten").tag("wait")
        }.labelsHidden().frame(width: 150)
      }
      Text("Änderungen gelten nach dem Speichern für alle Projekte, sobald alle Aufgaben im Leerlauf sind.").font(.caption).foregroundStyle(.secondary)
      HStack {
        Spacer()
        Button("Speichern", action: saveAgent).disabled(working || instructions.count > 20000)
      }
      Divider().opacity(0.4).padding(.vertical, 5)
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 5) {
          Text("Automatische Genehmigungen").font(.headline)
          Text(
            desk.automaticApprovalCount == 0
              ? "Noch keine werkzeugspezifischen Freigaben gespeichert."
              : "\(desk.automaticApprovalCount) gespeicherte Freigaben für einzelne Chats oder alle Chats."
          ).font(.caption).foregroundStyle(.secondary)
          Text("Sicherheitsprüfungen von Modellanbietern werden immer erneut angezeigt.")
            .font(.caption2).foregroundStyle(.secondary)
        }
        Spacer()
        if desk.automaticApprovalCount > 0 {
          Button("Zurücksetzen") {
            desk.clearAutomaticApprovals()
            notice = "Automatische Genehmigungen zurückgesetzt."
          }
        }
      }
    }
  }
  private var appearanceContent: some View {
    VStack(alignment: .leading, spacing: 24) {
      HStack {
        Text("Schriftgröße im Chat")
        Spacer()
        Picker("Schriftgröße", selection: $fontSize) {
          ForEach([12.0, 13, 14, 15, 16, 18], id: \.self) { Text("\(Int($0)) pt").tag($0) }
        }.labelsHidden().frame(width: 110)
      }
      Text("Ein ruhiger Ort für deinen nächsten Gedanken.").font(.system(size: fontSize)).padding(
        .vertical, 16)
      Divider().opacity(0.4)
      Toggle("Animationen reduzieren", isOn: $reduceAnimations)
      Text(
        "Die macOS-Einstellung für reduzierte Bewegung wird immer berücksichtigt. Änderungen wirken sofort und bleiben gespeichert."
      )
      .font(.caption).foregroundStyle(.secondary)
    }
  }
}

private struct ConnectionEditor: View {
  @ObservedObject var desk: Desk
  let existing: Object?
  let saved: () -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var kind = "ollama"
  @State private var name = "Ollama"
  @State private var baseUrl = "http://127.0.0.1:11434"
  @State private var apiKey = ""
  @State private var clearKey = false
  @State private var manualModels = ""
  @State private var working = false
  @State private var result = ""
  @State private var found: [String] = []
  @State private var failure = ""
  private var bodyData: Object {
    var o: Object = [
      "kind": kind, "name": name, "baseUrl": baseUrl,
      "models": manualModels.split(separator: "\n").map {
        String($0).trimmingCharacters(in: .whitespaces)
      }.filter { !$0.isEmpty }, "clearKey": clearKey,
    ]
    if let id = existing?["id"] { o["id"] = id }
    if !apiKey.isEmpty { o["apiKey"] = apiKey }
    return o
  }
  private func perform(test: Bool) {
    working = true
    failure = ""
    result = ""
    found = []
    Task {
      do {
        let response = try await desk.api(
          test ? "settings/connection-test" : "settings/connection", body: bodyData)
        if test {
          result = response["message"] as? String ?? "Server erreichbar."
          found = response["models"] as? [String] ?? []
        } else {
          saved()
          dismiss()
          if let id = desk.selected { await desk.select(id) }
        }
      } catch { failure = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text(existing == nil ? "Modellverbindung hinzufügen" : "Modellverbindung bearbeiten").font(
        .title2)
      Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 14) {
        GridRow {
          Text("Typ")
          Picker("Typ", selection: $kind) {
            Text("Ollama").tag("ollama")
            Text("LM Studio").tag("lm-studio")
            Text("OpenAI-kompatible API").tag("openai")
          }.labelsHidden()
        }
        GridRow {
          Text("Name")
          TextField("Name", text: $name)
        }
        GridRow {
          Text("Server-URL")
          TextField("http://127.0.0.1:11434", text: $baseUrl).autocorrectionDisabled()
        }
        GridRow {
          Text("API-Schlüssel")
          SecureField(
            existing?["hasApiKey"] as? Bool == true
              ? "Gespeichert · leer lassen zum Beibehalten" : "Optional bei lokalen Servern",
            text: $apiKey)
        }
      }.textFieldStyle(.roundedBorder)
      if existing?["hasApiKey"] as? Bool == true {
        Toggle("Gespeicherten Schlüssel entfernen", isOn: $clearKey).font(.caption)
      }
      Text("Modell-IDs · optional, eine pro Zeile").font(.caption).foregroundStyle(.secondary)
      TextEditor(text: $manualModels).font(.system(size: 12, design: .monospaced))
        .scrollContentBackground(.hidden).padding(7).frame(height: 80).background(
          Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 7)
        )
        .accessibilityLabel("Manuelle Modell-IDs")
      Text(
        "Leer lassen für automatische Erkennung. Manuelle IDs verwenden zunächst 32k Kontext und 4k Ausgabelimit."
      ).font(.caption).foregroundStyle(.secondary)
      if !result.isEmpty {
        Label(result, systemImage: "checkmark.circle").font(.caption).foregroundStyle(.green)
        if !found.isEmpty {
          Text(found.prefix(10).joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
            .lineLimit(3).textSelection(.enabled)
        }
      }
      if !failure.isEmpty {
        Text(failure).font(.caption).foregroundStyle(.orange).fixedSize(
          horizontal: false, vertical: true)
      }
      HStack {
        Button("Abbrechen") { dismiss() }.keyboardShortcut(.cancelAction).disabled(working)
        Spacer()
        if working { ProgressView().controlSize(.small) }
        Button("Verbindung testen") { perform(test: true) }.disabled(working)
        Button("Speichern") { perform(test: false) }.keyboardShortcut(.defaultAction).disabled(
          working || name.trimmingCharacters(in: .whitespaces).isEmpty)
      }
    }.padding(28).frame(width: 580).disabled(working)
      .onAppear {
        if let c = existing {
          kind = c["kind"] as? String ?? "openai"
          name = c["name"] as? String ?? ""
          baseUrl = c["baseUrl"] as? String ?? ""
          manualModels = (c["models"] as? [String] ?? []).joined(separator: "\n")
        }
      }
      .onChange(of: kind) { _, value in
        if existing == nil {
          name = value == "ollama" ? "Ollama" : value == "lm-studio" ? "LM Studio" : "Eigene API"
          baseUrl =
            value == "ollama"
            ? "http://127.0.0.1:11434"
            : value == "lm-studio" ? "http://127.0.0.1:1234/v1" : "https://"
        }
        result = ""
        found = []
        failure = ""
      }
  }
}
