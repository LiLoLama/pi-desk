import Foundation

/// Pure update rules used by the Sparkle driver; compiled standalone by test/update-logic.test.mjs.
enum UpdateLogic {
  static func compare(_ a: String, _ b: String) -> Int {
    let left = a.split(separator: ".").map { Int($0) ?? 0 }
    let right = b.split(separator: ".").map { Int($0) ?? 0 }
    for index in 0..<max(left.count, right.count) {
      let l = index < left.count ? left[index] : 0
      let r = index < right.count ? right[index] : 0
      if l != r { return l < r ? -1 : 1 }
    }
    return 0
  }

  /// Notes of every offered version newer than the installed one, newest first.
  static func notes(_ items: [(version: String, notes: String)], newerThan installed: String) -> String {
    items.filter { compare($0.version, installed) > 0 }
      .sorted { compare($0.version, $1.version) > 0 }
      .map { $0.notes.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: "\n\n")
  }

  /// Sparkle needs a writable parent folder (a mounted disk image is read-only) and no App Translocation copy.
  /// Apps on writable external volumes stay updatable.
  static func canReplace(bundlePath: String, parentWritable: Bool) -> Bool {
    parentWritable && !bundlePath.contains("/AppTranslocation/")
  }

  struct ChangelogEntry: Equatable {
    let version: String
    let date: String
    let body: String
  }

  /// CHANGELOG.md sections "## X.Y.Z – DD.MM.YYYY", same format as scripts/changelog.mjs.
  static func parseChangelog(_ text: String) -> [ChangelogEntry] {
    let heading = try! NSRegularExpression(pattern: #"^## (\d+\.\d+\.\d+)(?:\s+[–—-]\s+(.+?))?\s*$"#)
    var entries: [(version: String, date: String, lines: [String])] = []
    for line in text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") {
      let range = NSRange(line.startIndex..., in: line)
      if let match = heading.firstMatch(in: line, range: range), let version = Range(match.range(at: 1), in: line) {
        let date = Range(match.range(at: 2), in: line).map { String(line[$0]) } ?? ""
        entries.append((String(line[version]), date, []))
      } else if !entries.isEmpty {
        entries[entries.count - 1].lines.append(line)
      }
    }
    return entries.map {
      ChangelogEntry(
        version: $0.version, date: $0.date,
        body: $0.lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines))
    }
  }

  static func render(_ entries: [ChangelogEntry]) -> String {
    entries.map { "## \($0.version)\($0.date.isEmpty ? "" : " – \($0.date)")\n\n\($0.body)" }
      .joined(separator: "\n\n")
  }

  static func isVersion(_ value: String?) -> Bool {
    guard let value else { return false }
    let parts = value.split(separator: ".", omittingEmptySubsequences: false)
    return parts.count == 3
      && parts.allSatisfy { part in !part.isEmpty && part.allSatisfy { $0.isASCII && $0.isNumber } }
  }

  private static func minor(_ version: String) -> String {
    version.split(separator: ".").prefix(2).joined(separator: ".")
  }

  /// "Neu in dieser Version": shown once when major or minor grew since the last seen version.
  /// `remember` is always the installed version and is saved before the window appears.
  static func whatsNew(changelog: String, seen: String?, installed: String) -> (
    show: Bool, notes: String, remember: String
  ) {
    guard let seen, isVersion(seen), compare(installed, seen) > 0, minor(installed) != minor(seen) else {
      return (false, "", installed)
    }
    let entries = parseChangelog(changelog)
      .filter { compare($0.version, seen) > 0 && compare($0.version, installed) <= 0 }
      .sorted { compare($0.version, $1.version) > 0 }
    return (!entries.isEmpty, render(entries), installed)
  }

  /// "Was ist neu": the latest sections up to the installed version.
  static func recentNotes(changelog: String, installed: String, limit: Int = 10) -> String {
    render(
      Array(
        parseChangelog(changelog).filter { compare($0.version, installed) <= 0 }
          .sorted { compare($0.version, $1.version) > 0 }.prefix(limit)))
  }
}
