import AppKit
import SwiftUI

struct CapabilitySettingsView: View {
  @ObservedObject var desk: Desk
  let skillsMode: Bool
  @State private var skills: [Object] = []
  @State private var servers: [Object] = []
  @State private var working = false
  @State private var error = ""
  @State private var notice = ""
  @State private var preview = ""
  @State private var previewOpen = false
  @State private var editorOpen = false
  @State private var editing: Object?
  @State private var removeTarget: String?
  @State private var liveNames: [String] = []
  @State private var liveChecked = false
  @State private var query = ""
  private func load() async {
    do {
      let result = try await desk.api("capabilities")
      skills = result["skills"] as? [Object] ?? []
      servers = result["servers"] as? [Object] ?? []
    } catch { self.error = error.localizedDescription }
  }
  private func mutate(_ route: String, _ body: Object) {
    working = true
    error = ""
    notice = ""
    liveChecked = false
    Task {
      do {
        _ = try await desk.api("capabilities/" + route, body: body)
        await load()
        if let id = desk.selected { await desk.select(id) }
        notice = "Gespeichert."
      } catch { self.error = error.localizedDescription }
      working = false
    }
  }
  private func addSkill() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    panel.prompt = "Skill verbinden"
    panel.message =
      "Wähle den Ordner, der die SKILL.md enthält. Der Skill wird zunächst deaktiviert verbunden."
    if panel.runModal() == .OK, let url = panel.url { mutate("skill-add", ["path": url.path]) }
  }
  private func inspect() {
    guard let id = desk.selected else { return }
    working = true
    error = ""
    notice = ""
    Task {
      do {
        let result = try await desk.api("capabilities/runtime?taskId=" + id)
        liveNames =
          skillsMode
          ? (result["skills"] as? [String] ?? [])
          : (result["tools"] as? [Object] ?? []).compactMap { $0["name"] as? String }
        liveChecked = true
      } catch { self.error = error.localizedDescription }
      working = false
    }
  }
  private func test(_ name: String) {
    working = true
    error = ""
    notice = ""
    Task {
      do {
        let result = try await desk.api("capabilities/mcp-test", body: ["name": name])
        preview =
          (result["message"] as? String ?? "Verbunden") + "\n\n"
          + (result["tools"] as? [String] ?? []).joined(separator: "\n")
        previewOpen = true
      } catch { self.error = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text(skillsMode ? "Verbundene Skills" : "MCP-Verbindungen").font(.headline)
        Spacer()
        if working { ProgressView().controlSize(.small) }
        Button {
          if skillsMode {
            addSkill()
          } else {
            editing = nil
            editorOpen = true
          }
        } label: {
          Image(systemName: "plus")
        }
        .help(skillsMode ? "Skill-Ordner verbinden" : "MCP-Server hinzufügen")
        .accessibilityLabel(skillsMode ? "Skill-Ordner verbinden" : "MCP-Server hinzufügen")
        .disabled(working)
      }
      Text(
        skillsMode
          ? "Lokale Skill-Ordner gezielt verbinden. Änderungen an der Quelle werden beim nächsten Sitzungsstart gelesen."
          : "Lokale Programme oder HTTP-/SSE-Server. Neue Verbindungen bleiben bis zur Aktivierung ausgeschaltet."
      )
      .font(.caption).foregroundStyle(.secondary)
      TextField(skillsMode ? "Skills suchen" : "Server suchen", text: $query).textFieldStyle(
        .roundedBorder)
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 0) {
          ForEach(
            Array(
              (skillsMode ? skills : servers).filter {
                query.isEmpty
                  || ($0["name"] as? String ?? "").localizedCaseInsensitiveContains(query)
              }.enumerated()), id: \.offset
          ) { _, row in
            let name = row["name"] as? String ?? ""
            let id = row["id"] as? String ?? name
            VStack(alignment: .leading, spacing: 7) {
              HStack {
                Text(name).font(.system(size: 13, weight: .medium)).lineLimit(1)
                Spacer()
                Toggle(
                  "Aktiviert",
                  isOn: Binding(
                    get: { row["enabled"] as? Bool ?? false },
                    set: { enabled in
                      mutate(
                        skillsMode ? "skill-state" : "mcp-state",
                        skillsMode
                          ? ["id": id, "enabled": enabled] : ["name": name, "enabled": enabled])
                    })
                )
                .toggleStyle(.switch).controlSize(.mini).labelsHidden().accessibilityLabel(
                  name + " aktivieren"
                ).disabled(working)
              }
              Text(
                skillsMode
                  ? (row["description"] as? String ?? "")
                  : ((row["type"] as? String ?? "stdio") + " · "
                    + ((row["type"] as? String ?? "stdio") == "stdio"
                      ? row["command"] as? String ?? "" : row["url"] as? String ?? ""))
              )
              .font(.caption).foregroundStyle(.secondary).lineLimit(3)
              if skillsMode {
                Text(row["path"] as? String ?? "").font(.caption2).foregroundStyle(.secondary)
                  .lineLimit(1).truncationMode(.middle).help(row["path"] as? String ?? "")
              }
              if let issue = row["error"] as? String {
                Text(issue).font(.caption).foregroundStyle(.orange)
              }
              HStack(spacing: 14) {
                Button(skillsMode ? "Ansehen" : "Bearbeiten") {
                  if skillsMode {
                    Task {
                      do {
                        let result = try await desk.api("capabilities/preview?id=" + id)
                        preview = result["text"] as? String ?? ""
                        previewOpen = true
                      } catch { self.error = error.localizedDescription }
                    }
                  } else {
                    editing = row
                    editorOpen = true
                  }
                }
                if !skillsMode { Button("Verbindung testen") { test(name) } }
                Spacer()
                Button("Entfernen") { removeTarget = id }
              }.font(.caption).disabled(working)
            }.padding(.vertical, 14)
            Divider().opacity(0.3)
          }
          if (skillsMode ? skills : servers).isEmpty {
            Text(
              skillsMode
                ? "Noch keine Skills verbunden. Wähle mit + einen Skill-Ordner aus."
                : "Noch keine MCP-Server eingerichtet. Füge mit + eine Verbindung hinzu."
            )
            .font(.system(size: 13)).foregroundStyle(.secondary).padding(.vertical, 30)
          }
        }
      }
      HStack {
        Button("Ladezustand prüfen", action: inspect).disabled(working || desk.selected == nil)
        Text(desk.selected == nil ? "Dafür zuerst einen Chat öffnen." : "Im ausgewählten Chat")
          .font(.caption).foregroundStyle(.secondary)
      }
      if liveChecked {
        Text(
          liveNames.isEmpty
            ? "Aktuell keine geladen. Nach dem Verbindungsaufbau erneut prüfen."
            : liveNames.joined(separator: " · ")
        )
        .font(.caption).foregroundStyle(.secondary).lineLimit(4).textSelection(.enabled)
      }
      if !skillsMode {
        Text(
          "Ein Verbindungstest startet den lokalen Server bzw. verbindet die URL und liest die Werkzeugliste. Er ruft keine Werkzeuge auf."
        ).font(.caption2).foregroundStyle(.secondary)
      }
      if !notice.isEmpty { Text(notice).font(.caption).foregroundStyle(.secondary) }
      if !error.isEmpty {
        Text(error).font(.caption).foregroundStyle(.orange).textSelection(.enabled)
      }
    }.task { await load() }
      .onChange(of: desk.selected) { _, _ in liveChecked = false }
      .sheet(isPresented: $previewOpen) {
        VStack(alignment: .leading, spacing: 16) {
          HStack {
            Text(skillsMode ? "Skill-Vorschau" : "Verbindungstest").font(.headline)
            Spacer()
            Button("Fertig") { previewOpen = false }.keyboardShortcut(.cancelAction)
          }
          ScrollView {
            Text(preview).font(.system(size: 12, design: .monospaced)).textSelection(.enabled)
              .frame(maxWidth: .infinity, alignment: .leading)
          }
        }.padding(24).frame(width: 620, height: 470)
      }
      .sheet(isPresented: $editorOpen) {
        MCPSettingsEditor(desk: desk, existing: editing) {
          Task {
            await load()
            liveChecked = false
          }
        }
      }
      .alert(
        skillsMode ? "Skill trennen?" : "MCP-Verbindung entfernen?",
        isPresented: Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } }),
        presenting: removeTarget
      ) { id in
        Button("Abbrechen", role: .cancel) { removeTarget = nil }
        Button("Entfernen", role: .destructive) {
          mutate(
            skillsMode ? "skill-state" : "mcp-state",
            skillsMode ? ["id": id, "remove": true] : ["name": id, "remove": true])
        }
      } message: { _ in
        Text(
          skillsMode
            ? "Der Originalordner und seine Dateien bleiben erhalten."
            : "Die gespeicherte Verbindung wird entfernt. Serverprogramme und Projektdateien bleiben erhalten."
        )
      }
  }
}

