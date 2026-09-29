import AppKit
import SwiftUI

struct ExtensionSettingsView: View {
  @ObservedObject var desk: Desk
  @State private var plugins: [Object] = []
  @State private var hooks: [Object] = []
  @State private var installed: [Object] = []
  @State private var working = false
  @State private var error = ""
  @State private var notice = ""
  @State private var package = ""
  @State private var marketplace = ""
  @State private var removePlugin: String?
  @State private var removeHook: String?

  private func load() async {
    do {
      let result = try await desk.api("capabilities")
      plugins = result["plugins"] as? [Object] ?? []
      hooks = result["hooks"] as? [Object] ?? []
      installed = result["installed"] as? [Object] ?? []
      error = ""
    } catch { self.error = error.localizedDescription }
  }
  private func mutate(_ route: String, _ body: Object, message: String = "Gespeichert.") {
    working = true
    error = ""
    notice = ""
    Task {
      do {
        _ = try await desk.api("capabilities/" + route, body: body)
        await load()
        if let id = desk.selected { await desk.select(id) }
        notice = message
      } catch { self.error = error.localizedDescription }
      working = false
    }
  }
  private func pickPlugin() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.prompt = "Plugin verbinden"
    panel.message = "Ordner mit package.json. Neu verbundene Plugins bleiben ausgeschaltet."
    if panel.runModal() == .OK, let url = panel.url {
      mutate("plugin-add", ["path": url.path], message: "Plugin verbunden.")
    }
  }
  private func pickHook() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowedContentTypes = [.unixExecutable, .sourceCode, .item]
    panel.prompt = "Hook verbinden"
    panel.message = "JavaScript- oder TypeScript-Hookdatei."
    if panel.runModal() == .OK, let url = panel.url {
      mutate("hook-add", ["path": url.path], message: "Hook verbunden.")
    }
  }
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        HStack {
          Text("Lokale Plugins").font(.headline)
          Spacer()
          if working { ProgressView().controlSize(.small) }
          Button { pickPlugin() } label: { Image(systemName: "plus") }
            .help("Plugin-Ordner verbinden").accessibilityLabel("Plugin-Ordner verbinden")
            .disabled(working)
        }
        Text(
          "Lokale Ordner mit package.json. Aktivierte Pfade werden als --plugin-dir geladen. npm-Installationen brauchen Bun."
        ).font(.caption).foregroundStyle(.secondary)
        pluginList
        Divider().opacity(0.35)
        HStack {
          Text("Hooks").font(.headline)
          Spacer()
          Button { pickHook() } label: { Image(systemName: "plus") }
            .help("Hookdatei verbinden").accessibilityLabel("Hookdatei verbinden").disabled(working)
        }
        hookList
        Divider().opacity(0.35)
        Text("Paket oder Marketplace").font(.headline)
        HStack {
          TextField("npm-Paket oder Git-URL", text: $package)
          Button("Installieren") {
            mutate("plugin-install", ["target": package], message: "Installiert.")
          }.disabled(working || package.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        HStack {
          TextField("Marketplace-Quelle", text: $marketplace)
          Button("Hinzufügen") {
            mutate("marketplace", ["source": marketplace], message: "Marketplace gespeichert.")
          }.disabled(working || marketplace.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        if !installed.isEmpty {
          Text("OMP-Registry").font(.caption).foregroundStyle(.secondary)
          ForEach(Array(installed.enumerated()), id: \.offset) { _, row in
            HStack {
              VStack(alignment: .leading, spacing: 3) {
                Text(row["name"] as? String ?? "").font(.system(size: 13, weight: .medium))
                Text((row["source"] as? String ?? "") + " · " + (row["version"] as? String ?? ""))
                  .font(.caption).foregroundStyle(.secondary)
              }
              Spacer()
              Toggle(
                "Aktiv",
                isOn: Binding(
                  get: { row["enabled"] as? Bool ?? false },
                  set: { enabled in
                    mutate(
                      "plugin-installed",
                      ["name": row["name"] as? String ?? "", "enabled": enabled])
                  })
              ).toggleStyle(.switch).controlSize(.mini).labelsHidden().disabled(working)
            }.padding(.vertical, 8)
          }
        }
        if !notice.isEmpty { Text(notice).font(.caption).foregroundStyle(.secondary) }
        if !error.isEmpty {
          Text(error).font(.caption).foregroundStyle(.orange).textSelection(.enabled)
        }
      }
    }.task { await load() }
      .alert(
        "Plugin trennen?",
        isPresented: Binding(get: { removePlugin != nil }, set: { if !$0 { removePlugin = nil } }),
        presenting: removePlugin
      ) { id in
        Button("Abbrechen", role: .cancel) { removePlugin = nil }
        Button("Entfernen", role: .destructive) {
          mutate("plugin-state", ["id": id, "remove": true], message: "Getrennt.")
        }
      } message: { _ in Text("Der Originalordner bleibt erhalten.") }
      .alert(
        "Hook trennen?",
        isPresented: Binding(get: { removeHook != nil }, set: { if !$0 { removeHook = nil } }),
        presenting: removeHook
      ) { id in
        Button("Abbrechen", role: .cancel) { removeHook = nil }
        Button("Entfernen", role: .destructive) {
          mutate("hook-state", ["id": id, "remove": true], message: "Getrennt.")
        }
      } message: { _ in Text("Die Originaldatei bleibt erhalten.") }
  }
  private var pluginList: some View {
    VStack(alignment: .leading, spacing: 0) {
      ForEach(Array(plugins.enumerated()), id: \.offset) { _, row in
        let id = row["id"] as? String ?? ""
        VStack(alignment: .leading, spacing: 6) {
          HStack {
            Text(row["name"] as? String ?? "").font(.system(size: 13, weight: .medium))
            Spacer()
            Toggle(
              "Aktiv",
              isOn: Binding(
                get: { row["enabled"] as? Bool ?? false },
                set: { enabled in mutate("plugin-state", ["id": id, "enabled": enabled]) })
            ).toggleStyle(.switch).controlSize(.mini).labelsHidden().disabled(working)
          }
          Text(row["path"] as? String ?? "").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            .truncationMode(.middle)
          if let issue = row["error"] as? String {
            Text(issue).font(.caption).foregroundStyle(.orange)
          }
          Button("Entfernen") { removePlugin = id }.font(.caption).disabled(working)
        }.padding(.vertical, 12)
        Divider().opacity(0.3)
      }
      if plugins.isEmpty {
        Text("Noch keine lokalen Plugins verbunden.").font(.caption).foregroundStyle(.secondary)
          .padding(.vertical, 12)
      }
    }
  }
  private var hookList: some View {
    VStack(alignment: .leading, spacing: 0) {
      ForEach(Array(hooks.enumerated()), id: \.offset) { _, row in
        let id = row["id"] as? String ?? ""
        VStack(alignment: .leading, spacing: 6) {
          HStack {
            Text(row["name"] as? String ?? "").font(.system(size: 13, weight: .medium))
            Spacer()
            Toggle(
              "Aktiv",
              isOn: Binding(
                get: { row["enabled"] as? Bool ?? false },
                set: { enabled in mutate("hook-state", ["id": id, "enabled": enabled]) })
            ).toggleStyle(.switch).controlSize(.mini).labelsHidden().disabled(working)
          }
          Text(row["path"] as? String ?? "").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
          if let issue = row["error"] as? String {
            Text(issue).font(.caption).foregroundStyle(.orange)
          }
          Button("Entfernen") { removeHook = id }.font(.caption).disabled(working)
        }.padding(.vertical, 12)
        Divider().opacity(0.3)
      }
      if hooks.isEmpty {
        Text("Noch keine Hooks verbunden.").font(.caption).foregroundStyle(.secondary).padding(
          .vertical, 12)
      }
    }
  }
}

