func check(_ condition: Bool, _ message: String) {
  if !condition {
    FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
    exit(1)
  }
}
check(UpdateLogic.compare("0.10.0", "0.9.9") == 1, "numeric compare")
check(UpdateLogic.compare("0.3.0", "0.3.0") == 0, "equal versions")
check(UpdateLogic.compare("0.3", "0.3.1") == -1, "missing parts count as zero")
let items = [
  (version: "0.3.0", notes: "## 0.3.0\n\n- Alt"),
  (version: "0.4.0", notes: "## 0.4.0\n\n- Neu B\n"),
  (version: "0.3.1", notes: "## 0.3.1\n\n- Neu A"),
  (version: "0.3.2", notes: "  "),
]
check(
  UpdateLogic.notes(items, newerThan: "0.3.0") == "## 0.4.0\n\n- Neu B\n\n## 0.3.1\n\n- Neu A",
  "newer notes, newest first, blanks dropped")
check(UpdateLogic.notes(items, newerThan: "0.4.0").isEmpty, "nothing newer")
check(UpdateLogic.canReplace(bundlePath: "/Applications/Pi Desk.app", parentWritable: true), "Applications")
check(!UpdateLogic.canReplace(bundlePath: "/Volumes/Pi Desk/Pi Desk.app", parentWritable: false), "read-only disk image")
check(UpdateLogic.canReplace(bundlePath: "/Volumes/Daten/Programme/Pi Desk.app", parentWritable: true), "writable external volume")
check(
  !UpdateLogic.canReplace(bundlePath: "/private/var/folders/x/AppTranslocation/ABC/d/Pi Desk.app", parentWritable: true),
  "translocated")
let changelog = """
  # Pi Desk für macOS – Änderungen

  ## 0.5.0 – 20.10.2026

  - Neu B

  ## 0.4.1 - 12.10.2026

  - Neu A
  - Zweiter Punkt

  ## 0.4.0

  - Alt
  """
check(
  UpdateLogic.parseChangelog(changelog) == [
    UpdateLogic.ChangelogEntry(version: "0.5.0", date: "20.10.2026", body: "- Neu B"),
    UpdateLogic.ChangelogEntry(version: "0.4.1", date: "12.10.2026", body: "- Neu A\n- Zweiter Punkt"),
    UpdateLogic.ChangelogEntry(version: "0.4.0", date: "", body: "- Alt"),
  ], "parse: en dash, hyphen, missing date")
check(
  UpdateLogic.parseChangelog(changelog.replacingOccurrences(of: "\n", with: "\r\n"))
    == UpdateLogic.parseChangelog(changelog), "parse: CRLF")
let all = "## 0.5.0 – 20.10.2026\n\n- Neu B\n\n## 0.4.1 – 12.10.2026\n\n- Neu A\n- Zweiter Punkt\n\n## 0.4.0\n\n- Alt"
func news(_ seen: String?, _ installed: String) -> (show: Bool, notes: String, remember: String) {
  UpdateLogic.whatsNew(changelog: changelog, seen: seen, installed: installed)
}
var r = news("0.4.1", "0.5.0")
check(r.show && r.notes == "## 0.5.0 – 20.10.2026\n\n- Neu B" && r.remember == "0.5.0", "new minor")
r = news("0.3.0", "0.5.0")
check(r.show && r.notes == all && r.remember == "0.5.0", "skipped versions, newest first")
check(
  UpdateLogic.whatsNew(changelog: "## 0.10.0 – 01.01.2027\n\n- Zehn\n", seen: "0.9.3", installed: "0.10.0").show,
  "two-digit minor")
for (seen, installed) in [("0.4.0", "0.4.1"), ("0.5.0", "0.5.0"), ("0.5.0", "0.4.1"), ("0.5.0", "0.6.0")] {
  r = news(seen, installed)
  check(!r.show && r.notes.isEmpty && r.remember == installed, "quiet \(seen) → \(installed)")
}
for seen in [nil, "", "0.4", "0.4.0-beta", "kaputt"] as [String?] {
  r = news(seen, "0.5.0")
  check(!r.show && r.remember == "0.5.0", "invalid seen \(seen ?? "nil")")
}
check(
  UpdateLogic.recentNotes(changelog: changelog, installed: "0.4.1")
    == "## 0.4.1 – 12.10.2026\n\n- Neu A\n- Zweiter Punkt\n\n## 0.4.0\n\n- Alt", "recent notes up to installed")
let many = (0..<12).map { "## 0.\($0).0\n\n- Punkt \($0)" }.joined(separator: "\n\n")
let recent = UpdateLogic.recentNotes(changelog: many, installed: "0.11.0")
check(recent.components(separatedBy: "## ").count - 1 == 10 && recent.hasPrefix("## 0.11.0"), "at most ten")
check(UpdateLogic.recentNotes(changelog: "", installed: "0.4.0").isEmpty, "empty changelog")
print("ok")
