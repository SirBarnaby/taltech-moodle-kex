/** Waiting primitives for document_start: the root element and <body> may not exist yet. */

export function documentElementReady(): Promise<HTMLElement> {
  if (document.documentElement) return Promise.resolve(document.documentElement);
  return new Promise((resolve) => {
    const mo = new MutationObserver(() => {
      if (document.documentElement) {
        mo.disconnect();
        resolve(document.documentElement);
      }
    });
    mo.observe(document, { childList: true });
  });
}

/** Resolves as soon as <body> exists. Its id and classes are already set when it is created. */
export function waitForBody(html: HTMLElement): Promise<HTMLBodyElement> {
  if (document.body) return Promise.resolve(document.body as HTMLBodyElement);
  return new Promise((resolve) => {
    const mo = new MutationObserver(() => {
      if (document.body) {
        mo.disconnect();
        resolve(document.body as HTMLBodyElement);
      }
    });
    mo.observe(html, { childList: true });
  });
}

export function domContentLoaded(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
}

/** A Moodle page has a `page-…` body id or an M.cfg script. JSON, XML and error documents have neither. */
export function looksLikeMoodle(body: HTMLElement): boolean {
  if (body.id.startsWith('page-')) return true;
  return Array.from(document.scripts).some((s) => (s.textContent ?? '').includes('M.cfg'));
}