struct ProjectRulesView: View {
  @ObservedObject var desk: Desk
  @State private var files: [Object] = []
  @State private var selected = "AGENTS.md"
  @State private var text = ""
  @State private var working = false
  @State private var notice = ""
  @State private var error = ""
  private func load() async {
    guard let id = desk.project?.id else { return }
    do {
      let result = try await desk.api("rules?projectId=" + id)
      files = result["files"] as? [Object] ?? []
      if let current = files.first(where: { ($0["name"] as? String) == selected }) {
        text = current["text"] as? String ?? ""
      } else {
        text = ""
      }
      error = ""
    } catch { self.error = error.localizedDescription }
  }
  private func save() {
    guard let id = desk.project?.id else { return }
    working = true
    notice = ""
    error = ""
    Task {
      do {
        let result = try await desk.api(
          "rules", body: ["projectId": id, "name": selected, "text": text])
        files = result["files"] as? [Object] ?? []
        notice = "Gespeichert in diesem Projekt."
      } catch { self.error = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      if desk.project == nil {
        Text("Zuerst ein Projekt öffnen, um AGENTS.md und verwandte Regeln zu bearbeiten.").font(
          .caption
        ).foregroundStyle(.secondary)
      } else {
        Picker("Datei", selection: $selected) {
          ForEach(Array(files.enumerated()), id: \.offset) { _, file in
            let name = file["name"] as? String ?? ""
            Text(name + ((file["exists"] as? Bool == true) ? "" : " · neu")).tag(name)
          }
        }
        TextEditor(text: $text).font(.system(size: 12, design: .monospaced))
          .scrollContentBackground(.hidden).padding(8).frame(minHeight: 280).background(
            Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 8)
          )
          .accessibilityLabel("Projektregeln")
        HStack {
          Text("Gilt für dieses Repository. Leer speichern entfernt die Datei.").font(.caption)
            .foregroundStyle(.secondary)
          Spacer()
          Button("Speichern", action: save).disabled(working)
        }
        if !notice.isEmpty { Text(notice).font(.caption).foregroundStyle(.secondary) }
        if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.orange) }
      }
    }.task { await load() }
      .onChange(of: selected) { _, _ in
        text = files.first { ($0["name"] as? String) == selected }?["text"] as? String ?? ""
      }
      .onChange(of: desk.selected) { _, _ in Task { await load() } }
  }
}

