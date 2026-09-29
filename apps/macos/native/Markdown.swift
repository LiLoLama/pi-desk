import AppKit
import SwiftUI

enum ProjectPath {
  private static let extensions = Set(
    """
    swift mjs cjs js ts tsx jsx py md markdown json jsonc css scss html htm txt yml yaml toml \
    sh bash zsh fish ps1 c h cc cpp cxx hpp m mm rs go rb java kt kts xml plist svg csv tsv sql \
    graphql gql proto pbxproj entitlements xcconfig strings lock map vue svelte php lua r jl zig \
    nim ex exs erl hs clj cljs scala dart ini cfg conf gitignore dockerignore editorconfig \
    swiftinterface gradle properties log diff patch rst adoc tex bib png jpg jpeg gif webp bmp \
    ico pdf zip gz tgz wasm
    """.split(whereSeparator: \.isWhitespace).map(String.init)
  )

  static func looksLikeFile(_ raw: String) -> Bool {
    let value = clean(raw)
    guard !value.isEmpty, !value.contains(where: \.isWhitespace), value.count < 400 else {
      return false
    }
    if let scheme = scheme(value), !["file", "pidesk-file"].contains(scheme) { return false }
    let path = pathOnly(value)
    let name = (path as NSString).lastPathComponent
    guard !name.isEmpty, name != ".", name != ".." else { return false }
    let ext = (name as NSString).pathExtension.lowercased()
    if extensions.contains(ext) { return true }
    if name.hasPrefix("."), name.count > 1 { return true }
    return path.contains("/") && !path.hasSuffix("/")
  }

  static func normalize(_ raw: String, projectRoot: String) -> String? {
    var value = pathOnly(clean(raw))
    while value.hasPrefix("./") { value = String(value.dropFirst(2)) }
    let root = URL(fileURLWithPath: projectRoot).standardizedFileURL
    let candidate: URL
    if value.hasPrefix("~") {
      candidate = URL(fileURLWithPath: (value as NSString).expandingTildeInPath)
        .standardizedFileURL
    } else if value.hasPrefix("/") {
      candidate = URL(fileURLWithPath: value).standardizedFileURL
    } else {
      candidate = root.appendingPathComponent(value).standardizedFileURL
    }
    let rootPath = root.path
    let path = candidate.path
    if path == rootPath { return "" }
    guard path.hasPrefix(rootPath + "/") else { return nil }
    return String(path.dropFirst(rootPath.count + 1))
  }

  static func fileURL(_ relative: String, projectRoot: String) -> URL {
    URL(fileURLWithPath: projectRoot).appendingPathComponent(relative).standardizedFileURL
  }

  static func linkURL(_ relative: String) -> URL {
    var components = URLComponents()
    components.scheme = "pidesk-file"
    components.host = "project"
    components.queryItems = [URLQueryItem(name: "path", value: relative)]
    return components.url ?? URL(string: "pidesk-file://project")!
  }

  static func path(from url: URL) -> String? {
    guard url.scheme == "pidesk-file" else { return nil }
    return URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first {
      $0.name == "path"
    }?.value
  }

  static func clean(_ raw: String) -> String {
    var value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      .trimmingCharacters(in: CharacterSet(charactersIn: "`\"'<>"))
    if let range = value.range(of: #":\d+(?::\d+)?$"#, options: .regularExpression) {
      value.removeSubrange(range)
    }
    return value
  }

  private static func pathOnly(_ raw: String) -> String {
    var value = raw
    if value.hasPrefix("file://") {
      value = URL(string: value)?.path ?? String(value.dropFirst(7))
    } else if value.hasPrefix("file:") {
      value = String(value.dropFirst(5))
    }
    return value
  }

  private static func scheme(_ value: String) -> String? {
    guard let range = value.range(of: "://") else { return nil }
    let scheme = String(value[..<range.lowerBound]).lowercased()
    return scheme.allSatisfy({ $0.isLetter || $0 == "+" || $0 == "." || $0 == "-" }) ? scheme : nil
  }
}

enum MD {
  enum Target {
    case file(String)
    case url(URL)
  }

  enum Inline {
    case text(String)
    case strong([Inline])
    case emphasis([Inline])
    case strike([Inline])
    case code(String)
    case link([Inline], Target)
    case lineBreak
  }

  enum Block {
    case heading(Int, [Inline])
    case paragraph([Inline])
    case list(ordered: Bool, items: [ListItem])
    case quote([Block])
    case code(language: String, text: String)
    case table(headers: [[Inline]], rows: [[[Inline]]])
    case rule
  }

