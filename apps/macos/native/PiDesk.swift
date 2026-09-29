import AppKit
import SwiftUI
import UniformTypeIdentifiers

typealias Object = [String: Any]
private func string(_ object: Object, _ key: String) -> String { object[key] as? String ?? "" }
private func objects(_ object: Object, _ key: String) -> [Object] { object[key] as? [Object] ?? [] }
private let deskBackground = Color(red: 0.105, green: 0.114, blue: 0.118)
private let accent = Color(red: 0.73, green: 0.81, blue: 0.72)
private let modeLabels = [
  "always-ask": "Nachfragen", "write": "Dateien erlauben", "yolo": "Vollzugriff",
]

struct Project: Identifiable {
  let id: String
  let name: String
  let path: String
  init(_ o: Object) {
    id = string(o, "id")
    name = string(o, "name")
    path = string(o, "path")
  }
}
struct DeskTask: Identifiable {
  let id: String
  let projectID: String
  let title: String
  let mode: String
  let model: String
  let modelID: String
  let modelProvider: String
  let busy: Bool
  let archived: Bool
  let deleted: Bool
  var active: Bool { !archived && !deleted }
  init(_ o: Object) {
    id = string(o, "id")
    projectID = string(o, "projectId")
    title = string(o, "title")
    mode = string(o, "mode")
    let m = o["model"] as? Object ?? [:]
    modelID = string(m, "id")
    modelProvider = string(m, "provider")
    let named = string(m, "name")
    model = named.isEmpty ? modelID : named
    busy = o["busy"] as? Bool ?? false
    archived = o["archivedAt"] is String
    deleted = o["deletedAt"] is String
  }
}
struct DraftImage: Identifiable, Equatable {
  let id: String
  let data: Data
  let mime: String
  var payload: Object { ["data": data.base64EncodedString(), "mimeType": mime] }
}

struct QueuedMessage: Identifiable {
  let id: String
  let kind: String
  let text: String
  init(_ o: Object) {
    id = string(o, "id")
    kind = string(o, "kind")
    text = string(o, "text")
  }
}

struct ChatMessage: Identifiable, Equatable {
  let id: Int
  let role: String
  let text: String
  let tool: String
  let error: Bool
  let sentAt: Date?
  init(_ o: Object, index: Int) {
    id = index
    role = string(o, "role")
    tool = string(o, "toolName")
    error = o["isError"] as? Bool ?? false
    let raw =
      (o["content"] as? String)
      ?? objects(o, "content").filter { string($0, "type") == "text" }.map { string($0, "text") }
      .joined(separator: "\n")
    text =
      role == "user"
      ? (raw.components(separatedBy: "\n\n[Angehängter Dateikontext").first ?? raw) : raw
    if let ms = o["timestamp"] as? Double {
      sentAt = Date(timeIntervalSince1970: ms / 1000)
    } else if let ms = o["timestamp"] as? Int {
      sentAt = Date(timeIntervalSince1970: Double(ms) / 1000)
    } else {
      sentAt = nil
    }
  }
}

struct MessageGroup: Identifiable, Equatable {
  let id: Int
  let messages: [ChatMessage]
  var role: String { messages.first?.role ?? "" }
}

private func groupedMessages(_ messages: [ChatMessage]) -> [MessageGroup] {
  var result: [MessageGroup] = []
  for message in messages {
    if message.role == "toolResult", let last = result.last, last.role == "toolResult" {
      result[result.count - 1] = MessageGroup(id: last.id, messages: last.messages + [message])
    } else {
      result.append(MessageGroup(id: message.id, messages: [message]))
    }
  }
  return result
}

