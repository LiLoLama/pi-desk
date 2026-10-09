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
}