  struct ListItem {
    var task: Bool?
    var blocks: [Block]
  }

  static func parse(_ source: String) -> [Block] {
    var parser = Parser(source)
    return parser.parse()
  }
  static func autolink(_ source: String) -> [Inline] { tokenizePlain(source) }
}

private struct Parser {
  var lines: [Substring]
  var index = 0
  init(_ source: String) {
    lines = source.split(separator: "\n", omittingEmptySubsequences: false)
  }
  func peek() -> Substring? { index < lines.count ? lines[index] : nil }

  mutating func parse() -> [MD.Block] {
    var blocks: [MD.Block] = []
    while index < lines.count {
      let line = lines[index]
      if line.trimmingCharacters(in: .whitespaces).isEmpty {
        index += 1
        continue
      }
      if let fence = parseFence() { blocks.append(fence); continue }
      if let heading = parseHeading() { blocks.append(heading); continue }
      if parseRule() { blocks.append(.rule); continue }
      if let quote = parseQuote() { blocks.append(quote); continue }
      if let list = parseList(minIndent: 0) { blocks.append(list); continue }
      if let table = parseTable() { blocks.append(table); continue }
      blocks.append(parseParagraph())
    }
    return blocks
  }

  mutating func parseFence() -> MD.Block? {
    guard let line = peek() else { return nil }
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    guard trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~") else { return nil }
    let mark = String(trimmed.prefix(3))
    let language = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
    index += 1
    var body: [String] = []
    while index < lines.count {
      let current = String(lines[index])
      if current.trimmingCharacters(in: .whitespaces).hasPrefix(mark) {
        index += 1
        break
      }
      body.append(current)
      index += 1
    }
    return .code(language: language, text: body.joined(separator: "\n"))
  }

  mutating func parseHeading() -> MD.Block? {
    guard let line = peek() else { return nil }
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    guard trimmed.hasPrefix("#") else { return nil }
    var level = 0
    for character in trimmed {
      if character == "#" { level += 1 } else { break }
    }
    guard (1...6).contains(level) else { return nil }
    let rest = trimmed.dropFirst(level)
    guard rest.isEmpty || rest.first == " " else { return nil }
    index += 1
    return .heading(level, parseInlines(String(rest.drop(while: { $0 == " " }))))
  }

  mutating func parseRule() -> Bool {
    guard let line = peek() else { return false }
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    let compact = trimmed.filter { $0 != " " }
    guard compact.count >= 3, Set(compact).count == 1, let mark = compact.first,
      "-_*".contains(mark)
    else { return false }
    index += 1
    return true
  }

  mutating func parseQuote() -> MD.Block? {
    guard peek()?.trimmingCharacters(in: .whitespaces).hasPrefix(">") == true else { return nil }
    var inner: [String] = []
    while let current = peek() {
      let trimmed = current.trimmingCharacters(in: .whitespaces)
      guard trimmed.hasPrefix(">") else { break }
      var rest = trimmed.dropFirst()
      if rest.first == " " { rest = rest.dropFirst() }
      inner.append(String(rest))
      index += 1
    }
    return .quote(MD.parse(inner.joined(separator: "\n")))
  }

  mutating func parseList(minIndent: Int) -> MD.Block? {
    guard let first = listMatch(peek(), minIndent: minIndent) else { return nil }
    var items: [MD.ListItem] = []
    var ordered = first.ordered
    while let match = listMatch(peek(), minIndent: minIndent) {
      ordered = match.ordered
      index += 1
      var itemLines = [match.text]
      while let current = peek() {
        if current.trimmingCharacters(in: .whitespaces).isEmpty {
          if index + 1 < lines.count, listMatch(lines[index + 1], minIndent: minIndent) != nil {
            break
          }
          itemLines.append("")
          index += 1
          continue
        }
        if listMatch(current, minIndent: minIndent) != nil { break }
        if headingCandidate(current) || fenceCandidate(current) { break }
        let indent = leadingSpaces(current)
        if indent >= match.indent + 2 {
          itemLines.append(String(current.dropFirst(min(indent, match.indent + 2))))
          index += 1
        } else {
          break
        }
      }
      while itemLines.last?.trimmingCharacters(in: .whitespaces).isEmpty == true {
        itemLines.removeLast()
      }
      var task: Bool?
      var text = itemLines.joined(separator: "\n")
      if text.hasPrefix("[ ] ") {
        task = false
        text = String(text.dropFirst(4))
      } else if text.hasPrefix("[x] ") || text.hasPrefix("[X] ") {
        task = true
        text = String(text.dropFirst(4))
      }
      items.append(MD.ListItem(task: task, blocks: MD.parse(text)))
    }
    return items.isEmpty ? nil : .list(ordered: ordered, items: items)
  }