struct ToolActivityGroup: View {
  let messages: [ChatMessage]
  var onOpenFile: (String) -> Void = { _ in }
  var onRevealFile: (String) -> Void = { _ in }
  var onOpenURL: (String) -> Void = { _ in }
  @State private var expanded = false
  private var failed: Bool { messages.contains { $0.error } }
  private var summary: String {
    let counts = Dictionary(grouping: messages, by: { $0.tool }).mapValues(\.count)
    return counts.sorted { $0.key < $1.key }.prefix(3).map {
      $0.value == 1 ? $0.key : "\($0.value)× \($0.key)"
    }.joined(separator: " · ")
  }
  var body: some View {
    DisclosureGroup(isExpanded: $expanded) {
      VStack(alignment: .leading, spacing: 13) {
        ForEach(messages) { message in
          VStack(alignment: .leading, spacing: 5) {
            Label(
              message.tool + (message.error ? " · Fehlgeschlagen" : ""),
              systemImage: message.error ? "exclamationmark.circle" : "checkmark.circle"
            ).font(.caption).foregroundStyle(message.error ? Color.orange : Color.secondary)
            if !message.text.isEmpty {
              ChatMarkdown(
                text: message.text, fontSize: 11, plain: true, onOpenFile: onOpenFile,
                onRevealFile: onRevealFile, onOpenURL: onOpenURL
              )
              .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
      }.padding(.top, 11).padding(.leading, 20)
    } label: {
      HStack(spacing: 7) {
        Image(systemName: failed ? "exclamationmark.circle" : "checkmark.circle")
        Text("Arbeit · \(messages.count) \(messages.count == 1 ? "Schritt" : "Schritte")")
        if !summary.isEmpty { Text(summary).foregroundStyle(.tertiary) }
      }.font(.caption).foregroundStyle(failed ? Color.orange : Color.secondary)
    }
    .accessibilityLabel(
      "Arbeit, \(messages.count) \(messages.count == 1 ? "Schritt" : "Schritte"), \(expanded ? "ausgeklappt" : "eingeklappt")"
    )
  }
}

struct WorkingStatus: View {
  let startedAt: Date
  let tools: [ChatMessage]
  let waiting: Bool
  let reduceMotion: Bool
  @State private var expanded = false
  var body: some View {
    DisclosureGroup(isExpanded: $expanded) {
      if tools.isEmpty {
        Text("Der Agent plant den nächsten Schritt.").font(.caption).foregroundStyle(.secondary)
          .padding(.leading, 20).padding(.top, 8)
      } else {
        VStack(alignment: .leading, spacing: 7) {
          ForEach(tools) { message in
            Label(message.tool, systemImage: message.error ? "exclamationmark.circle" : "checkmark.circle")
              .font(.caption).foregroundStyle(message.error ? Color.orange : Color.secondary)
          }
        }.padding(.leading, 20).padding(.top, 8)
      }
    } label: {
      HStack(spacing: 8) {
        WorkingDots(reduceMotion: reduceMotion)
        Text(waiting ? "Wartet auf Genehmigung" : "Arbeitet")
        WorkingElapsed(startedAt: startedAt, reduceMotion: reduceMotion)
        if !tools.isEmpty {
          Text("· \(tools.count) \(tools.count == 1 ? "Schritt" : "Schritte")")
            .foregroundStyle(.tertiary)
        }
      }.font(.caption).foregroundStyle(.secondary)
    }
  }
}

private struct WorkingDots: View {
  let reduceMotion: Bool
  var body: some View {
    TimelineView(.periodic(from: .now, by: reduceMotion ? 1 : 0.45)) { timeline in
      HStack(spacing: 3) {
        ForEach(0..<3, id: \.self) { index in
          Circle().fill(accent).frame(width: 4, height: 4).opacity(
            reduceMotion ? 0.7 : ((Int(timeline.date.timeIntervalSince1970 * 2) + index) % 3 == 0 ? 1 : 0.28)
          )
        }
      }.frame(width: 18)
    }
  }
}

private struct WorkingElapsed: View {
  let startedAt: Date
  let reduceMotion: Bool
  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { timeline in
      let seconds = max(0, Int(timeline.date.timeIntervalSince(startedAt)))
      Text("· \(seconds < 60 ? "\(seconds) s" : "\(seconds / 60) min \(seconds % 60) s")")
        .monospacedDigit().foregroundStyle(.tertiary)
    }
  }
}
struct FileItem: Identifiable {
  let name: String
  let path: String
  let directory: Bool
  var id: String { path }
  init(_ o: Object) {
    name = string(o, "name")
    path = string(o, "path")
    directory = o["directory"] as? Bool ?? false
  }
  init(path: String, directory: Bool = false) {
    name = (path as NSString).lastPathComponent
    self.path = path
    self.directory = directory
  }
}
struct UIRequest: Identifiable {
  let id: String
  let method: String
  let title: String
  let message: String
  let url: String
  let options: [String]
  init(_ o: Object) {
    id = string(o, "id")
    method = string(o, "method")
    title = string(o, "title")
    message = string(o, "message").isEmpty ? string(o, "instructions") : string(o, "message")
    url = string(o, "launchUrl").isEmpty ? string(o, "url") : string(o, "launchUrl")
    options = o["options"] as? [String] ?? []
  }
  var approvalKey: String {
    let approvalText = [title, message].filter { !$0.isEmpty }.joined(separator: "\n")
    guard method == "confirm" || (method == "select" && options.contains("Approve")),
      !approvalText.contains("Provider safety checks:")
    else { return "" }
    let prefix = "Allow tool: "
    guard let line = approvalText.split(separator: "\n").map(String.init).first(where: {
      $0.hasPrefix(prefix)
    }) else { return "" }
    let tool = String(line.dropFirst(prefix.count)).trimmingCharacters(in: .whitespaces)
    guard !tool.isEmpty, tool.count <= 160,
      tool.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-.")).contains($0) })
    else { return "" }
    return tool
  }
  var approvalResponse: Object {
    method == "confirm" ? ["confirmed": true] : ["value": "Approve"]
  }
}

@MainActor final class Desk: ObservableObject {
  static let shared = Desk()
  @Published var projects: [Project] = []
  @Published var tasks: [DeskTask] = []
  @Published var selected: String?
  @Published var messages: [ChatMessage] = []
  @Published var pending: [UIRequest] = []
  @Published var queue: [QueuedMessage] = []
  @Published var connected = false
  @Published var busy = false
  @Published var workStartedAt: Date?
  @Published var loading = false
  @Published var error = ""
  @Published var draft = ""
  @Published var context: [String] = []
  @Published var images: [DraftImage] = []
  @Published var showLogin = false
  @Published var showLibrary = false
  @Published var loginBusy = false
  @Published var providers: [Object] = []
  @Published var loginRequests: [UIRequest] = []
  @Published var loginNotice = ""
  @Published var loginError = ""
  @Published var models: [Object] = []
  @Published var thinkingLevel = "auto"
  @Published var thinkingEfforts: [String] = []
  @Published var runtime: Object = [:]
  @Published var todos: [Object] = []
  @Published var subagents: [Object] = []
  @Published var sessionStats: Object = [:]
  @Published var commands: [Object] = []
  @Published var showSessionTools = false
  @Published var showCommandPalette = false
  @Published var showSubagents = false
  @Published var worktrees: [Object] = []
  @Published var files: [FileItem] = []
  @Published var folder = ""
  @Published var filePath = ""
  @Published var fileText = ""
  @Published var diff = ""
  @Published var inspector = false
  @Published var inspectorTab = 0
  @Published var search = ""
  @Published var petActivity = PetActivity()
  private var rawMessages: [Object] = []
  private var messageFlush: Task<Void, Never>?
  private var messagesDirty = false
  private var drafts: [String: (String, [String], [DraftImage])] = [:]
  private var process: Process?
  private var input: Pipe?
  private var output: Pipe?
  private var errorPipe: Pipe?
  private var streamTask: Task<Void, Never>?
  private var endpoint: URL?
  private var engineLog = ""
  private var stdoutBuffer = ""
  private let token = UUID().uuidString + UUID().uuidString
  private let network = URLSession(configuration: .ephemeral)
  private var terminating = false
  private let globalApprovalKey = "approvalRules.global.v1"
  private let chatApprovalPrefix = "approvalRules.chat.v1."
  var task: DeskTask? { tasks.first { $0.id == selected } }
  var project: Project? { projects.first { $0.id == task?.projectID } }
  var status: String {
    !connected
      ? "Verbinden …"
      : loading
        ? "Sitzung öffnen …"
        : !pending.isEmpty
          ? "Wartet auf deine Entscheidung"
          : busy
            ? (queue.isEmpty
              ? "OMP arbeitet …" : "OMP arbeitet · \(queue.count) in der Warteschlange")
            : "Lokal · OMP 18.2.1"
  }

  var automaticApprovalCount: Int {
    let defaults = UserDefaults.standard
    let global = defaults.stringArray(forKey: globalApprovalKey)?.count ?? 0
    let chats = defaults.dictionaryRepresentation().reduce(0) { total, item in
      guard item.key.hasPrefix(chatApprovalPrefix), let values = item.value as? [String] else {
        return total
      }
      return total + values.count
    }
    return global + chats
  }

  private func approvalRules(_ key: String) -> Set<String> {
    Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
  }

  func remembersApproval(_ request: UIRequest, owner: String) -> Bool {
    guard !request.approvalKey.isEmpty else { return false }
    return approvalRules(globalApprovalKey).contains(request.approvalKey)
      || approvalRules(chatApprovalPrefix + owner).contains(request.approvalKey)
  }

  func approve(_ request: UIRequest, owner: String, scope: String) async throws {
    try await respond(request, owner: owner, body: request.approvalResponse)
    if !request.approvalKey.isEmpty, scope != "once" {
      let key = scope == "global" ? globalApprovalKey : chatApprovalPrefix + owner
      var values = approvalRules(key)
      values.insert(request.approvalKey)
      UserDefaults.standard.set(values.sorted(), forKey: key)
      objectWillChange.send()
    }
  }

  func clearAutomaticApprovals() {
    let defaults = UserDefaults.standard
    defaults.removeObject(forKey: globalApprovalKey)
    for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(chatApprovalPrefix) {
      defaults.removeObject(forKey: key)
    }
    objectWillChange.send()
  }

  func start() {
    guard process == nil else { return }
    guard let resources = Bundle.main.resourceURL else {
      error = "App-Ressourcen fehlen."
      return
    }
    let p = Process()
    p.executableURL = resources.appendingPathComponent("node")
    p.arguments = [resources.appendingPathComponent("host/server.mjs").path]
    p.currentDirectoryURL = resources.appendingPathComponent("host")
    var env = ProcessInfo.processInfo.environment
    env["PI_DESK_PORT"] = "0"
    env["PI_DESK_NATIVE_TOKEN"] = token
    env["PATH"] =
      "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + (env["PATH"] ?? "")
    #if PI_DESK_UI_TEST
      env["PI_DESK_DATA"] = "/private/tmp/pi-desk-native-e2e"
    #endif
    p.environment = env
    let stdin = Pipe()
    let stdout = Pipe()
    let stderr = Pipe()
    p.standardInput = stdin
    p.standardOutput = stdout
    p.standardError = stderr
    input = stdin
    output = stdout
    errorPipe = stderr
    process = p
    stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let data = handle.availableData
      guard !data.isEmpty else { return }
      Task { @MainActor [weak self] in self?.ingestEngine(data, stream: "out") }
    }
    stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let data = handle.availableData
      guard !data.isEmpty else { return }
      Task { @MainActor [weak self] in self?.ingestEngine(data, stream: "err") }
    }
    p.terminationHandler = { [weak self] p in
      Task { @MainActor in
        guard let self, !self.terminating else { return }
        self.connected = false
        let detail = self.engineDetail()
        self.error =
          "Die lokale Engine wurde beendet (\(p.terminationStatus))."
          + (detail.isEmpty ? " Bitte Pi Desk neu starten." : "\n" + detail)
      }
    }
    do {
      try p.run()
      Task { [weak self] in
        try? await Task.sleep(for: .seconds(20))
        if let self, self.endpoint == nil, !self.terminating {
          let detail = self.engineDetail()
          self.error =
            "Die lokale Engine antwortet nicht."
            + (detail.isEmpty ? " Bitte Pi Desk neu starten." : "\n" + detail)
        }
      }
    } catch {
      self.error = "Engine konnte nicht starten: \(error.localizedDescription)"
    }
  }
  private func ingestEngine(_ data: Data, stream: String) {
    let text = String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
    if stream == "err" {
      engineLog = String((engineLog + text).suffix(4000))
    }
    stdoutBuffer += text
    let lines = stdoutBuffer.components(separatedBy: "\n")
    if !stdoutBuffer.hasSuffix("\n") {
      stdoutBuffer = lines.last ?? ""
    } else {
      stdoutBuffer = ""
    }
    let complete = stdoutBuffer.isEmpty ? lines : Array(lines.dropLast())
    if let line = complete.first(where: { $0.hasPrefix("Pi Desk http://127.0.0.1:") }),
      let url = URL(string: String(line.dropFirst(8))), endpoint == nil
    {
      endpoint = url
      Task { await boot() }
    }
  }
  private func engineDetail() -> String {
    engineLog.split(whereSeparator: \.isNewline).map(String.init).filter {
      !$0.trimmingCharacters(in: .whitespaces).isEmpty
    }.suffix(6).joined(separator: "\n")
  }
  func stop() {
    terminating = true
    streamTask?.cancel()
    try? input?.fileHandleForWriting.close()
    output?.fileHandleForReading.readabilityHandler = nil
    errorPipe?.fileHandleForReading.readabilityHandler = nil
    if let process, process.isRunning { process.terminate() }
  }
  private func request(_ route: String, body: Object? = nil) throws -> URLRequest {
    guard let endpoint else {
      throw NSError(
        domain: "PiDesk", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Die Engine ist noch nicht bereit."])
    }
    guard let url = URL(string: "/api/" + route, relativeTo: endpoint) else {
      throw URLError(.badURL)
    }
    var r = URLRequest(url: url)
    r.timeoutInterval = body?["images"] != nil ? 120 : 60
    r.setValue(token, forHTTPHeaderField: "X-Pi-Desk-Native")
    if let body {
      r.httpMethod = "POST"
      r.setValue("application/json", forHTTPHeaderField: "Content-Type")
      r.setValue("1", forHTTPHeaderField: "X-Pi-Desk")
      r.setValue(endpoint.absoluteString, forHTTPHeaderField: "Origin")
      r.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    return r
  }
  func api(_ route: String, body: Object? = nil) async throws -> Object {
    let (data, response) = try await network.data(for: request(route, body: body))
    let o = (try? JSONSerialization.jsonObject(with: data)) as? Object ?? [:]
    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
      throw NSError(
        domain: "PiDesk", code: 2,
        userInfo: [
          NSLocalizedDescriptionKey: string(o, "error").isEmpty
            ? "Verbindung fehlgeschlagen." : string(o, "error")
        ])
    }
    return o
  }
  func run(_ action: @escaping @MainActor () async throws -> Void) {
    Task { do { try await action() } catch { self.error = error.localizedDescription } }
  }
  private func boot() async {
    do {
      apply(try await api("state"))
      connected = true
      if let previous = UserDefaults.standard.string(forKey: "selectedTask"),
        tasks.contains(where: { $0.id == previous && $0.active })
      {
        await select(previous)
      }
      streamTask = Task { await stream() }
    } catch { self.error = error.localizedDescription }
  }
  private func stream() async {
    while !Task.isCancelled {
      do {
        var r = try request("events")
        r.timeoutInterval = 86400
        let (bytes, response) = try await network.bytes(for: r)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
          throw URLError(.badServerResponse)
        }
        connected = true
        for try await line in bytes.lines {
          if Task.isCancelled { return }
          if line.hasPrefix("data: "), let d = String(line.dropFirst(6)).data(using: .utf8),
            let event = (try? JSONSerialization.jsonObject(with: d)) as? Object
          {
            handle(event)
          }
        }
      } catch {
        if Task.isCancelled { return }
        connected = false
      }
      if Task.isCancelled { return }
      try? await Task.sleep(for: .seconds(2))
      if let id = selected { await select(id) }
    }
  }
  private func apply(_ o: Object) {
    projects = objects(o, "projects").map(Project.init)
    tasks = objects(o, "tasks").map(DeskTask.init)
    petActivity.running = Set(tasks.filter { $0.busy }.map { $0.id })
  }
  func refresh() async throws { apply(try await api("state")) }
  func clearSelection() {
    selected = nil
    UserDefaults.standard.removeObject(forKey: "selectedTask")
    draft = ""
    context = []
    images = []
    messageFlush?.cancel()
    messageFlush = nil
    messagesDirty = false
    rawMessages = []
    messages = []
    pending = []
    queue = []
    busy = false
    workStartedAt = nil
    loading = false
    thinkingLevel = "auto"
    thinkingEfforts = []
    runtime = [:]
    todos = []
    subagents = []
    sessionStats = [:]
    commands = []
    filePath = ""
    fileText = ""
    files = []
    diff = ""
  }
  func changeTaskState(_ id: String, action: String) async throws {
    var body: Object = ["action": action]
    if action != "empty" { body["taskId"] = id }
    _ = try await api("task-state", body: body)
    let wasSelected = selected == id || (action == "empty" && tasks.contains { $0.id == selected && $0.deleted })
    if wasSelected {
      if let current = selected { drafts[current] = (draft, context, images) }
      clearSelection()
    }
    try await refresh()
    if action == "restore" {
      await select(id)
    } else if wasSelected, let next = tasks.first(where: { $0.active }) {
      await select(next.id)
    }
  }
  func select(_ id: String) async {
    guard tasks.contains(where: { $0.id == id && $0.active }) else { return }
    if let old = selected { drafts[old] = (draft, context, images) }
    selected = id
    UserDefaults.standard.set(id, forKey: "selectedTask")
    draft = drafts[id]?.0 ?? ""
    context = drafts[id]?.1 ?? []
    images = drafts[id]?.2 ?? []
    messageFlush?.cancel()
    messageFlush = nil
    messagesDirty = false
    rawMessages = []
    messages = []
    pending = []
    queue = []
    busy = false
    folder = ""
    fileText = ""
    filePath = ""
    loading = true
    error = ""
    do {
      let s = try await api("session?taskId=" + id)
      guard selected == id else { return }
      rawMessages = objects(s, "messages")
      updateMessages()
      pending = objects(s, "pending").map(UIRequest.init)
      queue = objects(s, "queue").map(QueuedMessage.init)
      petActivity.requests[id] = Set(pending.filter { $0.method != "open_url" }.map { $0.id })
      busy = s["busy"] as? Bool ?? false
      workStartedAt = busy ? Date() : nil
      let level = string(s, "thinkingLevel")
      if !level.isEmpty { thinkingLevel = level }
      applyRuntime(s)
      error = string(s, "error")
      try await refresh()
      await loadFiles()
      await loadModels()
    } catch { self.error = error.localizedDescription }
    if selected == id { loading = false }
  }
  private func updateMessages(immediate: Bool = true) {
    if immediate {
      messageFlush?.cancel()
      messageFlush = nil
      messagesDirty = false
      messages = rawMessages.enumerated().map { ChatMessage($0.element, index: $0.offset) }
      return
    }
    messagesDirty = true
    guard messageFlush == nil else { return }
    messageFlush = Task { @MainActor in
      try? await Task.sleep(for: .milliseconds(90))
      messageFlush = nil
      guard messagesDirty else { return }
      messagesDirty = false
      messages = rawMessages.enumerated().map { ChatMessage($0.element, index: $0.offset) }
    }
  }
  private func handle(_ o: Object) {
    let type = string(o, "type")
    let id = string(o, "id")
    if type == "state" {
      apply(o["data"] as? Object ?? [:])
      return
    }
    if type == "auth_done" {
      Task {
        await loadLogin()
        await loadModels()
      }
      return
    }
    if type == "queue" {
      if id == selected { queue = objects(o, "queue").map(QueuedMessage.init) }
      return
    }
    if type == "failure" {
      petActivity.receive(o, task: id)
      if id == "auth" {
        loginError = string(o, "error")
      } else if id == selected {
        error = string(o, "error")
        busy = false
        workStartedAt = nil
      }
      return
    }
    guard type == "rpc" else { return }
    let e = o["event"] as? Object ?? [:]
    let kind = string(e, "type")
    petActivity.receive(e, task: id)
    if kind == "extension_ui_request" {
      let method = string(e, "method")
      let r = UIRequest(e)
      if id == "auth" {
        if method == "cancel" {
          loginRequests.removeAll { $0.id == string(e, "targetId") }
        } else if method == "notify" {
          loginNotice = string(e, "message")
        } else if ["confirm", "input", "editor", "select", "open_url"].contains(method) {
          loginRequests.removeAll { $0.id == r.id }
          loginRequests.append(r)
        }
      } else if method == "cancel" {
        if id == selected {
          pending.removeAll { $0.id == string(e, "targetId") }
        }
      } else if ["confirm", "input", "editor", "select", "open_url"].contains(method) {
        if remembersApproval(r, owner: id) {
          Task {
            do { try await approve(r, owner: id, scope: "once") } catch {
              if id == self.selected { self.error = error.localizedDescription }
            }
          }
        } else if id == selected {
          pending.removeAll { $0.id == r.id }
          pending.append(r)
        }
      }
    }
    guard id == selected else { return }
    if kind == "agent_start" {
      busy = true
      if workStartedAt == nil { workStartedAt = Date() }
    }
    if kind == "prompt_result", e["agentInvoked"] as? Bool == false {
      busy = false
      workStartedAt = nil
    }
    if kind == "agent_end", e["isTerminal"] as? Bool != false {
      busy = false
      workStartedAt = nil
      updateMessages(immediate: true)
      Task {
        await refreshSessionExtras()
        await loadFiles()
        if inspectorTab == 2 { await loadDiff() }
      }
    }
    if ["subagent_lifecycle", "subagent_progress", "subagent_event"].contains(kind) {
      Task { await loadSubagents() }
    }
    if let m = e["message"] as? Object {
      if kind == "message_start" {
        rawMessages.append(m)
        updateMessages(immediate: true)
      } else if ["message_update", "message_end"].contains(kind) {
        if let last = rawMessages.last, string(last, "role") == string(m, "role") {
          rawMessages[rawMessages.count - 1] = m
        } else {
          rawMessages.append(m)
        }
        updateMessages(immediate: kind == "message_end")
      }
    }
  }
  func chooseProject() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.canCreateDirectories = true
    panel.prompt = "Projekt öffnen"
    panel.message = "Wähle den Ordner, in dem OMP arbeiten soll."
    panel.begin { [weak self] result in
      guard result == .OK, let url = panel.url else { return }
      Task { @MainActor in
        guard let self else { return }
        self.run {
          let p = try await self.api("projects", body: ["path": url.path])
          try await self.newTask(projectID: string(p, "id"))
        }
      }
    }
  }
  func newTask(projectID: String? = nil) async throws {
    guard let p = projectID ?? project?.id else {
      chooseProject()
      return
    }
    let t = try await api("tasks", body: ["projectId": p])
    try await refresh()
    await select(string(t, "id"))
  }
  func copyText(_ text: String) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(text, forType: .string)
  }
  func editPrompt(_ message: ChatMessage) {
    draft = message.text
  }
  func continueInNewChat(_ message: ChatMessage) async throws {
    guard let current = task, let projectID = project?.id else { return }
    let t = try await api("tasks", body: ["projectId": projectID])
    let id = string(t, "id")
    if current.mode != "always-ask" {
      _ = try await api("mode", body: ["taskId": id, "mode": current.mode])
    }
    if !current.modelID.isEmpty, !current.modelProvider.isEmpty {
      _ = try await api(
        "model",
        body: ["taskId": id, "provider": current.modelProvider, "modelId": current.modelID])
    }
    let title = current.title
    try await refresh()
    await select(id)
    if selected == id {
      draft = ""
      context = []
      images = []
      if title != "Neue Aufgabe" {
        try? await rename("Fortsetzung · \(title)")
      }
    }
    _ = message
  }
  func send(interrupt: Bool = false) async throws {
    guard let id = selected, !loading else { return }
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty || !images.isEmpty else { return }
    let attached = context
    let attachedImages = images.map(\.payload)
    error = ""
    let route = busy ? (interrupt ? "steer" : "follow-up") : "prompt"
    if !busy { busy = true }
    do {
      var body: Object = ["taskId": id, "message": text, "context": attached]
      if !attachedImages.isEmpty { body["images"] = attachedImages }
      let result = try await api(route, body: body)
      if let item = result["item"] as? Object {
        let queued = QueuedMessage(item)
        if !queue.contains(where: { $0.id == queued.id }) { queue.append(queued) }
      }
      drafts.removeValue(forKey: id)
      if selected == id {
        draft = ""
        context = []
        images = []
      }
    } catch {
      if route == "prompt" { busy = false }
      throw error
    }
  }
  func pasteImages() {
    do {
      try attachClipboardImages()
    } catch {
      self.error = error.localizedDescription
    }
  }
  func attachClipboardImages() throws {
    guard task != nil else { return }
    let board = NSPasteboard.general
    var added = false
    if let urls = board.readObjects(forClasses: [NSURL.self], options: [
      .urlReadingFileURLsOnly: true,
      .urlReadingContentsConformToTypes: [UTType.image.identifier],
    ]) as? [URL] {
      for url in urls {
        try attachImageData(Data(contentsOf: url), hint: url.pathExtension)
        added = true
      }
    }
    if !added, let objects = board.readObjects(forClasses: [NSImage.self], options: nil) as? [NSImage] {
      for image in objects {
        try attachNSImage(image)
        added = true
      }
    }
    if !added, let data = board.data(forType: .png) ?? board.data(forType: .tiff) {
      try attachImageData(data, hint: "png")
      added = true
    }
    if !added {
      throw NSError(
        domain: "PiDesk", code: 6,
        userInfo: [NSLocalizedDescriptionKey: "Kein Bild in der Zwischenablage."])
    }
  }
  private func attachNSImage(_ image: NSImage) throws {
    guard let tiff = image.tiffRepresentation else {
      throw NSError(
        domain: "PiDesk", code: 7,
        userInfo: [NSLocalizedDescriptionKey: "Bild konnte nicht gelesen werden."])
    }
    try attachImageData(tiff, hint: "tiff")
  }
  private func attachImageData(_ raw: Data, hint: String) throws {
    guard images.count < 4 else {
      throw NSError(
        domain: "PiDesk", code: 8,
        userInfo: [NSLocalizedDescriptionKey: "Maximal vier Bilder."])
    }
    guard let image = NSImage(data: raw) else {
      throw NSError(
        domain: "PiDesk", code: 7,
        userInfo: [NSLocalizedDescriptionKey: "Bild konnte nicht gelesen werden."])
    }
    let jpeg = compressedJPEG(image)
    guard jpeg.count >= 32 else {
      throw NSError(
        domain: "PiDesk", code: 7,
        userInfo: [NSLocalizedDescriptionKey: "Bild konnte nicht gelesen werden."])
    }
    if jpeg.count > 3_500_000 {
      throw NSError(
        domain: "PiDesk", code: 9,
        userInfo: [NSLocalizedDescriptionKey: "Bild ist zu groß. Bitte ein kleineres wählen."])
    }
    _ = hint
    images.append(DraftImage(id: UUID().uuidString, data: jpeg, mime: "image/jpeg"))
  }
  private func compressedJPEG(_ image: NSImage) -> Data {
    let longest = max(image.size.width, image.size.height)
    let scale = longest > 1600 ? 1600 / longest : 1
    let size = NSSize(width: max(1, image.size.width * scale), height: max(1, image.size.height * scale))
    let bitmap = NSBitmapImageRep(
      bitmapDataPlanes: nil, pixelsWide: Int(size.width.rounded()),
      pixelsHigh: Int(size.height.rounded()), bitsPerSample: 8, samplesPerPixel: 4,
      hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)
    if let bitmap {
      NSGraphicsContext.saveGraphicsState()
      NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
      image.draw(
        in: NSRect(origin: .zero, size: size), from: .zero, operation: .copy, fraction: 1)
      NSGraphicsContext.restoreGraphicsState()
      if let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.72]) {
        return data
      }
    }
    return image.tiffRepresentation.flatMap {
      NSBitmapImageRep(data: $0)?.representation(using: .jpeg, properties: [.compressionFactor: 0.72])
    } ?? Data()
  }
  private func applyRuntime(_ s: Object) {
    if let value = s["runtime"] as? Object { runtime = value }
    todos = objects(s, "todos")
    if todos.isEmpty, let nested = runtime["todos"] as? [Object] { todos = nested }
    subagents = objects(s, "subagents")
    let level = string(runtime, "thinkingLevel")
    if !level.isEmpty { thinkingLevel = level }
  }
  func refreshSessionExtras() async {
    guard let id = selected else { return }
    do {
      let s = try await api("session?taskId=" + id)
      guard selected == id else { return }
      applyRuntime(s)
    } catch { self.error = error.localizedDescription }
  }
  func loadSubagents() async {
    guard let id = selected else { return }
    do {
      let result = try await api("subagents?taskId=" + id)
      if selected == id { subagents = objects(result, "subagents") }
    } catch {}
  }
  func loadCommands() async {
    guard let id = selected else { return }
    do {
      let result = try await api("commands?taskId=" + id)
      if selected == id { commands = objects(result, "commands") }
    } catch { self.error = error.localizedDescription }
  }
  func loadStats() async {
    guard let id = selected else { return }
    do {
      sessionStats = try await api("stats?taskId=" + id)
    } catch { self.error = error.localizedDescription }
  }
  func compactSession() async throws {
    guard let id = selected else { return }
    loading = true
    defer { loading = false }
    let result = try await api("compact", body: ["taskId": id])
    rawMessages = objects(result, "messages")
    updateMessages()
    applyRuntime(result)
  }
  func exportSession() async throws {
    guard let id = selected else { return }
    let result = try await api("export", body: ["taskId": id])
    let path = string(result, "path")
    guard !path.isEmpty else { return }
    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
  }
  func handoffSession() async throws {
    guard let id = selected else { return }
    let result = try await api("handoff", body: ["taskId": id])
    let path = string(result, "path")
    if !path.isEmpty {
      NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }
  }
  func branchFromLast() async throws {
    guard let id = selected else { return }
    let branches = try await api("branches?taskId=" + id)
    let points = objects(branches, "messages")
    guard let last = points.last else {
      throw NSError(
        domain: "PiDesk", code: 10,
        userInfo: [NSLocalizedDescriptionKey: "Keine Verzweigungspunkte in dieser Sitzung."])
    }
    let child = try await api("branch", body: ["taskId": id, "entryId": string(last, "entryId")])
    try await refresh()
    await select(string(child, "id"))
  }
  func resetSession() async throws {
    guard let id = selected else { return }
    loading = true
    defer { loading = false }
    _ = try await api("new-session", body: ["taskId": id])
    messageFlush?.cancel()
    messageFlush = nil
    messagesDirty = false
    rawMessages = []
    messages = []
    pending = []
    queue = []
    todos = []
    subagents = []
    await select(id)
  }
  func setFastMode(_ enabled: Bool) async throws {
    guard let id = selected else { return }
    let result = try await api("fast-mode", body: ["taskId": id, "enabled": enabled])
    applyRuntime(result)
  }
  func abortRetry() async throws {
    guard let id = selected else { return }
    _ = try await api("abort-retry", body: ["taskId": id])
  }
  func runCommand(_ name: String) async throws {
    guard selected != nil, !busy, !loading else { return }
    draft = name.hasPrefix("/") ? name : "/" + name
    try await send()
  }
  func abortRun() async throws {
    guard let id = selected, busy else { return }
    _ = try await api("abort", body: ["taskId": id])
    queue = []
  }
  func removeQueued(_ item: QueuedMessage) async throws {
    guard let id = selected else { return }
    let result = try await api("queue-remove", body: ["taskId": id, "id": item.id])
    queue = objects(result, "queue").map(QueuedMessage.init)
  }
  func setMode(_ mode: String) async throws {
    guard let id = selected else { return }
    loading = true
    defer { loading = false }
    _ = try await api("mode", body: ["taskId": id, "mode": mode])
    try await refresh()
  }
  func loadModels() async {
    guard let id = selected else { return }
    do {
      let result = try await api("models?taskId=" + id)
      if id == selected {
        models = objects(result, "models")
        applyThinking(from: models)
      }
    } catch { self.error = error.localizedDescription }
  }
  func setModel(_ o: Object) async throws {
    guard let id = selected else { return }
    _ = try await api(
      "model", body: ["taskId": id, "provider": string(o, "provider"), "modelId": string(o, "id")])
    try await refresh()
    await loadModels()
  }
  func setThinking(_ level: String) async throws {
    guard let id = selected, thinkingLevel != level else { return }
    let previous = thinkingLevel
    thinkingLevel = level
    do {
      _ = try await api("thinking", body: ["taskId": id, "level": level])
    } catch {
      thinkingLevel = previous
      throw error
    }
  }
  private func applyThinking(from models: [Object]) {
    guard let current = task else {
      thinkingEfforts = []
      return
    }
    let match = models.first {
      string($0, "id") == current.modelID && string($0, "provider") == current.modelProvider
    }
    let efforts = (match?["thinking"] as? [String]) ?? []
    if match?["reasoning"] as? Bool == true || !efforts.isEmpty {
      thinkingEfforts =
        efforts.isEmpty
        ? ["off", "minimal", "low", "medium", "high", "xhigh", "max"] : efforts
      if !thinkingEfforts.contains(thinkingLevel), thinkingLevel != "auto" {
        thinkingLevel = thinkingEfforts.contains("medium") ? "medium" : thinkingEfforts.last ?? "off"
      }
    } else {
      thinkingEfforts = []
    }
  }
  func rename(_ title: String) async throws {
    guard let id = selected else { return }
    _ = try await api("rename", body: ["taskId": id, "title": title])
    try await refresh()
  }
  func login() {
    showLogin = true
    Task { await loadLogin() }
  }
  func loadLogin() async {
    do {
      let s = try await api("auth")
      providers = objects(s, "providers")
      loginBusy = s["busy"] as? Bool ?? false
      loginRequests = objects(s, "pending").map(UIRequest.init)
      loginNotice = string(s, "notice")
      loginError = string(s, "error")
    } catch { loginError = error.localizedDescription }
  }
  func connect(_ provider: String) async throws {
    loginBusy = true
    loginError = ""
    loginNotice = ""
    loginRequests = []
    do { _ = try await api("login", body: ["providerId": provider]) } catch {
      loginBusy = false
      loginError = error.localizedDescription
      throw error
    }
  }
  func cancelLogin() async throws {
    _ = try await api("cancel-login", body: [:])
    await loadLogin()
  }
  func respond(_ r: UIRequest, owner: String, body: Object) async throws {
    var data = body
    data["taskId"] = owner
    data["id"] = r.id
    _ = try await api("respond", body: data)
    petActivity.resolve(task: owner, request: r.id)
    if owner == "auth" {
      loginRequests.removeAll { $0.id == r.id }
    } else if owner == selected {
      pending.removeAll { $0.id == r.id }
    }
  }
  func open(_ raw: String) {
    guard let url = URL(string: raw), ["https", "http"].contains(url.scheme?.lowercased() ?? "")
    else {
      error = "Ungültige Adresse."
      return
    }
    NSWorkspace.shared.open(url)
  }
  func query(_ path: String) -> String {
    path.addingPercentEncoding(
      withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+#?=")))
      ?? ""
  }
  func fileList(_ folder: String) async throws -> [FileItem] {
    guard let p = project else { return [] }
    return objects(try await api("files?projectId=\(p.id)&path=\(query(folder))"), "files").map(
      FileItem.init)
  }
  func loadFiles() async {
    let id = selected
    do {
      let rows = try await fileList(folder)
      if selected == id { files = rows }
    } catch { self.error = error.localizedDescription }
  }
  func navigate(_ path: String) {
    folder = path
    Task { await loadFiles() }
  }
  func preview(_ f: FileItem) async throws {
    guard let p = project else { return }
    inspector = true
    inspectorTab = 1
    filePath = f.path
    let id = selected
    do {
      let response = try await api("file?projectId=\(p.id)&path=\(query(f.path))")
      guard id == selected else { return }
      filePath = f.path
      fileText = string(response, "text")
    } catch {
      guard id == selected else { return }
      fileText = error.localizedDescription
    }
  }
  func openFile(_ raw: String) {
    run { await self.openProjectFile(raw) }
  }
  func revealFile(_ raw: String) {
    guard let p = project else {
      error = "Zuerst ein Projekt öffnen, um Dateien zu zeigen."
      return
    }
    guard let relative = ProjectPath.normalize(raw, projectRoot: p.path) else {
      error = "Datei liegt außerhalb des Projekts."
      return
    }
    let url = ProjectPath.fileURL(relative, projectRoot: p.path)
    guard FileManager.default.fileExists(atPath: url.path) else {
      error = "Datei nicht gefunden: \(relative.isEmpty ? p.name : relative)"
      return
    }
    NSWorkspace.shared.activateFileViewerSelecting([url])
  }
  func openProjectFile(_ raw: String) async {
    guard let p = project else {
      error = "Zuerst ein Projekt öffnen, um Dateien zu zeigen."
      return
    }
    guard let relative = ProjectPath.normalize(raw, projectRoot: p.path) else {
      error = "Datei liegt außerhalb des Projekts."
      return
    }
    inspector = true
    let url = ProjectPath.fileURL(relative, projectRoot: p.path)
    var isDir: ObjCBool = false
    if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
      navigate(relative)
      inspectorTab = 0
      return
    }
    folder = (relative as NSString).deletingLastPathComponent
    await loadFiles()
    do {
      try await preview(FileItem(path: relative))
    } catch {
      filePath = relative
      fileText = error.localizedDescription
      inspectorTab = 1
    }
  }
  func addContext(_ f: FileItem) async throws {
    if context.contains(f.path) {
      context.removeAll { $0 == f.path }
      return
    }
    guard context.count < 10 else {
      throw NSError(
        domain: "PiDesk", code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Maximal zehn Kontextdateien."])
    }
    guard let p = project else { return }
    _ = try await api("file?projectId=\(p.id)&path=\(query(f.path))")
    context.append(f.path)
  }
  func loadDiff() async {
    guard let p = project else { return }
    do {
      let s = try await api("diff?projectId=" + p.id)
      diff = [string(s, "branch"), string(s, "status"), string(s, "diff")].filter { !$0.isEmpty }
        .joined(separator: "\n\n")
      if diff.isEmpty { diff = "Keine Änderungen." }
    } catch { self.error = error.localizedDescription }
  }
  func loadWorktrees() async {
    guard let p = project else { return }
    do {
      let result = try await api("worktrees?projectId=" + p.id)
      worktrees = objects(result, "worktrees")
    } catch { self.error = error.localizedDescription }
  }
  func shareSession() async throws {
    guard let id = selected else { return }
    let result = try await api("share", body: ["taskId": id])
    let link = string(result, "link")
    let output = string(result, "output")
    if !link.isEmpty {
      copyText(link)
      open(link)
    } else if !output.isEmpty {
      copyText(output)
    }
  }
  func importSessionFile() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowedContentTypes = [.json, .text, .item]
    panel.prompt = "Importieren"
    panel.message = "OMP-, Claude- oder Codex-Sitzungsdatei wählen."
    panel.begin { [weak self] result in
      guard result == .OK, let url = panel.url else { return }
      Task { @MainActor in
        guard let self, let projectID = self.project?.id else { return }
        self.run {
          let task = try await self.api(
            "tasks",
            body: [
              "projectId": projectID, "sessionFile": url.path,
              "title": "Import · " + url.deletingPathExtension().lastPathComponent,
            ])
          try await self.refresh()
          await self.select(string(task, "id"))
        }
      }
    }
  }
  func abortAndPrompt() async throws {
    guard let id = selected, busy else { return }
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty || !images.isEmpty else { return }
    var body: Object = ["taskId": id, "message": text, "context": context]
    if !images.isEmpty { body["images"] = images.map(\.payload) }
    _ = try await api("abort-and-prompt", body: body)
    draft = ""
    context = []
    images = []
    queue = []
  }
}

