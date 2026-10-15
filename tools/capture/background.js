// Saves page snapshots to Downloads/taltech-moodle-capture/.
// Session keys and login tokens are scrubbed so the files are safe to keep in a repo.
const DIR = 'taltech-moodle-capture';
const MAX_PAGES = 150;
const seenUrls = new Set();
const seenSheets = new Set();
let enabled = true;
let count = 0;

function scrub(text) {
  return text
    .replace(/(sesskey["'=:\s]+["']?)[A-Za-z0-9]{6,}/g, '$1REDACTED')
    .replace(/(logintoken["'=:\s]+(?:value=)?["']?)[A-Za-z0-9]{6,}/g, '$1REDACTED')
    .replace(/("?(?:token|wstoken|privatetoken)"?\s*[:=]\s*"?)[A-Za-z0-9]{16,}/g, '$1REDACTED');
}

function slug(url) {
  const u = new URL(url);
  const q = [...u.searchParams.entries()]
    .filter(([k]) => !/sesskey|token/i.test(k))
    .map(([k, v]) => `${k}-${v}`)
    .join('_');
  return (u.pathname.replace(/^\/|\.php$/g, '').replace(/[\/.]+/g, '_') || 'root') + (q ? '__' + q : '');
}

function save(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  return browser.downloads
    .download({ url, filename: `${DIR}/${name}`.slice(0, 200), conflictAction: 'overwrite', saveAs: false })
    .finally(() => setTimeout(() => URL.revokeObjectURL(url), 60000));
}

function badge() {
  browser.action.setBadgeText({ text: enabled ? String(count) : 'off' });
  browser.action.setBadgeBackgroundColor({ color: enabled ? '#7c3aed' : '#666' });
  browser.action.setTitle({ title: `Moodle capture: ${enabled ? 'on' : 'off'} (${count} pages saved)` });
}

browser.action.onClicked.addListener(() => {
  enabled = !enabled;
  badge();
});

browser.runtime.onMessage.addListener(async (msg) => {
  if (!enabled || msg.type !== 'capture' || count >= MAX_PAGES) return;
  const key = slug(msg.url);
  if (seenUrls.has(key)) return;
  seenUrls.add(key);
  count++;
  badge();

  const meta = {
    url: scrub(msg.url),
    kind: msg.kind,
    title: msg.title,
    bodyClass: msg.bodyClass,
    viewport: msg.viewport,
    sheets: msg.sheets,
    savedAt: new Date().toISOString(),
  };
  await save(`pages/${key}.html`, scrub(msg.html), 'text/html');
  await save(`pages/${key}.json`, JSON.stringify(meta, null, 2), 'application/json');

  // Theme CSS, once per stylesheet URL (same origin only, with the user's session).
  for (const href of msg.sheets) {
    if (seenSheets.has(href) || !href.startsWith('https://moodle.taltech.ee/')) continue;
    seenSheets.add(href);
    try {
      const res = await fetch(href, { credentials: 'include' });
      if (!res.ok) continue;
      const css = await res.text();
      await save(`css/${slug(href)}.css`, css, 'text/css');
    } catch (e) {
      /* stylesheet not reachable: skip */
    }
  }
});

badge();