  struct ListMatch {
    var ordered: Bool
    var indent: Int
    var text: String
  }

  func listMatch(_ line: Substring?, minIndent: Int) -> ListMatch? {
    guard let line else { return nil }
    let indent = leadingSpaces(line)
    guard indent >= minIndent else { return nil }
    let rest = String(line.dropFirst(indent))
    if rest.hasPrefix("- ") || rest.hasPrefix("* ") || rest.hasPrefix("+ ") {
      return ListMatch(ordered: false, indent: indent, text: String(rest.dropFirst(2)))
    }
    var digits = 0
    for character in rest {
      if character.isNumber { digits += 1 } else { break }
    }
    guard digits > 0, digits < 8, rest.dropFirst(digits).hasPrefix(". ") else { return nil }
    return ListMatch(ordered: true, indent: indent, text: String(rest.dropFirst(digits + 2)))
  }

  mutating func parseTable() -> MD.Block? {
    guard let headerLine = peek(), headerLine.contains("|") else { return nil }
    let headerCells = tableCells(headerLine)
    guard headerCells.count >= 2, index + 1 < lines.count else { return nil }
    guard isTableDivider(lines[index + 1], columns: headerCells.count) else { return nil }
    index += 2
    var rows: [[[MD.Inline]]] = []
    while let current = peek(), current.contains("|"),
      !current.trimmingCharacters(in: .whitespaces).isEmpty
    {
      rows.append(tableCells(current).map(parseInlines))
      index += 1
    }
    return .table(headers: headerCells.map(parseInlines), rows: rows)
  }

  func tableCells(_ line: Substring) -> [String] {
    var value = line.trimmingCharacters(in: .whitespaces)
    if value.hasPrefix("|") { value.removeFirst() }
    if value.hasSuffix("|") { value.removeLast() }
    return value.split(separator: "|", omittingEmptySubsequences: false).map {
      $0.trimmingCharacters(in: .whitespaces)
    }
  }

  func isTableDivider(_ line: Substring, columns: Int) -> Bool {
    let cells = tableCells(line)
    guard cells.count == columns else { return false }
    return cells.allSatisfy { cell in
      let marks = cell.filter { $0 != ":" && $0 != " " }
      return marks.count >= 3 && marks.allSatisfy { $0 == "-" }
    }
  }

  mutating func parseParagraph() -> MD.Block {
    var body: [String] = []
    while let line = peek() {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.isEmpty { break }
      if fenceCandidate(line) || headingCandidate(line) || listMatch(line, minIndent: 0) != nil
        || trimmed.hasPrefix(">")
      {
        break
      }
      body.append(String(line))
      index += 1
    }
    return .paragraph(parseInlines(body.joined(separator: "\n")))
  }

  func headingCandidate(_ line: Substring) -> Bool {
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    guard trimmed.hasPrefix("#") else { return false }
    var level = 0
    for character in trimmed {
      if character == "#" { level += 1 } else { break }
    }
    return (1...6).contains(level)
      && (trimmed.count == level || trimmed.dropFirst(level).first == " ")
  }

  func fenceCandidate(_ line: Substring) -> Bool {
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    return trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~")
  }

  func leadingSpaces(_ line: Substring) -> Int {
    var count = 0
    for character in line {
      if character == " " { count += 1 } else if character == "\t" { count += 4 } else { break }
    }
    return count
  }
}