struct PiMark: Shape {
  func path(in rect: CGRect) -> Path {
    var p = Path()
    let x = rect.width / 24
    let y = rect.height / 24
    p.move(to: CGPoint(x: 4 * x, y: 6 * y))
    p.addLine(to: CGPoint(x: 20 * x, y: 6 * y))
    p.move(to: CGPoint(x: 9 * x, y: 6 * y))
    p.addLine(to: CGPoint(x: 7 * x, y: 19 * y))
    p.move(to: CGPoint(x: 17 * x, y: 6 * y))
    p.addLine(to: CGPoint(x: 15 * x, y: 16 * y))
    p.addQuadCurve(to: CGPoint(x: 18 * x, y: 19 * y), control: CGPoint(x: 14.6 * x, y: 19 * y))
    return p
  }
}

private struct UserMessage: View {
  let message: ChatMessage
  let fontSize: CGFloat
  @ObservedObject var desk: Desk
  @State private var hovering = false
  var body: some View {
    HStack {
      Spacer(minLength: 40)
      VStack(alignment: .trailing, spacing: 6) {
        ChatMarkdown(
          text: message.text, fontSize: fontSize, inBubble: true,
          onOpenFile: desk.openFile, onRevealFile: desk.revealFile, onOpenURL: desk.open
        )
        .padding(.horizontal, 17).padding(.vertical, 12).background(
          LinearGradient(
            colors: [Color.white.opacity(0.11), Color.white.opacity(0.07)],
            startPoint: .topLeading, endPoint: .bottomTrailing),
          in: RoundedRectangle(cornerRadius: 16)
        )
        MessageActions(kind: .user, message: message, desk: desk, revealed: hovering)
      }.frame(maxWidth: 560, alignment: .trailing)
    }
    .contentShape(Rectangle())
    .onHover { hovering = $0 }
  }
}