struct WorktreePanel: View {
  @ObservedObject var desk: Desk
  @State private var rows: [Object] = []
  @State private var branch = ""
  @State private var destination = ""
  @State private var working = false
  @State private var error = ""
  private func load() async {
    guard let id = desk.project?.id else { return }
    do {
      let result = try await desk.api("worktrees?projectId=" + id)
      rows = result["worktrees"] as? [Object] ?? []
      error = ""
    } catch { self.error = error.localizedDescription }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Zusätzliche Checkouts dieses Repositories. Das Original bleibt unangetastet.").font(
        .caption
      ).foregroundStyle(.secondary)
      HStack {
        TextField("Branch", text: $branch).textFieldStyle(.roundedBorder)
        TextField("Ordnername", text: $destination).textFieldStyle(.roundedBorder)
        Button("Anlegen") {
          guard let id = desk.project?.id else { return }
          working = true
          error = ""
          Task {
            do {
              let result = try await desk.api(
                "worktrees",
                body: ["projectId": id, "branch": branch, "path": destination])
              rows = result["worktrees"] as? [Object] ?? []
              branch = ""
              destination = ""
            } catch { self.error = error.localizedDescription }
            working = false
          }
        }.disabled(working || destination.trimmingCharacters(in: .whitespaces).isEmpty)
      }
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 8) {
          ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
            HStack {
              VStack(alignment: .leading, spacing: 3) {
                Text(row["branch"] as? String ?? "(detached)").font(
                  .system(size: 12, weight: .medium))
                Text(row["path"] as? String ?? "").font(.caption2).foregroundStyle(.secondary)
                  .lineLimit(2)
              }
              Spacer()
              Button("Entfernen") {
                guard let id = desk.project?.id, let path = row["path"] as? String else { return }
                working = true
                Task {
                  do {
                    let result = try await desk.api(
                      "worktrees", body: ["projectId": id, "path": path, "remove": true])
                    rows = result["worktrees"] as? [Object] ?? []
                  } catch { self.error = error.localizedDescription }
                  working = false
                }
              }.font(.caption).disabled(working)
            }.padding(.vertical, 6)
            Divider().opacity(0.3)
          }
          if rows.isEmpty {
            Text("Keine zusätzlichen Worktrees.").font(.caption).foregroundStyle(.secondary)
              .padding(.vertical, 20)
          }
        }
      }
      if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.orange) }
    }.task { await load() }
      .onChange(of: desk.selected) { _, _ in Task { await load() } }
  }
}
