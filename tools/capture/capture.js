// Snapshot of the rendered page, sent to the background script for saving.
// Waits a moment so Moodle's own JS (course index, blocks, timeline) has filled in.
(() => {
  const SETTLE_MS = 2500;

  function pageKind() {
    const id = document.body ? document.body.id : '';
    return (id || 'page').replace(/^page-/, '');
  }

  function snapshot() {
    const root = document.documentElement.cloneNode(true);
    // Drop iframes' content and big inline images; keep everything structural.
    root.querySelectorAll('img[src^="data:"]').forEach((img) => img.setAttribute('src', 'data:,'));
    const html = '<!doctype html>\n' + root.outerHTML;
    const sheets = [];
    for (const s of document.styleSheets) {
      if (s.href) sheets.push(s.href);
    }
    browser.runtime.sendMessage({
      type: 'capture',
      url: location.href,
      kind: pageKind(),
      title: document.title,
      bodyClass: document.body ? document.body.className : '',
      html,
      sheets,
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    });
  }

  setTimeout(snapshot, SETTLE_MS);
})();