private struct MessageActionButton: View {
  let symbol: String
  var doneSymbol = "checkmark"
  let label: String
  var doneLabel = "Kopiert"
  var done = false
  var enabled = true
  let action: () -> Void
  @State private var hovering = false
  var body: some View {
    Button(action: action) {
      Image(systemName: done ? doneSymbol : symbol)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(
          done ? accent : hovering ? Color.white.opacity(0.94) : Color.secondary
        )
        .frame(width: 22, height: 22)
        .background(
          RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(
              done
                ? accent.opacity(0.16)
                : hovering ? Color.white.opacity(0.1) : Color.clear)
        )
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
    .help(done ? doneLabel : label)
    .accessibilityLabel(done ? doneLabel : label)
    .onHover { hovering = $0 }
  }
}

private struct MessageActions: View {
  enum Kind { case user, assistant }
  let kind: Kind
  let message: ChatMessage
  @ObservedObject var desk: Desk
  var revealed = true
  @State private var copied = false
  var body: some View {
    HStack(spacing: 4) {
      if kind == .user, let time = formatted(message.sentAt) {
        Text(time).font(.system(size: 10)).foregroundStyle(.tertiary).monospacedDigit()
          .padding(.trailing, 4)
      }
      MessageActionButton(
        symbol: "doc.on.doc", label: "Kopieren", done: copied
      ) {
        desk.copyText(message.text)
        copied = true
        Task {
          try? await Task.sleep(for: .seconds(1.6))
          copied = false
        }
      }
      if copied {
        Text("Kopiert").font(.system(size: 10, weight: .medium)).foregroundStyle(accent)
          .transition(.opacity)
      }
      if kind == .user {
        MessageActionButton(symbol: "pencil", label: "Bearbeiten") {
          desk.editPrompt(message)
        }
      } else {
        MessageActionButton(
          symbol: "arrow.turn.up.right", label: "In neuem Chat fortfahren",
          enabled: !desk.busy && !desk.loading && desk.project != nil
        ) {
          desk.run { try await desk.continueInNewChat(message) }
        }
      }
    }
    .opacity(kind == .assistant || revealed || copied ? 1 : 0)
    .allowsHitTesting(kind == .assistant || revealed || copied)
    .animation(.easeOut(duration: 0.14), value: revealed)
    .animation(.easeOut(duration: 0.14), value: copied)
    .accessibilityHidden(kind == .user && !revealed && !copied)
  }
  private func formatted(_ date: Date?) -> String? {
    guard let date else { return nil }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "de_AT")
    formatter.dateStyle = Calendar.current.isDateInToday(date) ? .none : .short
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }
}

struct SymbolButton: View {
  let symbol: String
  let help: String
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      Image(systemName: symbol).font(.system(size: 15, weight: .regular)).frame(
        width: 28, height: 28
      ).contentShape(Rectangle())
    }.buttonStyle(.plain).foregroundStyle(.secondary).help(help).accessibilityLabel(help)
  }
}
// macOS 26+ adds shared glass capsules to toolbar items by default.
// Keep native hit targets and window chrome while preserving Quiet Studio's flat header.
extension ToolbarContent {
  @ToolbarContentBuilder
  func quietBackground() -> some ToolbarContent {
    if #available(macOS 26.0, *) { self.sharedBackgroundVisibility(.hidden) } else { self }
  }
}

struct TaskSearch: View {
  @ObservedObject var desk: Desk
  let close: () -> Void
  @FocusState private var focused: Bool
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      TextField("Aufgaben suchen", text: $desk.search)
        .textFieldStyle(.plain).font(.system(size: 14)).focused($focused)
        .padding(.vertical, 8)
      Divider().opacity(0.4)
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 4) {
          ForEach(
            desk.tasks.filter {
              $0.active
                && (desk.search.isEmpty || $0.title.localizedCaseInsensitiveContains(desk.search))
            }
          ) { task in
            Button {
              close()
              Task { await desk.select(task.id) }
            } label: {
              Label(task.title, systemImage: "text.bubble").font(.system(size: 12))
                .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8).contentShape(
                  Rectangle())
            }.buttonStyle(.plain)
          }
          if desk.tasks.isEmpty {
            Text("Noch keine Aufgaben.").font(.caption).foregroundStyle(.secondary)
          }
        }
      }
    }.padding(20).frame(width: 320, height: 280).onAppear { focused = true }
  }
}

struct TaskLibrary: View {
  @ObservedObject var desk: Desk
  @Environment(\.dismiss) private var dismiss
  @State private var trash = false
  @State private var query = ""
  @State private var working = false
  @State private var failure = ""
  @State private var purgeTarget: DeskTask?
  @State private var emptyConfirm = false
  private var rows: [DeskTask] {
    desk.tasks.filter {
      (trash ? $0.deleted : $0.archived && !$0.deleted)
        && (query.isEmpty || $0.title.localizedCaseInsensitiveContains(query))
    }
  }
  private func restore(_ task: DeskTask) {
    working = true
    failure = ""
    Task {
      do {
        try await desk.changeTaskState(task.id, action: "restore")
        dismiss()
      } catch { failure = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Text(trash ? "Papierkorb" : "Archiv").font(.title2)
        Spacer()
        Button("Fertig") { dismiss() }.keyboardShortcut(.cancelAction)
      }
      Picker("Bereich", selection: $trash) {
        Text("Archiv").tag(false)
        Text("Papierkorb").tag(true)
      }.pickerStyle(.segmented)
      TextField("Chats suchen", text: $query).textFieldStyle(.roundedBorder)
      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(rows) { task in
            HStack(spacing: 14) {
              Image(systemName: trash ? "trash" : "archivebox").foregroundStyle(.secondary)
              VStack(alignment: .leading, spacing: 4) {
                Text(task.title).lineLimit(2)
                Text(desk.projects.first(where: { $0.id == task.projectID })?.name ?? "Projekt")
                  .font(.caption).foregroundStyle(.secondary)
              }
              Spacer()
              Button("Wiederherstellen") { restore(task) }.disabled(working)
              if trash {
                Button("Endgültig löschen", role: .destructive) { purgeTarget = task }.disabled(
                  working)
              }
            }.padding(.vertical, 13)
            Divider().opacity(0.35)
          }
          if rows.isEmpty {
            Text(
              query.isEmpty
                ? (trash ? "Der Papierkorb ist leer." : "Keine archivierten Chats.")
                : "Keine passenden Chats."
            )
            .foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 60)
          }
        }
      }
      if trash {
        HStack {
          Text("Endgültiges Löschen entfernt den Chat und die Sitzungsdatei. Projektdateien bleiben.").font(.caption)
            .foregroundStyle(.secondary)
          Spacer()
          if !rows.isEmpty {
            Button("Papierkorb leeren", role: .destructive) { emptyConfirm = true }.disabled(working)
          }
        }
      }
      if !failure.isEmpty { Text(failure).font(.caption).foregroundStyle(.orange) }
    }.padding(24).frame(width: 540, height: 440)
      .alert(
        "Chat endgültig löschen?",
        isPresented: Binding(get: { purgeTarget != nil }, set: { if !$0 { purgeTarget = nil } }),
        presenting: purgeTarget
      ) { task in
        Button("Abbrechen", role: .cancel) { purgeTarget = nil }
        Button("Löschen", role: .destructive) {
          working = true
          failure = ""
          Task {
            do { try await desk.changeTaskState(task.id, action: "purge") } catch {
              failure = error.localizedDescription
            }
            working = false
            purgeTarget = nil
          }
        }
      } message: { _ in
        Text("Das lässt sich nicht rückgängig machen. Dateien im Projekt bleiben erhalten.")
      }
      .alert("Papierkorb leeren?", isPresented: $emptyConfirm) {
        Button("Abbrechen", role: .cancel) {}
        Button("Leeren", role: .destructive) {
          working = true
          failure = ""
          Task {
            do { try await desk.changeTaskState("", action: "empty") } catch {
              failure = error.localizedDescription
            }
            working = false
          }
        }
      } message: {
        Text("Alle Chats im Papierkorb werden unwiderruflich entfernt.")
      }
  }
}