private struct MCPSettingsEditor: View {
  @ObservedObject var desk: Desk
  let existing: Object?
  let saved: () -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var type = "stdio"
  @State private var command = ""
  @State private var args = "[]"
  @State private var cwd = ""
  @State private var url = ""
  @State private var env = ""
  @State private var headers = ""
  @State private var clearSecrets = false
  @State private var enabled = false
  @State private var working = false
  @State private var error = ""
  private func json(_ text: String) throws -> Any {
    guard let data = text.data(using: .utf8) else { throw URLError(.cannotDecodeContentData) }
    return try JSONSerialization.jsonObject(with: data)
  }
  private func save() {
    error = ""
    do {
      var config: Object = ["type": type, "enabled": enabled]
      if type == "stdio" {
        config["command"] = command
        config["args"] = try json(args)
        config["cwd"] = cwd
      } else {
        config["url"] = url
      }
      if !env.isEmpty {
        config["env"] = try json(env)
      } else if clearSecrets {
        config["env"] = Object()
      }
      if !headers.isEmpty {
        config["headers"] = try json(headers)
      } else if clearSecrets {
        config["headers"] = Object()
      }
      working = true
      Task {
        do {
          _ = try await desk.api(
            "capabilities/mcp-save",
            body: ["name": name, "config": config, "edit": existing != nil])
          saved()
          dismiss()
          if let id = desk.selected { await desk.select(id) }
        } catch { self.error = error.localizedDescription }
        working = false
      }
    } catch {
      self.error =
        "Argumente müssen ein JSON-Array sein, Header und Variablen JSON-Objekte. "
        + error.localizedDescription
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text(existing == nil ? "MCP-Server hinzufügen" : "MCP-Server bearbeiten").font(.title2)
      ScrollView {
        VStack(alignment: .leading, spacing: 15) {
          TextField("Servername", text: $name).disabled(existing != nil).accessibilityLabel(
            "Servername")
          Picker("Verbindung", selection: $type) {
            Text("Lokales Programm").tag("stdio")
            Text("HTTP").tag("http")
            Text("SSE").tag("sse")
          }
          if type == "stdio" {
            TextField("Programm, z. B. /opt/homebrew/bin/npx", text: $command).accessibilityLabel(
              "Programm")
            Text("Argumente als JSON-Liste").font(.caption).foregroundStyle(.secondary)
            TextField("[\"-y\", \"paketname\"]", text: $args).accessibilityLabel("Argumente")
            TextField("Arbeitsordner · optional", text: $cwd).accessibilityLabel("Arbeitsordner")
          } else {
            TextField("https://example.com/mcp", text: $url).accessibilityLabel("MCP-URL")
          }
          DisclosureGroup("Header und Umgebungsvariablen") {
            VStack(alignment: .leading, spacing: 10) {
              Text(
                "JSON-Objekte. Leer lassen behält gespeicherte Werte. {} entfernt die jeweiligen Werte."
              ).font(.caption).foregroundStyle(.secondary)
              Text("Header").font(.caption)
              TextEditor(text: $headers).font(.system(size: 12, design: .monospaced)).frame(
                height: 65
              ).accessibilityLabel("Header als JSON")
              Text("Umgebungsvariablen").font(.caption)
              TextEditor(text: $env).font(.system(size: 12, design: .monospaced)).frame(height: 65)
                .accessibilityLabel("Umgebungsvariablen als JSON")
              if existing != nil {
                Text(
                  "Gespeichert: \((existing?["headerKeys"] as? [String] ?? []).joined(separator:", ")) \((existing?["envKeys"] as? [String] ?? []).joined(separator:", "))"
                ).font(.caption2).foregroundStyle(.secondary)
                Toggle("Gespeicherte Header und Variablen entfernen", isOn: $clearSecrets).font(
                  .caption)
              }
            }.padding(.top, 10)
          }
          Toggle("Für Agenten aktivieren", isOn: $enabled)
          Text(
            "Aktivierte Server werden beim Sitzungsstart verbunden. Änderungen werden nur im Leerlauf übernommen."
          ).font(.caption).foregroundStyle(.secondary)
          if existing?["hasOAuth"] as? Bool == true {
            Text(
              "Vorhandene OAuth-Konfiguration bleibt bei unverändertem Ziel erhalten. Neue OAuth-Anmeldungen sind hier noch nicht verfügbar."
            ).font(.caption).foregroundStyle(.secondary)
          }
        }.textFieldStyle(.roundedBorder)
      }
      if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.orange) }
      HStack {
        Button("Abbrechen") { dismiss() }.keyboardShortcut(.cancelAction)
        Spacer()
        if working { ProgressView().controlSize(.small) }
        Button("Speichern", action: save).keyboardShortcut(.defaultAction).disabled(name.isEmpty)
      }
    }.padding(26).frame(width: 570, height: 540).disabled(working)
      .onAppear {
        if let c = existing {
          name = c["name"] as? String ?? ""
          type = c["type"] as? String ?? "stdio"
          command = c["command"] as? String ?? ""
          url = c["url"] as? String ?? ""
          cwd = c["cwd"] as? String ?? ""
          enabled = c["enabled"] as? Bool ?? false
          if let data = try? JSONSerialization.data(withJSONObject: c["args"] as? [String] ?? []),
            let text = String(data: data, encoding: .utf8)
          {
            args = text
          }
        }
      }
  }
}
