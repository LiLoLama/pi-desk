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
check(
  !UpdateLogic.canReplace(bundlePath: "/private/var/folders/x/AppTranslocation/ABC/d/Pi Desk.app", parentWritable: true),
  "translocated")
print("ok")
