// User-facing release notes: CHANGELOG.md sections "## X.Y.Z – DD.MM.YYYY".
const heading = /^## (\d+\.\d+\.\d+)(?:\s+[–-]\s+(.+?))?\s*$/;

export function parseChangelog(text) {
  const entries = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = line.match(heading);
    if (match) {
      current = {version: match[1], date: match[2] || '', lines: []};
      entries.push(current);
    } else if (current) current.lines.push(line);
  }
  return entries.map(({lines, ...entry}) => ({...entry, body: lines.join('\n').trim()}));
}

export function section(text, version) {
  const entry = parseChangelog(text).find(e => e.version === version);
  if (!entry?.body) throw Error(`CHANGELOG.md enthält keinen Abschnitt für ${version}.`);
  return entry;
}

export const renderEntry = entry => `## ${entry.version}${entry.date ? ` – ${entry.date}` : ''}\n\n${entry.body}`;

// Sparkle compares CFBundleVersion; build.py derives the same number.
export function bundleVersion(version) {
  const parts = String(version).split('.').map(Number);
  if (parts.length !== 3 || !parts.every(n => Number.isInteger(n) && n >= 0)) throw Error(`Version ${version} muss X.Y.Z sein.`);
  if (parts[1] > 99 || parts[2] > 99) throw Error(`Version ${version}: Y und Z müssen < 100 sein.`);
  return String(parts[0] * 10000 + parts[1] * 100 + parts[2]);
}