private func parseInlines(_ source: String) -> [MD.Inline] {
  var index = source.startIndex
  var buffer = ""
  var result: [MD.Inline] = []
  func flush() {
    if !buffer.isEmpty {
      result.append(contentsOf: tokenizePlain(buffer))
      buffer.removeAll(keepingCapacity: true)
    }
  }
  func remaining() -> Substring { source[index...] }
  while index < source.endIndex {
    if source[index] == "\\" {
      let next = source.index(after: index)
      if next < source.endIndex {
        buffer.append(source[next])
        index = source.index(after: next)
        continue
      }
    }
    if source[index] == "\n" {
      flush()
      result.append(.lineBreak)
      index = source.index(after: index)
      continue
    }
    if source[index] == "`", let close = findCode(source, from: index) {
      flush()
      result.append(.code(String(source[close.content])))
      index = close.end
      continue
    }
    if remaining().hasPrefix("**") || remaining().hasPrefix("__") {
      let mark = remaining().hasPrefix("**") ? "**" : "__"
      if let content = findClosing(source, from: source.index(index, offsetBy: 2), mark: mark) {
        flush()
        result.append(.strong(parseInlines(content.text)))
        index = content.end
        continue
      }
    }
    if remaining().hasPrefix("~~"),
      let content = findClosing(source, from: source.index(index, offsetBy: 2), mark: "~~")
    {
      flush()
      result.append(.strike(parseInlines(content.text)))
      index = content.end
      continue
    }
    if source[index] == "*" || source[index] == "_" {
      let mark = String(source[index])
      let innerStart = source.index(after: index)
      if innerStart < source.endIndex, source[innerStart] != " ",
        let content = findClosing(source, from: innerStart, mark: mark)
      {
        flush()
        result.append(.emphasis(parseInlines(content.text)))
        index = content.end
        continue
      }
    }
    if remaining().hasPrefix("![") || source[index] == "[" {
      let image = remaining().hasPrefix("![")
      let labelStart = source.index(index, offsetBy: image ? 2 : 1)
      if let labelEnd = findClosing(source, from: labelStart, mark: "]") {
        let cursor = labelEnd.end
        if cursor < source.endIndex, source[cursor] == "(" {
          let destStart = source.index(after: cursor)
          if let destEnd = findDestination(source, from: destStart) {
            flush()
            let label = parseInlines(labelEnd.text)
            if let target = classifyTarget(destEnd.text) {
              result.append(.link(image && label.isEmpty ? [.text(destEnd.text)] : label, target))
            } else if image {
              result.append(contentsOf: label.isEmpty ? [.text(destEnd.text)] : label)
            } else {
              result.append(contentsOf: label)
            }
            index = destEnd.end
            continue
          }
        }
      }
    }
    buffer.append(source[index])
    index = source.index(after: index)
  }
  flush()
  return result
}

private struct Span {
  var text: String
  var end: String.Index
}
private struct CodeSpan {
  var content: Range<String.Index>
  var end: String.Index
}

private func findClosing(_ source: String, from: String.Index, mark: String) -> Span? {
  var index = from
  while index < source.endIndex {
    if source[index] == "\\" {
      index = source.index(after: index)
      if index < source.endIndex { index = source.index(after: index) }
      continue
    }
    if source[index...].hasPrefix(mark) {
      return Span(
        text: String(source[from..<index]), end: source.index(index, offsetBy: mark.count))
    }
    index = source.index(after: index)
  }
  return nil
}

private func findCode(_ source: String, from: String.Index) -> CodeSpan? {
  var ticks = 0
  var index = from
  while index < source.endIndex, source[index] == "`" {
    ticks += 1
    index = source.index(after: index)
  }
  guard ticks > 0 else { return nil }
  let mark = String(repeating: "`", count: ticks)
  var search = index
  while search < source.endIndex {
    if source[search...].hasPrefix(mark) {
      return CodeSpan(content: index..<search, end: source.index(search, offsetBy: ticks))
    }
    search = source.index(after: search)
  }
  return nil
}

private func findDestination(_ source: String, from: String.Index) -> Span? {
  var index = from
  if index < source.endIndex, source[index] == "<" {
    let inner = source.index(after: index)
    if let close = source[inner...].firstIndex(of: ">"),
      source.index(after: close) < source.endIndex,
      source[source.index(after: close)] == ")"
    {
      return Span(text: String(source[inner..<close]), end: source.index(close, offsetBy: 2))
    }
  }
  while index < source.endIndex {
    if source[index] == ")" {
      return Span(
        text: String(source[from..<index]).trimmingCharacters(in: .whitespaces),
        end: source.index(after: index))
    }
    if source[index].isNewline { return nil }
    index = source.index(after: index)
  }
  return nil
}

private func classifyTarget(_ raw: String) -> MD.Target? {
  let value = raw.trimmingCharacters(in: .whitespaces)
  guard !value.isEmpty, !value.hasPrefix("#") else { return nil }
  if let url = URL(string: value), ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
    return .url(url)
  }
  if ProjectPath.looksLikeFile(value) || value.contains("/") { return .file(value) }
  return nil
}