struct MainView: View {
  @ObservedObject var shortcuts = DeskShortcuts.shared
  @ObservedObject var desk: Desk
  @Environment(\.accessibilityReduceMotion) var systemReduceMotion
  @AppStorage("reduceAnimations") private var reduceAnimations = false
  private var reduceMotion: Bool { systemReduceMotion || reduceAnimations }
  @State private var rename = false
  @State private var title = ""
  @State private var columns = NavigationSplitViewVisibility.all
  @State private var searchOpen = false
  @State private var trashTarget: DeskTask?
  var body: some View {
    NavigationSplitView(columnVisibility: $columns) {
      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 9) {
          PiMark().stroke(
            accent, style: StrokeStyle(lineWidth: 1.7, lineCap: .round, lineJoin: .round)
          ).frame(width: 20, height: 20).accessibilityHidden(true)
          Text("Pi Desk").font(.system(size: 16, weight: .semibold))
        }.padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 19)
        HStack {
          Text("Projekte").font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
          Spacer()
          SymbolButton(symbol: "plus", help: "Projekt öffnen", action: desk.chooseProject)
        }.padding(.horizontal, 16)
        ProjectTree(
          desk: desk,
          rename: { task in
            Task {
              await desk.select(task.id)
              title = task.title
              rename = true
            }
          }, trash: { task in trashTarget = task })
        Button {
          desk.showLibrary = true
        } label: {
          Label("Archiv & Papierkorb", systemImage: "archivebox")
            .font(.system(size: 11)).foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(
              .vertical, 10
            )
            .contentShape(Rectangle())
        }.buttonStyle(.plain)
        HStack {
          SettingsLink {
            Image(systemName: "gearshape").font(.system(size: 15)).frame(width: 28, height: 28)
          }.buttonStyle(.plain).foregroundStyle(.secondary).help("Einstellungen · ⌘,")
            .accessibilityLabel("Einstellungen")
          Spacer()
          Text("OMP · Lokal").font(.system(size: 10)).foregroundStyle(.secondary)
          Spacer()
          SymbolButton(symbol: "person.crop.circle", help: "Anbieter verbinden", action: desk.login)
        }.padding(14)
      }.background(
        LinearGradient(
          colors: [Color.white.opacity(0.045), Color.white.opacity(0.015)], startPoint: .topLeading,
          endPoint: .bottomTrailing)
      )
      .navigationSplitViewColumnWidth(min: 210, ideal: 245, max: 340)
      .toolbar(removing: .sidebarToggle)
    } detail: {
      HSplitView {
        ChatView(desk: desk).frame(minWidth: 390, maxWidth: .infinity, maxHeight: .infinity)
        if desk.inspector {
          InspectorView(desk: desk).frame(
            minWidth: 280, idealWidth: 380, maxWidth: 650, maxHeight: .infinity
          )
          .transition(.move(edge: .trailing).combined(with: .opacity))
        }
      }.background(deskBackground)
        .toolbar {
          ToolbarItem(placement: .navigation) {
            SymbolButton(symbol: "sidebar.left", help: "Seitenleiste ein- oder ausblenden") {
              withAnimation(reduceMotion ? nil : .easeOut(duration: 0.22)) {
                columns = columns == .detailOnly ? .all : .detailOnly
              }
            }
          }.quietBackground()
          ToolbarItem(placement: .navigation) {
            Text(desk.project?.name ?? "Pi Desk").font(.system(size: 12)).foregroundStyle(
              .secondary
            )
            .lineLimit(1).truncationMode(.middle)
          }.quietBackground()
          if #available(macOS 26.0, *) {
            ToolbarSpacer(.flexible, placement: .primaryAction)
          }
          #if PI_DESK_PETS
            ToolbarItem(placement: .primaryAction) {
              Menu {
                PetOptions()
              } label: {
                Image(systemName: "pawprint").font(.system(size: 14)).frame(width: 28, height: 28)
              }
              .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize().help("Pets")
              .accessibilityLabel("Pets")
            }.quietBackground()
          #endif
          ToolbarItem(placement: .primaryAction) {
            SymbolButton(
              symbol: "magnifyingglass",
              help: "Aufgaben suchen · " + shortcuts.binding(.search).label
            ) {
              searchOpen.toggle()
            }
            .keyboardShortcut(shortcuts.shortcut(.search))
            .popover(isPresented: $searchOpen) {
              TaskSearch(desk: desk, close: { searchOpen = false })
            }
          }.quietBackground()
          ToolbarItem(placement: .primaryAction) {
            SymbolButton(
              symbol: "square.and.pencil",
              help: "Neue Aufgabe · " + shortcuts.binding(.newTask).label
            ) {
              desk.run { try await desk.newTask() }
            }
          }.quietBackground()
          ToolbarItem(placement: .primaryAction) {
            SymbolButton(symbol: "sidebar.right", help: "Dateien und Vorschau") {
              withAnimation(reduceMotion ? nil : .snappy(duration: 0.3)) { desk.inspector.toggle() }
            }
          }.quietBackground()
        }
    }.toolbar(removing: .sidebarToggle).navigationSplitViewStyle(.balanced).background(
      deskBackground
    ).preferredColorScheme(.dark)
      .tint(accent)
      .sheet(isPresented: $desk.showLibrary) { TaskLibrary(desk: desk) }
      .sheet(isPresented: $desk.showSessionTools) { SessionToolsView(desk: desk) }
      .sheet(isPresented: $desk.showCommandPalette) { CommandPalette(desk: desk) }
      .sheet(isPresented: $desk.showSubagents) { SubagentList(desk: desk) }
      .alert(
        "Chat in den Papierkorb?",
        isPresented: Binding(get: { trashTarget != nil }, set: { if !$0 { trashTarget = nil } }),
        presenting: trashTarget
      ) { target in
        Button("Abbrechen", role: .cancel) { trashTarget = nil }
        Button("In den Papierkorb", role: .destructive) {
          desk.run { try await desk.changeTaskState(target.id, action: "trash") }
          trashTarget = nil
        }
      } message: { _ in
        Text(
          "Der Chat lässt sich im Papierkorb wiederherstellen. Dateien im Projekt werden nicht gelöscht."
        )
      }
      .sheet(isPresented: $desk.showLogin) { LoginView(desk: desk) }
      .sheet(isPresented: $rename) {
        VStack(alignment: .leading, spacing: 20) {
          Text("Aufgabe umbenennen").font(.title3)
          TextField("Titel", text: $title)
          HStack {
            Button("Abbrechen") { rename = false }.keyboardShortcut(.cancelAction)
            Spacer()
            Button("Speichern") {
              desk.run {
                try await desk.rename(title)
                rename = false
              }
            }.keyboardShortcut(.defaultAction)
          }
        }.padding(28).frame(width: 360)
      }
      .onChange(of: searchOpen) { _, open in if !open { desk.search = "" } }
      .frame(minWidth: 780, minHeight: 580)
  }
}
private struct ChatScroll<Content: View>: View {
  let follow: String
  @ViewBuilder var content: () -> Content
  var body: some View {
    if #available(macOS 15.0, *) {
      ScrollView { content() }.defaultScrollAnchor(.bottom)
    } else {
      ScrollViewReader { proxy in
        ScrollView { content() }
          .onChange(of: follow) { _, _ in
            proxy.scrollTo("bottom", anchor: .bottom)
          }
      }
    }
  }
}

