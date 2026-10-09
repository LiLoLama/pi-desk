// Sparkle appcast for updates/macos/appcast.xml. Descriptions hold Markdown; the app renders it natively.
import {renderEntry} from './changelog.mjs';

const attr = value => String(value).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const cdata = value => `<![CDATA[${String(value).replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
const empty = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Pi Desk für macOS</title>
  </channel>
</rss>
`;

export function appcastItem({version, build, entry, url, length, signature, minimumSystemVersion = '14.0', date = new Date()}) {
  return [
    '    <item>',
    `      <title>Pi Desk ${attr(version)}</title>`,
    `      <pubDate>${date.toUTCString()}</pubDate>`,
    `      <sparkle:version>${attr(build)}</sparkle:version>`,
    `      <sparkle:shortVersionString>${attr(version)}</sparkle:shortVersionString>`,
    `      <sparkle:minimumSystemVersion>${attr(minimumSystemVersion)}</sparkle:minimumSystemVersion>`,
    `      <description>${cdata(renderEntry(entry))}</description>`,
    `      <enclosure url="${attr(url)}" length="${attr(length)}" type="application/octet-stream" sparkle:edSignature="${attr(signature)}"/>`,
    '    </item>',
  ].join('\n');
}

export function addItem(existing, item, version) {
  const feed = existing || empty;
  if (feed.includes(`<sparkle:shortVersionString>${attr(version)}</sparkle:shortVersionString>`)) throw Error(`Version ${version} steht bereits im Appcast.`);
  const titleEnd = feed.indexOf('</title>') + '</title>'.length;
  if (titleEnd < '</title>'.length || !feed.includes('</channel>')) throw Error('Appcast hat ein unerwartetes Format.');
  return feed.slice(0, titleEnd) + '\n' + item + feed.slice(titleEnd);
}

export function parseSignature(output) {
  const signature = output.match(/sparkle:edSignature="([^"]+)"/)?.[1];
  const length = output.match(/length="(\d+)"/)?.[1];
  if (!signature || !length) throw Error('sign_update lieferte keine Signatur.');
  return {signature, length};
}