private func tokenizePlain(_ text: String) -> [MD.Inline] {
  guard !text.isEmpty else { return [] }
  let ns = text as NSString
  let range = NSRange(location: 0, length: ns.length)
  guard let regex = try? NSRegularExpression(pattern: combinedPattern) else {
    return [.text(text)]
  }
  var result: [MD.Inline] = []
  var cursor = 0
  for match in regex.matches(in: text, range: range) {
    if match.range.location > cursor {
      result.append(
        .text(
          ns.substring(
            with: NSRange(location: cursor, length: match.range.location - cursor))))
    }
    let token = ns.substring(with: match.range)
    if let url = URL(string: token), ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
      result.append(.link([.text(token)], .url(url)))
    } else if ProjectPath.looksLikeFile(token) {
      result.append(.link([.text(token)], .file(token)))
    } else {
      result.append(.text(token))
    }
    cursor = match.range.location + match.range.length
  }
  if cursor < ns.length { result.append(.text(ns.substring(from: cursor))) }
  return result.isEmpty ? [.text(text)] : result
}

private let combinedPattern =
  #"https?://[^\s<>)\]]+|file://[^\s<>)\]]+|(?:~\/|\/|\.\/|\.\.\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+|[A-Za-z0-9._-]+\.(?:swift|mjs|cjs|js|ts|tsx|jsx|py|md|markdown|json|jsonc|css|scss|html|htm|txt|yml|yaml|toml|sh|bash|zsh|c|h|cc|cpp|hpp|m|mm|rs|go|rb|java|kt|xml|plist|svg|csv|sql|proto|vue|svelte|php|lua|png|jpg|jpeg|gif|webp|pdf|lock|diff|patch|log)"#

struct ChatMarkdown: View {
  let text: String
  let fontSize: CGFloat
  var inBubble = false
  var plain = false
  let onOpenFile: (String) -> Void
  let onRevealFile: (String) -> Void
  let onOpenURL: (String) -> Void

  var body: some View {
    MarkdownStack(
      blocks: plain ? [MD.Block.paragraph(MD.autolink(text))] : MD.parse(text),
      fontSize: fontSize, inBubble: inBubble, plain: plain, hug: inBubble, onOpenFile: onOpenFile,
      onRevealFile: onRevealFile, onOpenURL: onOpenURL)
  }
}

private struct MarkdownStack: View {
  let blocks: [MD.Block]
  let fontSize: CGFloat
  var inBubble = false
  var plain = false
  var hug = false
  let onOpenFile: (String) -> Void
  let onRevealFile: (String) -> Void
  let onOpenURL: (String) -> Void
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
        MarkdownBlock(
          block: block, first: index == 0, fontSize: fontSize, inBubble: inBubble, plain: plain,
          hug: hug, onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL)
      }
    }
  }
}

private struct MarkdownBlock: View {
  let block: MD.Block
  let first: Bool
  let fontSize: CGFloat
  var inBubble = false
  var plain = false
  var hug = false
  let onOpenFile: (String) -> Void
  let onRevealFile: (String) -> Void
  let onOpenURL: (String) -> Void

  var body: some View {
    switch block {
    case .heading(let level, let inlines):
      InlineMarkdown(
        inlines: inlines, fontSize: headingSize(level), weight: .medium, lineSpacing: 4, hug: hug,
        onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL
      )
      .padding(.top, first ? 2 : 18).padding(.bottom, 6)
    case .paragraph(let inlines):
      InlineMarkdown(
        inlines: inlines, fontSize: fontSize, weight: .regular,
        lineSpacing: inBubble ? 5 : 6, monospaced: plain, hug: hug,
        onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL
      )
      .padding(.top, first ? 0 : 10)
    case .list(let ordered, let items):
      VStack(alignment: .leading, spacing: 7) {
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
          HStack(alignment: .firstTextBaseline, spacing: 8) {
            listMarker(ordered: ordered, index: index, task: item.task)
            MarkdownStack(
              blocks: item.blocks, fontSize: fontSize, inBubble: inBubble, plain: plain, hug: hug,
              onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL)
          }
        }
      }.padding(.top, first ? 2 : 10)
    case .quote(let children):
      MarkdownStack(
        blocks: children, fontSize: fontSize, inBubble: inBubble, plain: plain, hug: hug,
        onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL
      )
      .foregroundStyle(.secondary)
      .padding(.leading, 14)
      .padding(.top, first ? 2 : 10)
    case .code(let language, let code):
      VStack(alignment: .leading, spacing: 6) {
        if !language.isEmpty {
          Text(language).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
        }
        Text(code.isEmpty ? " " : code)
          .font(.system(size: max(11, fontSize - 2), design: .monospaced))
          .textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(.horizontal, 12).padding(.vertical, 10)
      .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 8))
      .padding(.top, first ? 2 : 12)
    case .table(let headers, let rows):
      MarkdownTable(
        headers: headers, rows: rows, fontSize: max(11, fontSize - 1),
        onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL
      )
      .padding(.top, first ? 2 : 12)
    case .rule:
      Divider().opacity(0.55).padding(.vertical, 14)
    }
  }

  private func headingSize(_ level: Int) -> CGFloat {
    switch level {
    case 1: return fontSize + 7
    case 2: return fontSize + 4
    case 3: return fontSize + 2
    default: return fontSize
    }
  }

  @ViewBuilder private func listMarker(ordered: Bool, index: Int, task: Bool?) -> some View {
    if let task {
      Image(systemName: task ? "checkmark.circle" : "circle")
        .font(.system(size: fontSize - 1)).foregroundStyle(
          task ? Color(red: 0.73, green: 0.81, blue: 0.72) : Color.secondary)
        .frame(width: 16)
    } else if ordered {
      Text("\(index + 1).").font(.system(size: fontSize)).foregroundStyle(.secondary).frame(
        width: 22, alignment: .trailing)
    } else {
      Text("·").font(.system(size: fontSize + 2, weight: .medium)).foregroundStyle(.secondary)
        .frame(width: 12)
    }
  }
}

