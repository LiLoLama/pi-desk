import AppKit
import SwiftUI

// Quiet Studio / Operate: one library, three views, open rows and native controls.
// Existing models lead; discover/download and folder management remain distinct.
struct LocalModelsView: View {
  @ObservedObject var desk: Desk
  @State private var tab = "library"
  @State private var format = "mlx"
  @State private var query = ""
  @State private var state: Object = [:]
  @State private var results: [Object] = []
  @State private var detail: Object?
  @State private var chosenFile = ""
  @State private var destination = ""
  @State private var searching = false
  @State private var searched = false
  @State private var working = false
  @State private var failure = ""
  @State private var wasRunning = false
  private var job: Object { state["job"] as? Object ?? [:] }
  private var running: Bool { job["running"] as? Bool ?? false }
  private var active: Object { state["active"] as? Object ?? [:] }
  private var folders: [String] { state["folders"] as? [String] ?? [] }
  private var models: [Object] { state["models"] as? [Object] ?? [] }
  private func size(_ value: Any?) -> String {
    ByteCountFormatter.string(fromByteCount: (value as? NSNumber)?.int64Value ?? 0, countStyle: .file)
  }
  private func memoryFit(_ value: Any?) -> String {
    let bytes = (value as? NSNumber)?.doubleValue ?? 0
    let memory = (state["memory"] as? NSNumber)?.doubleValue ?? 1
    if bytes == 0 { return "Speicherbedarf unbekannt" }
    let estimate = bytes * 1.25 + 2 * pow(1024.0, 3)
    return estimate < memory * 0.65 ? "Gute Speicherreserve auf diesem Mac · Schätzung" : estimate < memory * 0.85 ? "Knapp bemessen auf diesem Mac · Schätzung" : "Voraussichtlich zu groß für diesen Mac"
  }
  private func refresh() async {
    do {
      state = try await desk.api("local-models")
      if destination.isEmpty { destination = folders.first ?? "" }
      if wasRunning && !running, let id = desk.selected { await desk.select(id) }
      wasRunning = running
    } catch { failure = error.localizedDescription }
  }
  private func action(_ route: String, _ body: Object = [:]) {
    working = true; failure = ""
    Task {
      do { _ = try await desk.api("local-models/" + route, body: body); await refresh() }
      catch { failure = error.localizedDescription }
      working = false
    }
  }
  private func addFolder() {
    let panel = NSOpenPanel(); panel.canChooseFiles = false; panel.canChooseDirectories = true
    panel.allowsMultipleSelection = true; panel.prompt = "Ordner verbinden"
    if panel.runModal() == .OK {
      working = true
      Task {
        do { for url in panel.urls { _ = try await desk.api("local-models/folder", body: ["path": url.path]) }; await refresh() }
        catch { failure = error.localizedDescription }
        working = false
      }
    }
  }
  private func search() {
    searching = true; searched = true; failure = ""; detail = nil
    let selectedFormat = format
    Task {
      do {
        let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+#?"))) ?? ""
        let data = try await desk.api("local-models/catalog?format=\(selectedFormat)&q=\(q)")
        if format == selectedFormat { results = data["models"] as? [Object] ?? [] }
      } catch { failure = error.localizedDescription }
      searching = false
    }
  }
  private func inspect(_ model: Object) {
    working = true; failure = ""
    let selectedFormat = format
    Task {
      do {
        let repo = model["id"] as? String ?? ""
        let received = try await desk.api("local-models/files?format=\(selectedFormat)&repo=\(repo)")
        guard format == selectedFormat else { working = false; return }
        detail = received
        chosenFile = model["suggestedFile"] as? String ?? (((detail?["files"] as? [Object]) ?? []).first?["name"] as? String ?? "")
      } catch { failure = error.localizedDescription }
      working = false
    }
  }
  private func useInChat() {
    guard let id = desk.selected else { return }
    working = true; failure = ""
    Task {
      do {
        await desk.select(id)
        _ = try await desk.api("model", body: ["taskId": id, "provider": "pi-desk-local", "modelId": "local"])
        await desk.select(id)
      } catch { failure = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Picker("Modellbibliothek", selection: $tab) {
          Text("Auf diesem Mac").tag("library")
          Text("Entdecken").tag("discover")
          Text("Ordner").tag("folders")
        }.pickerStyle(.segmented).labelsHidden()
        if working { ProgressView().controlSize(.small) }
      }
      HStack {
        Label("\(Int(((state["memory"] as? NSNumber)?.doubleValue ?? 0) / pow(1024.0, 3))) GB Arbeitsspeicher", systemImage: "memorychip")
        Spacer()
        Text("MLX · GGUF")
      }.font(.caption).foregroundStyle(.secondary)
      if running {
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text(job["label"] as? String ?? "Vorbereiten …").font(.caption)
            Spacer()
            Button("Abbrechen") { action("cancel") }
          }
          if let total = job["total"] as? Double, total > 0 {
            ProgressView(value: min(job["done"] as? Double ?? 0, total), total: total)
            Text("\(size(job["done"])) von \(size(total))").font(.caption2).foregroundStyle(.secondary)
          } else { ProgressView().controlSize(.small) }
        }
      }
      if let error = job["error"] as? String, !error.isEmpty {
        Text(error).font(.caption).foregroundStyle(.orange).textSelection(.enabled)
      }
      if tab == "library" { library }
      else if tab == "folders" { folderList }
      else { discover }
      if !failure.isEmpty { Text(failure).font(.caption).foregroundStyle(.orange).textSelection(.enabled) }
    }
    .task {
      await refresh()
      while !Task.isCancelled {
        try? await Task.sleep(for: .seconds(1))
        if !Task.isCancelled { await refresh() }
      }
    }
  }
  private var library: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Text("Vorhandene Modelle").font(.headline)
        Spacer()
        Button { action("scan") } label: { Image(systemName: "arrow.clockwise") }
          .help("Modellordner neu einlesen").accessibilityLabel("Bibliothek aktualisieren").disabled(working || running)
      }
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 0) {
          if models.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
              Text("Deine Modelle direkt in Pi Desk.").font(.system(size: 17, weight: .medium))
              Text("Verbinde einen vorhandenen Modellordner oder lade ein Modell unter Entdecken. Pi Desk übernimmt die Ausführung.")
                .font(.system(size: 12)).foregroundStyle(.secondary)
              Button("Modellordner wählen …", action: addFolder)
            }.padding(.vertical, 24)
          }
          ForEach(Array(models.enumerated()), id: \.offset) { _, model in
            let id = model["id"] as? String ?? ""
            let isActive = active["id"] as? String == id
            VStack(alignment: .leading, spacing: 7) {
              HStack(alignment: .top) {
                Image(systemName: "cpu").foregroundStyle(.secondary).padding(.top, 2)
                VStack(alignment: .leading, spacing: 5) {
                  Text(model["name"] as? String ?? "Modell").font(.system(size: 13, weight: .medium)).lineLimit(2)
                  Text("\((model["format"] as? String ?? "").uppercased()) · \(size(model["bytes"])) · \(model["fit"] as? String ?? "")")
                    .font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                if isActive && active["state"] as? String == "ready" {
                  Button("Entladen") { action("stop") }.disabled(running || working)
                } else {
                  Button("Laden") { action("start", ["id": id]) }.disabled(running || working)
                }
              }
              if isActive {
                if let error = active["error"] as? String, !error.isEmpty { Text(error).font(.caption).foregroundStyle(.orange) }
                if active["state"] as? String == "ready" {
                  HStack {
                    Label("Im Speicher", systemImage: "checkmark.circle").foregroundStyle(.green)
                    Spacer()
                    Button("Im aktuellen Chat verwenden", action: useInChat).disabled(desk.selected == nil || working)
                  }.font(.caption)
                }
              }
            }.padding(.vertical, 14).help(model["path"] as? String ?? "")
            Divider().opacity(0.3)
          }
        }
      }
      Text("Beim ersten Laden richtet Pi Desk die passende Engine ein. Ein Modell gleichzeitig; Entladen gibt Speicher frei. Speicherpassung ist eine Schätzung – Architektur und Werkzeugaufrufe hängen vom Modell ab.")
        .font(.caption2).foregroundStyle(.secondary)
    }
  }
  private var folderList: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Text("Modellordner").font(.headline); Spacer()
        Button(action: addFolder) { Image(systemName: "plus") }.help("Modellordner hinzufügen").accessibilityLabel("Modellordner hinzufügen").disabled(working)
      }
      ScrollView {
        VStack(alignment: .leading, spacing: 15) {
          ForEach(folders, id: \.self) { folder in
            HStack {
              Image(systemName: "folder").foregroundStyle(.secondary)
              Text(folder).font(.caption).lineLimit(2).truncationMode(.middle).textSelection(.enabled)
              Spacer()
              if folder != folders.first {
                Button { action("folder", ["path": folder, "remove": true]) } label: { Image(systemName: "minus.circle") }
                  .help("Nur aus der Bibliothek entfernen").accessibilityLabel("Ordner trennen").disabled(working)
              }
            }
          }
          ForEach(state["suggested"] as? [String] ?? [], id: \.self) { folder in
            HStack {
              Text(folder).font(.caption).foregroundStyle(.secondary).lineLimit(2)
              Spacer()
              Button("Verbinden") { action("folder", ["path": folder]) }.disabled(working)
            }
          }
          ForEach(Array((state["errors"] as? [Object] ?? []).enumerated()), id: \.offset) { _, issue in
            Text("\(issue["path"] as? String ?? ""): \(issue["message"] as? String ?? "")").font(.caption).foregroundStyle(.orange)
          }
        }.padding(.vertical, 8)
      }
      Text("GGUF-Dateien und MLX-/Safetensors-Modellordner werden rekursiv erkannt. Bestehende Dateien werden weder verschoben noch gelöscht.").font(.caption).foregroundStyle(.secondary)
    }
  }
  private var discover: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let detail {
        HStack {
          Button { self.detail = nil } label: { Label("Suche", systemImage: "chevron.left") }
          Spacer()
          if let repo = detail["repo"] as? String, let url = URL(string: "https://huggingface.co/" + repo) { Link("Modellseite ↗", destination: url) }
        }
        Text(detail["repo"] as? String ?? "Modell").font(.headline).textSelection(.enabled)
        Text("Lizenz: \(detail["license"] as? String ?? "Auf Modellseite prüfen")").font(.caption).foregroundStyle(.secondary)
        if format == "gguf" {
          Picker("Datei / Quantisierung", selection: $chosenFile) {
            ForEach(Array((detail["files"] as? [Object] ?? []).enumerated()), id: \.offset) { _, file in
              Text("\(file["name"] as? String ?? "") · \(size(file["bytes"]))").tag(file["name"] as? String ?? "")
            }
          }
        }
        let selectedBytes: Any? = format == "mlx" ? detail["bytes"] : (detail["files"] as? [Object])?.first(where: { $0["name"] as? String == chosenFile })?["variantBytes"]
        Text("Download: \(size(selectedBytes))\(format == "gguf" ? " · Zusammengehörige Teildateien werden gemeinsam geladen." : "")").font(.caption).foregroundStyle(.secondary)
        Text(memoryFit(selectedBytes)).font(.caption).foregroundStyle(.secondary)
        Picker("Speichern in", selection: $destination) {
          ForEach(folders, id: \.self) { Text($0).tag($0) }
        }
        Button("Herunterladen") {
          action("download", ["repo": detail["repo"] as? String ?? "", "format": format, "filename": chosenFile, "destination": destination, "revision": detail["revision"] as? String ?? ""])
        }.disabled(working || running || destination.isEmpty)
        Spacer()
      } else {
        HStack {
          TextField("Modelle auf Hugging Face suchen", text: $query).textFieldStyle(.roundedBorder).onSubmit(search)
          Picker("Format", selection: $format) { Text("MLX").tag("mlx"); Text("GGUF").tag("gguf") }.labelsHidden().frame(width: 95)
          Button(action: search) { Image(systemName: "magnifyingglass") }.help("Modelle suchen").accessibilityLabel("Modelle suchen").disabled(searching)
        }
        Text("Hugging Face · Speicherpassung zuerst, dann Beliebtheit. Empfehlungen schätzen den Speicherbedarf; kein Leistungsbenchmark.").font(.caption).foregroundStyle(.secondary)
        if searching { ProgressView("Modelle suchen …").controlSize(.small) }
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 0) {
            if results.isEmpty && !searching {
              Text(searched ? "Keine passenden Modelle gefunden." : "Suche nach einem Modellnamen oder zeige beliebte Modelle mit der Lupe.")
                .font(.system(size: 12)).foregroundStyle(.secondary).padding(.vertical, 26)
            }
            ForEach(Array(results.enumerated()), id: \.offset) { _, model in
              HStack {
                VStack(alignment: .leading, spacing: 5) {
                  Text(model["name"] as? String ?? "Modell").font(.system(size: 13, weight: .medium)).lineLimit(2)
                  Text(model["id"] as? String ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                  Text("\(size(model["bytes"])) · \(model["fit"] as? String ?? "Größe unbekannt")").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Details") { inspect(model) }.disabled(working)
              }.padding(.vertical, 13)
              Divider().opacity(0.3)
            }
          }
        }
      }
    }.onChange(of: format) { _, _ in results = []; searched = false; detail = nil }
  }
}