struct ChatView: View {
  @ObservedObject var desk: Desk
  @AppStorage("chatFontSize") private var chatFontSize = 13.0
  @Environment(\.accessibilityReduceMotion) var systemReduceMotion
  @AppStorage("reduceAnimations") private var reduceAnimations = false
  private var reduceMotion: Bool { systemReduceMotion || reduceAnimations }
  @State private var contextOpen = false
  @State private var modelOpen = false
  @State private var modeOpen = false
  @State private var thinkingOpen = false
  @State private var pulse = false
  private var currentTurnTools: [ChatMessage] {
    let lastUser = desk.messages.lastIndex { $0.role == "user" } ?? -1
    return desk.messages.enumerated().filter {
      $0.offset > lastUser && $0.element.role == "toolResult"
    }.map(\.element)
  }
  var body: some View {
    VStack(spacing: 0) {
      ChatScroll(follow: desk.messages.last.map { "\($0.id):\($0.text.count)" } ?? "") {
          VStack(alignment: .leading, spacing: 28) {
            if let task = desk.task {
              HStack(alignment: .firstTextBaseline) {
                Text(task.title).font(.system(size: 23, weight: .medium)).tracking(-0.5)
                Spacer()
                Button {
                  desk.showSessionTools = true
                  Task { await desk.loadStats(); await desk.loadCommands(); await desk.loadSubagents() }
                } label: {
                  Image(systemName: "ellipsis.circle").font(.system(size: 14))
                }.buttonStyle(.plain).foregroundStyle(.secondary).help("Sitzung")
                  .accessibilityLabel("Sitzungsaktionen")
                  .disabled(desk.loading)
              }.padding(.bottom, 8)
              if !desk.todos.isEmpty {
                TodoStrip(phases: desk.todos)
              }
              if !desk.subagents.isEmpty {
                Button {
                  desk.showSubagents = true
                } label: {
                  Label(
                    "\(desk.subagents.count) \(desk.subagents.count == 1 ? "Subagent" : "Subagenten")",
                    systemImage: "person.2"
                  ).font(.caption).foregroundStyle(.secondary)
                }.buttonStyle(.plain)
              }
              if desk.messages.isEmpty {
                Text(
                  desk.loading
                    ? "Sitzung wird geöffnet …" : "Was möchtest du in diesem Projekt umsetzen?"
                ).font(.system(size: 13)).foregroundStyle(.secondary)
              }
              ForEach(groupedMessages(desk.messages)) { group in
                if let m = group.messages.first {
                  if m.role == "user", !m.text.isEmpty {
                    UserMessage(message: m, fontSize: chatFontSize, desk: desk)
                  } else if m.role == "toolResult" && !(desk.busy && currentTurnTools.contains(where: { $0.id == m.id })) {
                    ToolActivityGroup(
                      messages: group.messages, onOpenFile: desk.openFile,
                      onRevealFile: desk.revealFile, onOpenURL: desk.open)
                  } else if m.role == "assistant", !m.text.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                      ChatMarkdown(
                        text: m.text, fontSize: chatFontSize + 1, onOpenFile: desk.openFile,
                        onRevealFile: desk.revealFile, onOpenURL: desk.open
                      )
                      MessageActions(kind: .assistant, message: m, desk: desk)
                    }
                    .frame(maxWidth: 680, alignment: .leading)
                  }
                }
              }
            } else {
              VStack(alignment: .leading, spacing: 17) {
                Text("Dein nächster\nguter Gedanke.").font(.system(size: 34, weight: .medium))
                  .tracking(-1)
                Text("Verbinde dein Anbieter-Abo und öffne ein Projekt.").font(.system(size: 13))
                  .foregroundStyle(.secondary)
                HStack(spacing: 16) {
                  Button("Anbieter verbinden", action: desk.login).buttonStyle(.borderedProminent)
                  Button("Projekt öffnen …", action: desk.chooseProject).buttonStyle(.plain)
                }
              }.padding(.top, 90)
            }
            Color.clear.frame(height: 1).id("bottom")
          }.padding(.horizontal, 36).padding(.top, 35).padding(.bottom, 20).frame(
            maxWidth: .infinity, alignment: .leading)
      }
      if desk.task != nil, desk.busy {
        WorkingStatus(
          startedAt: desk.workStartedAt ?? Date(), tools: currentTurnTools,
          waiting: !desk.pending.isEmpty, reduceMotion: reduceMotion
        ).padding(.horizontal, 36).padding(.vertical, 8)
      }
      if !desk.error.isEmpty {
        HStack(alignment: .top) {
          Image(systemName: "exclamationmark.circle")
          Text(desk.error).textSelection(.enabled)
          Spacer()
          Button {
            desk.error = ""
          } label: {
            Image(systemName: "xmark")
          }.buttonStyle(.plain)
        }.font(.caption).foregroundStyle(Color(red: 0.88, green: 0.66, blue: 0.61)).padding(
          .horizontal, 30
        ).padding(.vertical, 10)
      }
      if !desk.pending.isEmpty {
        ScrollView {
          VStack(alignment: .leading, spacing: 15) {
            ForEach(desk.pending) { r in
              RequestView(desk: desk, request: r, owner: desk.selected ?? "")
            }
          }.padding(.horizontal, 30)
        }.frame(maxHeight: 230)
      }
      VStack(spacing: 8) {
        VStack(alignment: .leading, spacing: 10) {
          if !desk.images.isEmpty {
            ScrollView(.horizontal) {
              HStack(spacing: 8) {
                ForEach(desk.images) { image in
                  DraftImageChip(image: image) {
                    desk.images.removeAll { $0.id == image.id }
                  }.frame(width: 52, height: 52)
                }
              }.scrollIndicators(.hidden)
            }
          }
          if !desk.context.isEmpty {
            ScrollView(.horizontal) {
              HStack {
                ForEach(desk.context, id: \.self) { file in
                  HStack(spacing: 5) {
                    Image(systemName: "doc")
                    Button(file) { desk.openFile(file) }.buttonStyle(.plain).lineLimit(1)
                    Button {
                      desk.context.removeAll { $0 == file }
                    } label: {
                      Image(systemName: "xmark")
                    }.buttonStyle(ComposerButtonStyle(compact: true))
                  }.font(.system(size: 10)).foregroundStyle(accent).padding(5).background(
                    accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 5)
                  )
                  .contextMenu {
                    Button("Vorschau öffnen") { desk.openFile(file) }
                    Button("Im Finder zeigen") { desk.revealFile(file) }
                  }
                }
              }.scrollIndicators(.hidden)
            }
          }
          if !desk.queue.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
              Text(
                desk.queue.count == 1
                  ? "1 Nachricht wartet" : "\(desk.queue.count) Nachrichten warten"
              ).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
              ForEach(desk.queue) { item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                  Text(item.kind == "steer" ? "Jetzt" : "Danach").font(.system(size: 10))
                    .foregroundStyle(item.kind == "steer" ? accent : Color.secondary)
                    .frame(width: 42, alignment: .leading)
                  Text(item.text).font(.system(size: 11)).lineLimit(2)
                  Spacer(minLength: 8)
                  Button {
                    desk.run { try await desk.removeQueued(item) }
                  } label: {
                    Image(systemName: "xmark").font(.system(size: 9, weight: .semibold))
                  }.buttonStyle(ComposerButtonStyle(compact: true)).help("Aus der Warteschlange nehmen")
                    .accessibilityLabel("Aus der Warteschlange nehmen")
                }
              }
            }.padding(.bottom, 4)
          }
          ComposerInput(
            text: $desk.draft, enabled: desk.task != nil && !desk.loading,
            onSubmit: { send() },
            onInterrupt: { send(interrupt: true) },
            onPasteImages: { desk.pasteImages() }
          ).frame(height: 64).overlay(alignment: .topLeading) {
            if desk.draft.isEmpty {
              Text(
                desk.busy
                  ? "Zusatz schicken oder eingreifen …" : "Was möchtest du ändern?"
              ).font(.system(size: 13)).foregroundStyle(.secondary)
                .padding(.leading, 7).padding(.top, 5).allowsHitTesting(false)
            }
          }
          HStack(spacing: 9) {
            Button {
              contextOpen.toggle()
            } label: {
              Image(systemName: "plus").font(.system(size: 15))
            }.buttonStyle(ComposerButtonStyle()).help("Kontext hinzufügen").accessibilityLabel(
              "Kontext hinzufügen"
            ).disabled(desk.task == nil).popover(isPresented: $contextOpen) {
              ContextPicker(desk: desk).frame(width: 330, height: 430)
            }
            Button {
              modeOpen.toggle()
            } label: {
              Label(
                modeLabels[desk.task?.mode ?? "always-ask"] ?? "Nachfragen",
                systemImage: desk.task?.mode == "yolo" ? "lock.open" : "checkmark.shield"
              ).font(.system(size: 10)).foregroundStyle(
                desk.task?.mode == "yolo" ? Color.orange : Color.secondary)
            }.buttonStyle(ComposerButtonStyle()).disabled(
              desk.task == nil || desk.busy || desk.loading
            ).popover(
              isPresented: $modeOpen
            ) {
              VStack(alignment: .leading, spacing: 14) {
                Text("Genehmigungen").font(.headline)
                ForEach(["always-ask", "write", "yolo"], id: \.self) { mode in
                  Button {
                    desk.run {
                      try await desk.setMode(mode)
                      modeOpen = false
                    }
                  } label: {
                    HStack {
                      VStack(alignment: .leading, spacing: 3) {
                        Text(modeLabels[mode]!)
                        Text(
                          mode == "always-ask"
                            ? "Änderungen und Befehle bestätigen."
                            : mode == "write"
                              ? "Dateien schreiben; Befehle bestätigen."
                              : "Dateien und Befehle ohne Rückfragen."
                        ).font(.caption).foregroundStyle(.secondary)
                      }
                      Spacer()
                      if desk.task?.mode == mode { Image(systemName: "checkmark") }
                    }
                  }.buttonStyle(.plain)
                }
                Text(
                  "Keine Dateisystem-Sandbox. Erlaubte Aktionen können auch außerhalb des Projekts arbeiten."
                ).font(.caption).foregroundStyle(.secondary)
              }.padding(22).frame(width: 330)
            }
            Spacer(minLength: 4)
            Button {
              modelOpen.toggle()
              Task { await desk.loadModels() }
            } label: {
              HStack(spacing: 4) {
                Text(desk.task?.model.isEmpty == false ? desk.task!.model : "Modell wählen")
                  .lineLimit(1)
                Image(systemName: "chevron.down").font(.system(size: 8))
              }.font(.system(size: 10)).foregroundStyle(.secondary)
            }.buttonStyle(ComposerButtonStyle()).disabled(desk.task == nil || desk.busy).popover(
              isPresented: $modelOpen
            ) {
              ModelPicker(desk: desk, close: { modelOpen = false }).frame(width: 360, height: 400)
            }
            if !desk.thinkingEfforts.isEmpty {
              Button {
                thinkingOpen.toggle()
              } label: {
                Text(thinkingLabel(desk.thinkingLevel)).font(.system(size: 10)).foregroundStyle(
                  .secondary)
              }.buttonStyle(ComposerButtonStyle()).help("Denkaufwand").accessibilityLabel(
                "Denkaufwand"
              ).disabled(desk.task == nil || desk.busy).popover(isPresented: $thinkingOpen) {
                ThinkingPicker(desk: desk).frame(width: 280)
              }
            }
            if desk.busy {
              Button {
                desk.run { try await desk.abortRun() }
              } label: {
                Image(systemName: "stop.fill").font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(deskBackground).frame(width: 30, height: 30).background(
                    Color.white.opacity(0.78), in: Circle())
              }.buttonStyle(ComposerButtonStyle(round: true)).help("Agent anhalten")
                .accessibilityLabel("Agent anhalten")
            }
            Button(action: { send() }) {
              Image(systemName: "arrow.up").font(.system(size: 13, weight: .semibold))
                .foregroundStyle(deskBackground).frame(width: 30, height: 30).background(
                  Color(white: 0.88), in: Circle())
            }.buttonStyle(ComposerButtonStyle(round: true)).help(
              desk.busy ? "In die Warteschlange · ↵" : "Senden · ↵"
            )
            .accessibilityLabel(desk.busy ? "In die Warteschlange" : "Nachricht senden").disabled(
              !desk.connected || desk.loading || desk.task == nil
                || (desk.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                  && desk.images.isEmpty)
            )
          }.background(ComposerArrowRegion())
        }.padding(14).background(
          LinearGradient(
            colors: [
              Color(red: 0.21, green: 0.235, blue: 0.245),
              Color(red: 0.16, green: 0.18, blue: 0.19),
            ], startPoint: .topLeading, endPoint: .bottomTrailing),
          in: RoundedRectangle(cornerRadius: 18)
        ).overlay(alignment: .top) {
          RoundedRectangle(cornerRadius: 1).fill(
            LinearGradient(
              colors: [.clear, Color.white.opacity(pulse ? 0.75 : 0.22), .clear],
              startPoint: .leading, endPoint: .trailing)
          ).frame(height: 1).padding(.horizontal, 20)
        }.shadow(color: .black.opacity(0.24), radius: 15, x: 0, y: 10)
        HStack {
          Text(desk.status)
          Spacer()
          Text(
            desk.busy
              ? "↵ Warteschlange · ⌥↵ eingreifen · ⇧↵ Absatz" : "↵ Senden · ⇧↵ Absatz")
        }.font(.system(size: 10)).foregroundStyle(.secondary).padding(.horizontal, 5)
      }.padding(.horizontal, 26).padding(.top, 16).padding(.bottom, 20)
    }
  }
  private func send(interrupt: Bool = false) {
    guard desk.connected, !desk.loading, desk.task != nil else { return }
    guard
      !desk.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !desk.images.isEmpty
    else { return }
    desk.run { try await desk.send(interrupt: interrupt) }
    guard !reduceMotion else { return }
    withAnimation(.easeOut(duration: 0.2)) { pulse = true }
    Task {
      try? await Task.sleep(for: .milliseconds(240))
      withAnimation(.easeOut(duration: 0.4)) { pulse = false }
    }
  }
}

// The AppKit editor owns only the writing area; controls always restore the arrow.
struct ComposerArrowRegion: NSViewRepresentable {
  final class Region: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func updateTrackingAreas() {
      super.updateTrackingAreas()
      trackingAreas.forEach { removeTrackingArea($0) }
      addTrackingArea(
        NSTrackingArea(
          rect: .zero,
          options: [
            .activeInKeyWindow, .inVisibleRect, .mouseEnteredAndExited, .mouseMoved, .cursorUpdate,
          ],
          owner: self, userInfo: nil))
    }
    override func resetCursorRects() { addCursorRect(visibleRect, cursor: .arrow) }
    override func cursorUpdate(with event: NSEvent) { NSCursor.arrow.set() }
    override func mouseEntered(with event: NSEvent) { NSCursor.arrow.set() }
    override func mouseMoved(with event: NSEvent) { NSCursor.arrow.set() }
  }
  func makeNSView(context: Context) -> Region { Region() }
  func updateNSView(_ view: Region, context: Context) {}
}

struct ComposerButtonStyle: ButtonStyle {
  var round = false
  var compact = false
  func makeBody(configuration: Configuration) -> some View {
    Surface(configuration: configuration, round: round, compact: compact)
  }
  private struct Surface: View {
    let configuration: ButtonStyle.Configuration
    let round: Bool
    let compact: Bool
    @Environment(\.isEnabled) private var enabled
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceAnimations") private var reduceAnimations = false
    private var reduceMotion: Bool { systemReduceMotion || reduceAnimations }
    @State private var hovered = false
    var body: some View {
      configuration.label
        .padding(.horizontal, round ? 0 : compact ? 4 : 8)
        .frame(minWidth: compact ? 20 : 30, minHeight: compact ? 20 : 30)
        .background(
          Color.white.opacity(enabled ? (configuration.isPressed ? 0.15 : hovered ? 0.08 : 0) : 0),
          in: RoundedRectangle(cornerRadius: round ? 15 : 7)
        )
        .brightness(enabled && hovered && round ? 0.09 : 0)
        .contentShape(RoundedRectangle(cornerRadius: round ? 15 : 7))
        .opacity(enabled ? 1 : 0.4)
        .onHover { hovered = $0 }
        .background(ComposerArrowRegion())
        .animation(reduceMotion ? nil : .easeOut(duration: 0.13), value: hovered)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.08), value: configuration.isPressed)
    }
  }
}

// AppKit text input supplies native selection, spelling and Return/Shift-Return behavior.
private struct DraftImageChip: NSViewRepresentable {
  let image: DraftImage
  let remove: () -> Void

  func makeNSView(context: Context) -> Chip {
    let view = Chip()
    view.remove = remove
    view.setImage(NSImage(data: image.data))
    return view
  }

  func updateNSView(_ view: Chip, context: Context) {
    view.remove = remove
    view.setImage(NSImage(data: image.data))
  }

  final class Chip: NSView {
    var remove: (() -> Void)?
    private let picture = NSImageView()
    private let close = NSButton()
    private var tracking: NSTrackingArea?

    override init(frame frameRect: NSRect) {
      super.init(frame: frameRect)
      wantsLayer = true
      layer?.cornerRadius = 8
      layer?.masksToBounds = true
      picture.imageScaling = .scaleAxesIndependently
      picture.wantsLayer = true
      addSubview(picture)
      close.bezelStyle = .circular
      close.isBordered = false
      close.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "Bild entfernen")
      close.imagePosition = .imageOnly
      close.contentTintColor = .white
      close.wantsLayer = true
      close.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.58).cgColor
      close.layer?.cornerRadius = 8
      close.target = self
      close.action = #selector(clear)
      close.toolTip = "Bild entfernen"
      close.setAccessibilityLabel("Bild entfernen")
      close.isHidden = true
      addSubview(close)
    }

    required init?(coder: NSCoder) { nil }

    func setImage(_ image: NSImage?) { picture.image = image }

    override var intrinsicContentSize: NSSize { NSSize(width: 52, height: 52) }

    override func layout() {
      super.layout()
      picture.frame = bounds
      close.frame = NSRect(x: bounds.width - 18, y: bounds.height - 18, width: 16, height: 16)
    }

    override func updateTrackingAreas() {
      super.updateTrackingAreas()
      if let tracking { removeTrackingArea(tracking) }
      let area = NSTrackingArea(
        rect: bounds,
        options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
        owner: self, userInfo: nil)
      addTrackingArea(area)
      tracking = area
    }

    override func mouseEntered(with event: NSEvent) { close.isHidden = false }
    override func mouseExited(with event: NSEvent) { close.isHidden = true }

    @objc private func clear() { remove?() }
  }
}