private struct MarkdownTable: View {
  let headers: [[MD.Inline]]
  let rows: [[[MD.Inline]]]
  let fontSize: CGFloat
  let onOpenFile: (String) -> Void
  let onRevealFile: (String) -> Void
  let onOpenURL: (String) -> Void
  var body: some View {
    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
      GridRow {
        ForEach(Array(headers.enumerated()), id: \.offset) { _, cell in
          InlineMarkdown(
            inlines: cell, fontSize: fontSize, weight: .medium, lineSpacing: 3, hug: true,
            onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL)
        }
      }
      Divider().opacity(0.45).gridCellColumns(max(headers.count, 1))
      ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
        GridRow {
          ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
            InlineMarkdown(
              inlines: cell, fontSize: fontSize, weight: .regular, lineSpacing: 3, hug: true,
              onOpenFile: onOpenFile, onRevealFile: onRevealFile, onOpenURL: onOpenURL)
          }
        }
      }
    }
  }
}

private struct InlineMarkdown: View {
  let inlines: [MD.Inline]
  let fontSize: CGFloat
  var weight: NSFont.Weight = .regular
  var lineSpacing: CGFloat = 6
  var monospaced = false
  var hug = false
  let onOpenFile: (String) -> Void
  let onRevealFile: (String) -> Void
  let onOpenURL: (String) -> Void
  var body: some View {
    ChatTextRepresentable(
      content: attributed(
        inlines, size: fontSize, weight: weight, lineSpacing: lineSpacing, monospaced: monospaced),
      fontSize: fontSize, hug: hug, onOpenFile: onOpenFile, onRevealFile: onRevealFile,
      onOpenURL: onOpenURL
    )
    .frame(maxWidth: hug ? nil : .infinity, alignment: .leading)
  }
}

private let cream = NSColor(srgbRed: 0.933, green: 0.937, blue: 0.922, alpha: 1)
private let sage = NSColor(srgbRed: 0.73, green: 0.81, blue: 0.72, alpha: 1)
private let muted = NSColor(srgbRed: 0.65, green: 0.658, blue: 0.658, alpha: 1)

private func systemFont(size: CGFloat, weight: NSFont.Weight, monospaced: Bool) -> NSFont {
  let base = NSFont.systemFont(ofSize: size, weight: weight)
  guard monospaced else { return base }
  if let descriptor = base.fontDescriptor.withDesign(.monospaced) {
    return NSFont(descriptor: descriptor, size: size)
      ?? NSFont.monospacedSystemFont(ofSize: size, weight: weight)
  }
  return NSFont.monospacedSystemFont(ofSize: size, weight: weight)
}

private func attributed(
  _ inlines: [MD.Inline], size: CGFloat, weight: NSFont.Weight, lineSpacing: CGFloat,
  monospaced: Bool
) -> NSAttributedString {
  let style = NSMutableParagraphStyle()
  style.lineSpacing = lineSpacing
  style.paragraphSpacing = 0
  style.lineBreakMode = .byWordWrapping
  let base: [NSAttributedString.Key: Any] = [
    .font: systemFont(size: size, weight: weight, monospaced: monospaced),
    .foregroundColor: cream,
    .paragraphStyle: style,
  ]
  let result = NSMutableAttributedString()
  for inline in inlines {
    result.append(render(inline, base: base, size: size, weight: weight, monospaced: monospaced))
  }
  return result
}

