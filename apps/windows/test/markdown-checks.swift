var failures = 0
func expect(_ condition: Bool, _ message: String) {
  if !condition {
    fputs(message + "\n", stderr)
    failures += 1
  }
}

let source = #"""
# Titel

Antwort mit **fett**, *kursiv* und `native/PiDesk.swift`.

- Punkt eins
- [x] erledigt

Siehe [Settings](native/Settings.swift) und https://example.com/docs.

```swift
print("ok")
```
"""#
let blocks = MD.parse(source)

expect(blocks.count >= 5, "expected several markdown blocks, got \(blocks.count)")
if case .heading(let level, let inlines) = blocks[0] {
  expect(level == 1, "heading level")
  expect(stringify(inlines) == "Titel", "heading text")
} else {
  expect(false, "first block should be heading")
}

if case .paragraph(let inlines) = blocks[1] {
  let kinds = inlineKinds(inlines)
  expect(kinds.contains("strong"), "bold missing: \(kinds)")
  expect(kinds.contains("emphasis"), "italic missing: \(kinds)")
  expect(kinds.contains("code"), "inline code missing: \(kinds)")
  expect(codeValues(inlines).contains("native/PiDesk.swift"), "inline file code missing")
} else {
  expect(false, "second block should be paragraph")
}

if case .list(let ordered, let items) = blocks[2] {
  expect(!ordered, "unordered list")
  expect(items.count == 2, "list items")
  expect(items[1].task == true, "task item")
} else {
  expect(false, "third block should be list")
}

if case .paragraph(let inlines) = blocks[3] {
  let kinds = inlineKinds(inlines)
  expect(kinds.contains("file"), "markdown file link missing: \(kinds)")
  expect(kinds.contains("url"), "url missing: \(kinds)")
} else {
  expect(false, "fourth block should be paragraph")
}

if case .code(let language, let text) = blocks.last {
  expect(language == "swift", "code language")
  expect(text.contains("print"), "code body")
} else {
  expect(false, "last block should be fenced code")
}

let root = "/tmp/pi-desk-project"
expect(ProjectPath.looksLikeFile("native/PiDesk.swift"), "looksLikeFile relative")
expect(ProjectPath.looksLikeFile("README.md"), "looksLikeFile basename")
expect(!ProjectPath.looksLikeFile("https://example.com"), "http is not a file")
expect(
  ProjectPath.normalize("native/PiDesk.swift", projectRoot: root) == "native/PiDesk.swift",
  "normalize relative")
expect(ProjectPath.normalize("../secret.txt", projectRoot: root) == nil, "escape rejected")
if let relative = ProjectPath.normalize("/tmp/pi-desk-project/README.md", projectRoot: root) {
  expect(relative == "README.md", "absolute inside project")
} else {
  expect(false, "absolute inside project rejected")
}
expect(
  ProjectPath.path(from: ProjectPath.linkURL("native/Settings.swift")) == "native/Settings.swift",
  "roundtrip link")

if failures > 0 { exit(1) }
print("ok")

func stringify(_ inlines: [MD.Inline]) -> String {
  inlines.map { inline -> String in
    switch inline {
    case .text(let t): return t
    case .strong(let c), .emphasis(let c), .strike(let c), .link(let c, _): return stringify(c)
    case .code(let t): return t
    case .lineBreak: return "\n"
    }
  }.joined()
}

func codeValues(_ inlines: [MD.Inline]) -> [String] {
  inlines.flatMap { inline -> [String] in
    switch inline {
    case .code(let t): return [t]
    case .strong(let c), .emphasis(let c), .strike(let c), .link(let c, _): return codeValues(c)
    default: return []
    }
  }
}

func inlineKinds(_ inlines: [MD.Inline]) -> [String] {
  inlines.flatMap { inline -> [String] in
    switch inline {
    case .text: return ["text"]
    case .strong(let c): return ["strong"] + inlineKinds(c)
    case .emphasis(let c): return ["emphasis"] + inlineKinds(c)
    case .strike(let c): return ["strike"] + inlineKinds(c)
    case .code: return ["code"]
    case .link(let c, let target):
      let kind: String
      switch target {
      case .file: kind = "file"
      case .url: kind = "url"
      }
      return [kind] + inlineKinds(c)
    case .lineBreak: return ["break"]
    }
  }
}