struct ComposerInput: NSViewRepresentable {
  @AppStorage("chatFontSize") private var chatFontSize = 13.0
  @Binding var text: String
  let enabled: Bool
  let onSubmit: () -> Void
  var onInterrupt: (() -> Void)? = nil
  var onPasteImages: (() -> Void)? = nil
  class Editor: NSTextView {
    var submit: (() -> Void)?
    var interrupt: (() -> Void)?
    var pasteImages: (() -> Void)?
    override func resetCursorRects() {
      discardCursorRects()
      addCursorRect(visibleRect, cursor: isEditable ? .iBeam : .arrow)
    }
    override func keyDown(with event: NSEvent) {
      if event.keyCode == 36 && !hasMarkedText() {
        if event.modifierFlags.contains(.shift) {
          super.keyDown(with: event)
        } else if event.modifierFlags.contains(.option) {
          interrupt?()
        } else {
          submit?()
        }
      } else {
        super.keyDown(with: event)
      }
    }
    override func paste(_ sender: Any?) {
      if clipboardHasImage() {
        pasteImages?()
        return
      }
      super.paste(sender)
    }
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
      if event.modifierFlags.contains(.command),
        event.charactersIgnoringModifiers?.lowercased() == "v", clipboardHasImage()
      {
        pasteImages?()
        return true
      }
      return super.performKeyEquivalent(with: event)
    }
    private func clipboardHasImage() -> Bool {
      let board = NSPasteboard.general
      if board.availableType(from: [.png, .tiff, .fileURL]) != nil {
        if board.data(forType: .png) != nil || board.data(forType: .tiff) != nil { return true }
        if let urls = board.readObjects(forClasses: [NSURL.self], options: [
          .urlReadingFileURLsOnly: true,
          .urlReadingContentsConformToTypes: [UTType.image.identifier],
        ]) as? [URL], !urls.isEmpty {
          return true
        }
      }
      return board.canReadItem(withDataConformingToTypes: [UTType.image.identifier])
    }
  }
  class Coordinator: NSObject, NSTextViewDelegate {
    var parent: ComposerInput
    init(_ parent: ComposerInput) { self.parent = parent }
    func textDidChange(_ notification: Notification) {
      if let view = notification.object as? NSTextView { parent.text = view.string }
    }
  }
  func makeCoordinator() -> Coordinator { Coordinator(self) }
  func makeNSView(context: Context) -> NSScrollView {
    let scroll = NSScrollView()
    scroll.drawsBackground = false
    scroll.hasVerticalScroller = true
    let text = Editor()
    text.isRichText = false
    text.drawsBackground = false
    text.font = .systemFont(ofSize: chatFontSize)
    text.textColor = NSColor(white: 0.92, alpha: 1)
    text.insertionPointColor = .white
    text.textContainerInset = NSSize(width: 2, height: 5)
    text.autoresizingMask = [.width]
    text.isVerticallyResizable = true
    text.isHorizontallyResizable = false
    text.textContainer?.widthTracksTextView = true
    text.delegate = context.coordinator
    text.submit = onSubmit
    text.interrupt = onInterrupt
    text.pasteImages = onPasteImages
    text.setAccessibilityLabel("Nachricht an den Agenten")
    scroll.documentView = text
    return scroll
  }
  func updateNSView(_ view: NSScrollView, context: Context) {
    context.coordinator.parent = self
    guard let editor = view.documentView as? Editor else { return }
    if editor.string != text { editor.string = text }
    if editor.isEditable != enabled {
      editor.isEditable = enabled
      editor.window?.invalidateCursorRects(for: editor)
    }
    editor.font = .systemFont(ofSize: chatFontSize)
    editor.submit = onSubmit
    editor.interrupt = onInterrupt
    editor.pasteImages = onPasteImages
  }
}

struct ContextPicker: View {
  @ObservedObject var desk: Desk
  @State private var folder = ""
  @State private var rows: [FileItem] = []
  @State private var error = ""
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Kontext hinzufügen").font(.headline)
      VStack(spacing: 6) {
        Button(action: pickFiles) {
          Label("Dateien wählen …", systemImage: "doc.badge.plus")
            .frame(maxWidth: .infinity, alignment: .leading)
        }.buttonStyle(.bordered)
        Button(action: pickFolder) {
          Label("Ordner wählen …", systemImage: "folder.badge.plus")
            .frame(maxWidth: .infinity, alignment: .leading)
        }.buttonStyle(.bordered)
      }
      if !folder.isEmpty {
        Button {
          folder = folder.split(separator: "/").dropLast().joined(separator: "/")
          load()
        } label: {
          Label(folder, systemImage: "chevron.left")
        }.buttonStyle(.plain).foregroundStyle(.secondary).lineLimit(1)
      }
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 3) {
          ForEach(rows) { f in
            Button {
              if f.directory {
                folder = f.path
                load()
              } else {
                desk.run { try await desk.addContext(f) }
              }
            } label: {
              HStack {
                Image(systemName: f.directory ? "folder" : "doc")
                Text(f.name).lineLimit(1)
                Spacer()
                if desk.context.contains(f.path) {
                  Image(systemName: "checkmark").foregroundStyle(accent)
                }
              }.padding(.vertical, 7).contentShape(Rectangle())
            }.buttonStyle(.plain)
          }
        }
      }
      if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.red) }
      Text("Textdateien · maximal 10 · zusammen 400 KB").font(.caption2).foregroundStyle(.secondary)
    }.padding(20).task { load() }
  }
  func load() {
    Task {
      do {
        rows = try await desk.fileList(folder)
        error = ""
      } catch {
        self.error = error.localizedDescription
      }
    }
  }
  private func pickFiles() {
    openPanel(files: true, folders: false, multiple: true, prompt: "Hinzufügen") { urls in
      Task { await attach(urls) }
    }
  }
  private func pickFolder() {
    openPanel(files: false, folders: true, multiple: false, prompt: "Öffnen") { urls in
      guard let url = urls.first else { return }
      Task { await openPickedFolder(url) }
    }
  }
  private func openPanel(
    files: Bool, folders: Bool, multiple: Bool, prompt: String, done: @escaping ([URL]) -> Void
  ) {
    let panel = NSOpenPanel()
    panel.canChooseFiles = files
    panel.canChooseDirectories = folders
    panel.allowsMultipleSelection = multiple
    panel.canCreateDirectories = false
    panel.prompt = prompt
    panel.message =
      files
      ? "Wähle Textdateien aus diesem Projekt."
      : "Wähle einen Ordner im Projekt, um ihn zu öffnen."
    if let path = desk.project?.path {
      let current = folder.isEmpty ? path : (path as NSString).appendingPathComponent(folder)
      panel.directoryURL = URL(fileURLWithPath: current)
    }
    panel.begin { result in
      guard result == .OK else { return }
      done(panel.urls)
    }
  }
  @MainActor private func attach(_ urls: [URL]) async {
    error = ""
    for url in urls {
      do {
        try await desk.addContext(FileItem(path: relative(from: url)))
      } catch {
        self.error = error.localizedDescription
        return
      }
    }
  }
  @MainActor private func openPickedFolder(_ url: URL) async {
    do {
      folder = try relative(from: url)
      load()
    } catch {
      self.error = error.localizedDescription
    }
  }
  private func relative(from url: URL) throws -> String {
    guard let root = desk.project?.path else {
      throw NSError(
        domain: "PiDesk", code: 4,
        userInfo: [NSLocalizedDescriptionKey: "Zuerst ein Projekt öffnen."])
    }
    guard let path = ProjectPath.normalize(url.path, projectRoot: root) else {
      throw NSError(
        domain: "PiDesk", code: 5,
        userInfo: [NSLocalizedDescriptionKey: "Bitte etwas innerhalb des Projekts wählen."])
    }
    return path
  }
}
private let thinkingTitles = [
  "off": "Aus", "minimal": "Minimal", "low": "Niedrig", "medium": "Mittel", "high": "Hoch",
  "xhigh": "Sehr hoch", "max": "Maximal", "auto": "Auto",
]
private func thinkingLabel(_ level: String) -> String { thinkingTitles[level] ?? level }

private struct TodoStrip: View {
  let phases: [Object]
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(Array(phases.enumerated()), id: \.offset) { _, phase in
        let name = string(phase, "name")
        let tasks = objects(phase, "tasks")
        if !name.isEmpty {
          Text(name).font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
        }
        ForEach(Array(tasks.enumerated()), id: \.offset) { _, item in
          let status = string(item, "status")
          HStack(spacing: 7) {
            Image(
              systemName: status == "completed"
                ? "checkmark.circle.fill"
                : status == "in_progress"
                  ? "circle.dotted" : status == "blocked" ? "exclamationmark.circle" : "circle"
            ).foregroundStyle(status == "completed" ? accent : Color.secondary)
            Text(string(item, "content")).font(.system(size: 12)).lineLimit(2)
          }
        }
      }
    }.padding(.bottom, 8)
  }
}

struct SessionToolsView: View {
  @ObservedObject var desk: Desk
  @Environment(\.dismiss) private var dismiss
  @State private var working = false
  @State private var failure = ""
  private var fast: Bool { desk.runtime["fastModeEnabled"] as? Bool == true }
  private func run(_ action: @escaping () async throws -> Void) {
    working = true
    failure = ""
    Task {
      do {
        try await action()
        dismiss()
      } catch { failure = error.localizedDescription }
      working = false
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text("Sitzung").font(.title2)
        Spacer()
        Button("Fertig") { dismiss() }.keyboardShortcut(.cancelAction)
      }
      Toggle(
        "Schnellmodus",
        isOn: Binding(
          get: { fast },
          set: { value in desk.run { try await desk.setFastMode(value) } })
      ).disabled(desk.busy || working)
      Text("Kompaktere Antworten, weniger Denkzeit.").font(.caption).foregroundStyle(.secondary)
      Divider().opacity(0.35)
      Button("Kontext komprimieren") { run { try await desk.compactSession() } }.disabled(
        desk.busy || working)
      Button("Als HTML exportieren") { run { try await desk.exportSession() } }.disabled(working)
      Button("Handoff speichern") { run { try await desk.handoffSession() } }.disabled(
        desk.busy || working)
      Button("Hier verzweigen") { run { try await desk.branchFromLast() } }.disabled(
        desk.busy || working)
      Button("Neue Sitzung in diesem Chat") { run { try await desk.resetSession() } }.disabled(
        desk.busy || working)
      Button("Sitzung teilen") { run { try await desk.shareSession() } }.disabled(working)
      Button("Sitzungsdatei importieren …") {
        dismiss()
        desk.importSessionFile()
      }
      Button("Befehle …") {
        dismiss()
        desk.showCommandPalette = true
        Task { await desk.loadCommands() }
      }
      Button("Wiederholung abbrechen") { desk.run { try await desk.abortRetry() } }.disabled(
        !desk.busy)
      if !desk.sessionStats.isEmpty {
        Divider().opacity(0.35)
        Text("Statistik").font(.headline)
        Text(summary(desk.sessionStats)).font(.caption).foregroundStyle(.secondary).textSelection(
          .enabled)
      }
      if !failure.isEmpty { Text(failure).font(.caption).foregroundStyle(.orange) }
    }.padding(24).frame(width: 420)
      .task { await desk.loadStats() }
  }
  private func summary(_ stats: Object) -> String {
    let keys = ["totalTokens", "inputTokens", "outputTokens", "cost", "durationMs", "turns"]
    let parts = keys.compactMap { key -> String? in
      guard let value = stats[key] else { return nil }
      return "\(key): \(value)"
    }
    if !parts.isEmpty { return parts.joined(separator: " · ") }
    return stats.keys.sorted().prefix(8).map { "\($0): \(stats[$0] ?? "")" }.joined(separator: " · ")
  }
}

struct CommandPalette: View {
  @ObservedObject var desk: Desk
  @Environment(\.dismiss) private var dismiss
  @State private var query = ""
  private var rows: [Object] {
    desk.commands.filter {
      query.isEmpty
        || string($0, "name").localizedCaseInsensitiveContains(query)
        || string($0, "description").localizedCaseInsensitiveContains(query)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Text("Befehle").font(.title2)
        Spacer()
        Button("Fertig") { dismiss() }
      }
      TextField("Befehl suchen", text: $query).textFieldStyle(.roundedBorder)
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 8) {
          ForEach(Array(rows.enumerated()), id: \.offset) { _, command in
            Button {
              desk.run {
                try await desk.runCommand(string(command, "name"))
                dismiss()
              }
            } label: {
              VStack(alignment: .leading, spacing: 3) {
                Text(string(command, "name")).font(.system(size: 13, weight: .medium))
                if !string(command, "description").isEmpty {
                  Text(string(command, "description")).font(.caption).foregroundStyle(.secondary)
                    .lineLimit(2)
                }
              }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 6)
            }.buttonStyle(.plain).disabled(desk.busy || desk.loading)
          }
          if rows.isEmpty {
            Text("Keine Befehle geladen.").font(.caption).foregroundStyle(.secondary).padding(
              .vertical, 40)
          }
        }
      }
    }.padding(24).frame(width: 460, height: 480).task { await desk.loadCommands() }
  }
}

struct SubagentList: View {
  @ObservedObject var desk: Desk
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text("Subagenten").font(.title2)
        Spacer()
        Button("Fertig") { dismiss() }
      }
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 12) {
          ForEach(Array(desk.subagents.enumerated()), id: \.offset) { _, agent in
            VStack(alignment: .leading, spacing: 4) {
              Text(string(agent, "agent").isEmpty ? string(agent, "id") : string(agent, "agent"))
                .font(.system(size: 13, weight: .medium))
              Text(
                [string(agent, "status"), string(agent, "description"), string(agent, "task")].filter
                { !$0.isEmpty }.joined(separator: " · ")
              ).font(.caption).foregroundStyle(.secondary)
            }.padding(.vertical, 8)
            Divider().opacity(0.3)
          }
          if desk.subagents.isEmpty {
            Text("Aktuell keine Subagenten.").foregroundStyle(.secondary).padding(.vertical, 40)
          }
        }
      }
    }.padding(24).frame(width: 460, height: 420).task { await desk.loadSubagents() }
  }
}

struct ThinkingPicker: View {
  @ObservedObject var desk: Desk
  private var steps: [String] {
    var values = desk.thinkingEfforts
    if !values.contains("auto") { values.insert("auto", at: 0) }
    return values
  }
  private var index: Double {
    Double(steps.firstIndex(of: desk.thinkingLevel) ?? 0)
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Aufwand").foregroundStyle(.secondary)
        Text(thinkingLabel(desk.thinkingLevel)).fontWeight(.medium)
        Spacer()
        Image(systemName: "questionmark.circle").font(.system(size: 12)).foregroundStyle(.tertiary)
          .help("Höherer Aufwand denkt länger nach, bevor geantwortet wird.")
      }.font(.system(size: 13))
      HStack {
        Text("Schneller").font(.system(size: 11)).foregroundStyle(.secondary)
        Spacer()
        Text("Intelligenter").font(.system(size: 11)).foregroundStyle(.secondary)
      }
      Slider(
        value: Binding(
          get: { index },
          set: { value in
            let next = steps[min(steps.count - 1, max(0, Int(value.rounded())))]
            guard next != desk.thinkingLevel else { return }
            desk.run { try await desk.setThinking(next) }
          }
        ), in: 0...Double(max(steps.count - 1, 1)), step: 1
      ).tint(Color.white.opacity(0.85))
    }
    .padding(16)
    .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 14))
  }
}