private func render(
  _ inline: MD.Inline, base: [NSAttributedString.Key: Any], size: CGFloat, weight: NSFont.Weight,
  monospaced: Bool
) -> NSAttributedString {
  switch inline {
  case .text(let text):
    return NSAttributedString(string: text, attributes: base)
  case .lineBreak:
    return NSAttributedString(string: "\n", attributes: base)
  case .strong(let children):
    var next = base
    next[.font] = systemFont(size: size, weight: .semibold, monospaced: monospaced)
    return join(children, base: next, size: size, weight: .semibold, monospaced: monospaced)
  case .emphasis(let children):
    var next = base
    let current =
      (base[.font] as? NSFont) ?? systemFont(size: size, weight: weight, monospaced: monospaced)
    next[.font] = NSFontManager.shared.convert(current, toHaveTrait: .italicFontMask)
    return join(children, base: next, size: size, weight: weight, monospaced: monospaced)
  case .strike(let children):
    var next = base
    next[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
    next[.foregroundColor] = muted
    return join(children, base: next, size: size, weight: weight, monospaced: monospaced)
  case .code(let text):
    var next = base
    next[.font] = systemFont(size: max(11, size - 1), weight: .regular, monospaced: true)
    next[.backgroundColor] = NSColor.white.withAlphaComponent(0.06)
    if ProjectPath.looksLikeFile(text) { applyLink(&next, ProjectPath.linkURL(text)) }
    return NSAttributedString(string: text, attributes: next)
  case .link(let children, let target):
    var next = base
    switch target {
    case .file(let path): applyLink(&next, ProjectPath.linkURL(path))
    case .url(let url): applyLink(&next, url)
    }
    if children.isEmpty {
      return NSAttributedString(string: label(target), attributes: next)
    }
    return join(children, base: next, size: size, weight: weight, monospaced: monospaced)
  }
}

private func applyLink(_ attributes: inout [NSAttributedString.Key: Any], _ url: URL) {
  attributes[.link] = url
  attributes[.foregroundColor] = sage
  attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
  attributes[.underlineColor] = sage.withAlphaComponent(0.55)
  attributes[.cursor] = NSCursor.pointingHand
}

private func join(
  _ children: [MD.Inline], base: [NSAttributedString.Key: Any], size: CGFloat,
  weight: NSFont.Weight, monospaced: Bool
) -> NSAttributedString {
  let result = NSMutableAttributedString()
  for child in children {
    result.append(render(child, base: base, size: size, weight: weight, monospaced: monospaced))
  }
  return result
}

private func label(_ target: MD.Target) -> String {
  switch target {
  case .file(let path): return path
  case .url(let url): return url.absoluteString
  }
}

private final class ChatTextView: NSTextView {
  var onOpenFile: ((String) -> Void)?
  var onRevealFile: ((String) -> Void)?
  var onOpenURL: ((String) -> Void)?

  override func scrollWheel(with event: NSEvent) {
    if abs(event.deltaX) > abs(event.deltaY), enclosingScrollView?.hasHorizontalScroller == true {
      super.scrollWheel(with: event)
      return
    }
    nextResponder?.scrollWheel(with: event)
  }

  override func mouseDown(with event: NSEvent) {
    window?.makeFirstResponder(self)
    super.mouseDown(with: event)
  }

  @discardableResult func handle(_ link: Any, reveal: Bool) -> Bool {
    let url: URL?
    if let value = link as? URL {
      url = value
    } else if let value = link as? String {
      url = URL(string: value)
    } else {
      url = nil
    }
    guard let url else { return false }
    if let path = ProjectPath.path(from: url) {
      if reveal { onRevealFile?(path) } else { onOpenFile?(path) }
      return true
    }
    if ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
      onOpenURL?(url.absoluteString)
      return true
    }
    return false
  }

  func path(at index: Int) -> String? {
    guard let url = url(at: index) else { return nil }
    return ProjectPath.path(from: url)
  }

  func url(at index: Int) -> URL? {
    guard index >= 0, index < (textStorage?.length ?? 0) else { return nil }
    if let url = textStorage?.attribute(.link, at: index, effectiveRange: nil) as? URL {
      return url
    }
    if let value = textStorage?.attribute(.link, at: index, effectiveRange: nil) as? String {
      return URL(string: value)
    }
    return nil
  }
}

private struct ChatTextRepresentable: NSViewRepresentable {
  let content: NSAttributedString
  let fontSize: CGFloat
  var hug = false
  let onOpenFile: (String) -> Void
  let onRevealFile: (String) -> Void
  let onOpenURL: (String) -> Void

  func makeCoordinator() -> Coordinator { Coordinator() }

