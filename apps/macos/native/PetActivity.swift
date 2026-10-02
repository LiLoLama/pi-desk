import Foundation

/// Presentation-only state. Never issues a tool response or changes permissions.
struct PetActivity {
  enum Mood: String { case idle, working, waiting, finished, problem, disconnected }
  var running: Set<String> = []
  var requests: [String: Set<String>] = [:]
  var failed: Set<String> = []
  var interrupted: Set<String> = []
  var completedAt: Date?
  var lastTask: String?
  var waitingTasks: [String] { requests.filter { !$0.value.isEmpty }.keys.sorted() }
  var attentionTask: String? {
    waitingTasks.first ?? failed.sorted().first ?? running.sorted().first ?? lastTask
  }
  func mood(connected: Bool, now: Date = Date()) -> Mood {
    if !connected { return .disconnected }
    if !waitingTasks.isEmpty { return .waiting }
    if !failed.isEmpty { return .problem }
    if !running.isEmpty { return .working }
    if let completedAt, now.timeIntervalSince(completedAt) < 4 { return .finished }
    return .idle
  }
  mutating func resolve(task: String, request: String) { requests[task]?.remove(request) }
  mutating func receive(_ event: [String: Any], task: String, now: Date = Date()) {
    guard task != "auth", !task.isEmpty else { return }
    let type = event["type"] as? String ?? ""
    if type == "agent_start" {
      running.insert(task)
      failed.remove(task)
      interrupted.remove(task)
      completedAt = nil
    }
    if type == "extension_ui_request" {
      let method = event["method"] as? String ?? ""
      if ["confirm", "select", "input", "editor"].contains(method), let id = event["id"] as? String
      {
        requests[task, default: []].insert(id)
      }
      if method == "cancel", let id = event["targetId"] as? String {
        resolve(task: task, request: id)
      }
    }
    if type == "message_end", let message = event["message"] as? [String: Any],
      message["role"] as? String == "assistant"
    {
      if message["stopReason"] as? String == "error" { failed.insert(task) }
      if message["stopReason"] as? String == "aborted" { interrupted.insert(task) }
    }
    if type == "failure" {
      failed.insert(task)
      running.remove(task)
      requests[task] = nil
    }
    if type == "prompt_result" {
      if event["status"] as? String == "error" { failed.insert(task) }
      if event["status"] as? String == "aborted" { interrupted.insert(task) }
      if event["sessionSettled"] as? Bool == true || event["agentInvoked"] as? Bool == false {
        running.remove(task)
      }
    }
    if type == "session_settled" {
      running.remove(task)
      requests[task] = nil
      lastTask = task
      if !failed.contains(task) && !interrupted.contains(task) { completedAt = now }
    }
  }
}