struct ModelPicker: View {
  @ObservedObject var desk: Desk
  let close: () -> Void
  @State private var search = ""
  var body: some View {
    VStack(alignment: .leading, spacing: 15) {
      Text("Modell wählen").font(.headline)
      TextField("Modell suchen", text: $search).textFieldStyle(.roundedBorder)
      if desk.models.isEmpty {
        Text("Verbinde einen Anbieter, um Modelle auszuwählen.").font(.caption).foregroundStyle(
          .secondary)
        Button("Anbieter verbinden") {
          close()
          desk.login()
        }
      }
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 5) {
          ForEach(Array(desk.models.enumerated()), id: \.offset) { _, m in
            if search.isEmpty
              || (string(m, "name") + string(m, "provider")).localizedCaseInsensitiveContains(
                search)
            {
              Button {
                desk.run {
                  try await desk.setModel(m)
                  close()
                }
              } label: {
                VStack(alignment: .leading, spacing: 3) {
                  Text(string(m, "name"))
                  Text(string(m, "provider")).font(.caption).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 7)
                  .contentShape(Rectangle())
              }.buttonStyle(.plain)
            }
          }
        }
      }
    }.padding(20)
  }
}
struct RequestView: View {
  @ObservedObject var desk: Desk
  let request: UIRequest
  let owner: String
  @State private var answer = ""
  @State private var submitting = false
  @State private var approvalOptions = false
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if !request.title.isEmpty {
        Text(request.title).font(.system(size: 12, weight: .medium)).textSelection(.enabled)
      }
      if !request.message.isEmpty {
        Text(request.message).font(.system(size: 12)).foregroundStyle(.secondary).textSelection(
          .enabled)
      }
      if request.method == "open_url" {
        Button {
          desk.open(request.url)
        } label: {
          Label("Anmeldung im Browser öffnen", systemImage: "arrow.up.right")
        }.buttonStyle(.borderedProminent)
      } else if request.method == "confirm" {
        HStack {
          if request.approvalKey.isEmpty {
            Button("Einmal erlauben") { respond(["confirmed": true]) }.buttonStyle(.borderedProminent)
          } else {
            approvalControl
          }
          Button("Ablehnen") { respond(["confirmed": false]) }
        }
      } else if request.method == "select" {
        if request.approvalKey.isEmpty {
          ForEach(request.options, id: \.self) { option in
            Button(option == "Approve" ? "Einmal erlauben" : option == "Deny" ? "Ablehnen" : option) {
              respond(["value": option])
            }
          }
        } else {
          HStack {
            approvalControl
            Button("Ablehnen") { respond(["value": "Deny"]) }
          }
        }
      } else {
        TextField("Code oder Weiterleitungsadresse", text: $answer).textFieldStyle(.roundedBorder)
          .onSubmit { respond(["value": answer]) }
        HStack {
          Button("Fortfahren") { respond(["value": answer]) }.disabled(answer.isEmpty)
          Button("Abbrechen") { respond(["cancelled": true]) }
        }
      }
    }.disabled(submitting).padding(.vertical, 10).frame(maxWidth: .infinity, alignment: .leading)
  }
  private var approvalControl: some View {
    HStack(spacing: 3) {
      Button {
        approve(scope: "once")
      } label: {
        Label("Einmal erlauben", systemImage: "checkmark")
      }
      .buttonStyle(.borderedProminent)
      .help("Dieses Mal erlauben")

      Button {
        approvalOptions.toggle()
      } label: {
        Text("•••")
          .font(.system(size: 9, weight: .semibold))
          .frame(width: 25, height: 18)
      }
      .buttonStyle(.bordered)
      .controlSize(.small)
      .help("Weitere Genehmigungsoptionen")
      .accessibilityLabel("Weitere Genehmigungsoptionen")
      .accessibilityHint("Dauerhaft für diesen Chat oder alle Chats erlauben")
      .popover(isPresented: $approvalOptions, arrowEdge: .bottom) {
        VStack(alignment: .leading, spacing: 4) {
          Button {
            approvalOptions = false
            approve(scope: "chat")
          } label: {
            Label("Für diesen Chat immer erlauben", systemImage: "bubble.left")
              .frame(maxWidth: .infinity, alignment: .leading)
          }
          Button {
            approvalOptions = false
            approve(scope: "global")
          } label: {
            Label("In allen Chats immer erlauben", systemImage: "checkmark.circle")
              .frame(maxWidth: .infinity, alignment: .leading)
          }
          Divider().padding(.vertical, 3)
          Text("Nur für „\(request.approvalKey)“")
            .font(.caption).foregroundStyle(.secondary)
        }
        .buttonStyle(.plain).padding(12).frame(width: 245)
      }
    }
  }
  func approve(scope: String) {
    submitting = true
    desk.run {
      defer { submitting = false }
      try await desk.approve(request, owner: owner, scope: scope)
    }
  }
  func respond(_ value: Object) {
    submitting = true
    desk.run {
      defer { submitting = false }
      try await desk.respond(request, owner: owner, body: value)
    }
  }
}
struct LoginView: View {
  @ObservedObject var desk: Desk
  var onClose: (() -> Void)? = nil
  @State private var search = ""
  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      HStack {
        Text("Anbieter verbinden").font(.system(size: 20, weight: .medium))
        Spacer()
        SymbolButton(symbol: "xmark", help: "Schließen") {
          if let onClose { onClose() } else { desk.showLogin = false }
        }
      }
      Text(
        "Mit deinem bestehenden Anbieter-Abo anmelden. Zugangsdaten bleiben lokal auf diesem Mac."
      ).font(.system(size: 12)).foregroundStyle(.secondary)
      if !desk.loginError.isEmpty {
        Text(desk.loginError).font(.caption).foregroundStyle(.red).textSelection(.enabled)
      }
      if desk.loginBusy {
        ScrollView {
          VStack(alignment: .leading, spacing: 14) {
            ForEach(desk.loginRequests) { r in RequestView(desk: desk, request: r, owner: "auth") }
            HStack {
              ProgressView().controlSize(.small)
              Text(desk.loginNotice.isEmpty ? "Anmeldung läuft …" : desk.loginNotice).font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
        Button("Anmeldung abbrechen") { desk.run { try await desk.cancelLogin() } }
      } else {
        TextField("Anbieter suchen", text: $search).textFieldStyle(.roundedBorder)
        ScrollView {
          LazyVStack(spacing: 2) {
            ForEach(Array(desk.providers.enumerated()), id: \.offset) { _, p in
              if search.isEmpty || string(p, "name").localizedCaseInsensitiveContains(search) {
                Button {
                  desk.run { try await desk.connect(string(p, "id")) }
                } label: {
                  HStack(spacing: 12) {
                    Image(
                      systemName: p["authenticated"] as? Bool == true
                        ? "checkmark.circle" : "person.crop.circle"
                    ).foregroundStyle(accent)
                    Text(string(p, "name")).font(.system(size: 12))
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.secondary)
                  }.padding(.vertical, 12).contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(p["available"] as? Bool == false)
              }
            }
          }
        }
      }
    }.padding(28).frame(width: 510, height: 500).background(deskBackground).preferredColorScheme(
      .dark)
  }
}
struct InspectorView: View {
  @ObservedObject var desk: Desk
  var body: some View {
    VStack(alignment: .leading, spacing: 15) {
      HStack {
        Picker("Ansicht", selection: $desk.inspectorTab) {
          Image(systemName: "folder").tag(0).help("Dateien")
          Image(systemName: "doc.text").tag(1).help("Vorschau")
          Image(systemName: "chevron.left.forwardslash.chevron.right").tag(2).help("Änderungen")
          Image(systemName: "square.split.2x1").tag(3).help("Worktrees")
        }.pickerStyle(.segmented).labelsHidden().frame(width: 170)
        Spacer()
        SymbolButton(symbol: "arrow.clockwise", help: "Aktualisieren") {
          Task {
            await desk.loadFiles()
            if desk.inspectorTab == 2 { await desk.loadDiff() }
          }
        }
        SymbolButton(symbol: "xmark", help: "Vorschau schließen") { desk.inspector = false }
      }
      if desk.project == nil {
        Text("Öffne ein Projekt, um seine Dateien zu sehen.").font(.caption).foregroundStyle(
          .secondary)
        Spacer()
      } else if desk.inspectorTab == 0 {
        if !desk.folder.isEmpty {
          Button {
            desk.navigate(desk.folder.split(separator: "/").dropLast().joined(separator: "/"))
          } label: {
            Label(desk.folder, systemImage: "chevron.left")
          }.buttonStyle(.plain).font(.caption)
        }
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 4) {
            ForEach(desk.files) { f in
              Button {
                if f.directory {
                  desk.navigate(f.path)
                } else {
                  desk.run { try await desk.preview(f) }
                }
              } label: {
                Label(f.name, systemImage: f.directory ? "folder" : "doc")
                  .font(.system(size: 12)).frame(maxWidth: .infinity, alignment: .leading)
                  .padding(.vertical, 7).contentShape(Rectangle())
              }.buttonStyle(.plain).contextMenu {
                if !f.directory {
                  Button("Vorschau öffnen") { desk.run { try await desk.preview(f) } }
                  Button("Im Finder zeigen") { desk.revealFile(f.path) }
                  Button("Kontext hinzufügen") { desk.run { try await desk.addContext(f) } }
                } else {
                  Button("Im Finder zeigen") { desk.revealFile(f.path) }
                }
              }
            }
          }
        }
      } else if desk.inspectorTab == 1 {
        HStack {
          Text(desk.filePath.isEmpty ? "Wähle eine Datei im Dateibaum." : desk.filePath).font(
            .caption
          ).foregroundStyle(.secondary).lineLimit(2).truncationMode(.middle)
          Spacer()
          if !desk.filePath.isEmpty {
            Button("Im Finder zeigen") { desk.revealFile(desk.filePath) }.buttonStyle(.plain).font(
              .caption)
          }
        }
        ScrollView([.vertical, .horizontal]) {
          Text(desk.fileText).font(.system(size: 11, design: .monospaced)).textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .contextMenu {
          if !desk.filePath.isEmpty {
            Button("Im Finder zeigen") { desk.revealFile(desk.filePath) }
          }
        }
      } else if desk.inspectorTab == 2 {
        Text("Alle Änderungen im Arbeitsverzeichnis, auch bereits vorhandene.").font(.caption)
          .foregroundStyle(.secondary)
        ScrollView([.vertical, .horizontal]) {
          Text(desk.diff).font(.system(size: 11, design: .monospaced)).textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
      } else {
        WorktreePanel(desk: desk)
      }
    }.padding(20).background(deskBackground)
      .onChange(of: desk.inspectorTab) { _, tab in
        if tab == 2 { Task { await desk.loadDiff() } }
        if tab == 3 { Task { await desk.loadWorktrees() } }
      }
      .task { await desk.loadFiles() }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.appearance = NSAppearance(named: .darkAqua)
    NSApp.activate(ignoringOtherApps: true)
    Task { @MainActor in
      Desk.shared.start()
      #if PI_DESK_PETS
        PetWindow.shared.start()
      #endif
    }
  }
  func applicationWillTerminate(_ notification: Notification) {
    MainActor.assumeIsolated { Desk.shared.stop() }
  }
  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    let running = MainActor.assumeIsolated { Desk.shared.busy || Desk.shared.loginBusy }
    if running {
      let alert = NSAlert()
      alert.messageText = "Pi Desk beenden?"
      alert.informativeText =
        "Ein Vorgang läuft noch. Beim Beenden wird er angehalten; gespeicherte Nachrichten bleiben erhalten."
      alert.addButton(withTitle: "Beenden")
      alert.addButton(withTitle: "Weiterarbeiten")
      if alert.runModal() != .alertFirstButtonReturn { return .terminateCancel }
    }
    return .terminateNow
  }
}
@main struct PiDeskApp: App {
  @StateObject private var shortcuts = DeskShortcuts.shared
  @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
  @StateObject private var desk = Desk.shared
  var body: some Scene {
    Window("Pi Desk", id: "main") { MainView(desk: desk) }.defaultSize(width: 1180, height: 800)
      .windowStyle(.hiddenTitleBar).commands {
        CommandGroup(replacing: .newItem) {
          Button("Neue Aufgabe") { desk.run { try await desk.newTask() } }.keyboardShortcut(
            shortcuts.shortcut(.newTask))
          Button("Projekt öffnen …", action: desk.chooseProject).keyboardShortcut(
            shortcuts.shortcut(.openProject))
        }
        #if PI_DESK_PETS
          CommandMenu("Pets") { PetOptions() }
        #endif
        CommandGroup(after: .toolbar) {
          Button("Dateien und Vorschau") { desk.inspector.toggle() }.keyboardShortcut(
            shortcuts.shortcut(.inspector))
          Button("Sitzungsdatei importieren …") { desk.importSessionFile() }
        }
      }
    Settings { DeskSettingsView(desk: desk) }
  }
}