  func makeNSView(context: Context) -> ChatTextView {
    let view = ChatTextView()
    view.drawsBackground = false
    view.isEditable = false
    view.isRichText = true
    view.isSelectable = true
    view.isHorizontallyResizable = false
    view.isVerticallyResizable = true
    view.textContainerInset = .zero
    view.textContainer?.lineFragmentPadding = 0
    view.textContainer?.widthTracksTextView = true
    view.textContainer?.heightTracksTextView = false
    view.minSize = .zero
    view.maxSize = NSSize(
      width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
    view.backgroundColor = .clear
    view.insertionPointColor = .clear
    view.focusRingType = .none
    view.isAutomaticQuoteSubstitutionEnabled = false
    view.isAutomaticTextReplacementEnabled = false
    view.isAutomaticDataDetectionEnabled = false
    view.isAutomaticLinkDetectionEnabled = false
    view.displaysLinkToolTips = true
    view.linkTextAttributes = [
      .foregroundColor: sage,
      .underlineStyle: NSUnderlineStyle.single.rawValue,
      .cursor: NSCursor.pointingHand,
    ]
    view.selectedTextAttributes = [
      .backgroundColor: sage.withAlphaComponent(0.28),
      .foregroundColor: NSColor.white,
    ]
    view.delegate = context.coordinator
    view.setContentHuggingPriority(.required, for: .vertical)
    view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    return view
  }

  func updateNSView(_ view: ChatTextView, context: Context) {
    context.coordinator.parent = self
    view.onOpenFile = onOpenFile
    view.onRevealFile = onRevealFile
    view.onOpenURL = onOpenURL
    view.delegate = context.coordinator
    if view.attributedString() != content {
      view.textStorage?.setAttributedString(content)
    }
  }

  func sizeThatFits(_ proposal: ProposedViewSize, nsView: ChatTextView, context: Context) -> CGSize?
  {
    let width = max(proposal.width ?? 10, 10)
    nsView.textContainer?.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
    nsView.frame.size.width = width
    guard let container = nsView.textContainer else {
      return CGSize(width: width, height: fontSize * 1.3)
    }
    nsView.layoutManager?.ensureLayout(for: container)
    let used = nsView.layoutManager?.usedRect(for: container) ?? .zero
    let measured = hug ? min(width, max(ceil(used.width), 8)) : width
    return CGSize(width: measured, height: max(ceil(used.height), ceil(fontSize * 1.15)))
  }

  final class Coordinator: NSObject, NSTextViewDelegate {
    var parent: ChatTextRepresentable?
    var menuPath = ""
    var menuURL: URL?

    func textView(_ textView: NSTextView, clickedOnLink link: Any, at charIndex: Int) -> Bool {
      (textView as? ChatTextView)?.handle(link, reveal: false) ?? false
    }

    func textView(_ view: NSTextView, menu: NSMenu, for event: NSEvent, at charIndex: Int) -> NSMenu?
    {
      guard let text = view as? ChatTextView else { return menu }
      let result = menu.copy() as? NSMenu ?? NSMenu()
      if let path = text.path(at: charIndex) {
        menuPath = path
        let preview = NSMenuItem(
          title: "Vorschau öffnen", action: #selector(openPreview), keyEquivalent: "")
        let reveal = NSMenuItem(
          title: "Im Finder zeigen", action: #selector(revealInFinder), keyEquivalent: "")
        let copy = NSMenuItem(
          title: "Pfad kopieren", action: #selector(copyPath), keyEquivalent: "")
        for item in [preview, reveal, copy] { item.target = self }
        result.items = [preview, reveal, copy, NSMenuItem.separator()] + result.items
      } else if let url = text.url(at: charIndex), url.scheme != "pidesk-file" {
        menuURL = url
        let open = NSMenuItem(
          title: "Link öffnen", action: #selector(openLink), keyEquivalent: "")
        let copy = NSMenuItem(
          title: "Adresse kopieren", action: #selector(copyLink), keyEquivalent: "")
        open.target = self
        copy.target = self
        result.items = [open, copy, NSMenuItem.separator()] + result.items
      }
      return result
    }

    @objc func openPreview() { parent?.onOpenFile(menuPath) }
    @objc func revealInFinder() { parent?.onRevealFile(menuPath) }
    @objc func copyPath() {
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(menuPath, forType: .string)
    }
    @objc func openLink() {
      if let url = menuURL { parent?.onOpenURL(url.absoluteString) }
    }
    @objc func copyLink() {
      guard let url = menuURL else { return }
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(url.absoluteString, forType: .string)
    }
  }
}
