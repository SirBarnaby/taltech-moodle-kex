/**
 * Minimal HTML sanitizer for Moodle content shown in our own UI (section summaries, page articles, note rows).
 * Allow-list based: unknown tags are unwrapped, scripts/styles dropped, attributes limited, URLs checked.
 */

const ALLOWED = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'dd', 'div', 'dl', 'dt', 'em', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'svg', 'math', 'audio', 'video', 'template', 'noscript']);
const ATTRS: Record<string, readonly string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
};

function safeUrl(value: string, base: string, allowData = false): string | null {
  try {
    const u = new URL(value.trim(), base);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return u.href;
    if (allowData && u.protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp);/i.test(value)) return value;
  } catch {
    /* invalid */
  }
  return null;
}

function clean(node: Node, out: Document, base: string, parent: Node): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      parent.appendChild(out.createTextNode(child.textContent ?? ''));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return;
    if (el.classList.contains('accesshide') || el.classList.contains('sr-only') || el.classList.contains('visually-hidden')) return;
    if (!ALLOWED.has(tag)) {
      clean(el, out, base, parent);
      return;
    }
    const copy = out.createElement(tag);
    for (const attr of ATTRS[tag] ?? []) {
      const v = el.getAttribute(attr);
      if (v === null) continue;
      if (attr === 'href' || attr === 'src') {
        const url = safeUrl(v, base, attr === 'src');
        if (url) copy.setAttribute(attr, url);
      } else {
        copy.setAttribute(attr, v);
      }
    }
    if (tag === 'a') {
      copy.setAttribute('rel', 'noopener noreferrer');
      copy.setAttribute('target', '_blank');
    }
    if (tag === 'img' && !copy.getAttribute('src')) return;
    clean(el, out, base, copy);
    parent.appendChild(copy);
  });
}

/** Sanitized HTML string for `html` (resolved against `base`). Safe for `dangerouslySetInnerHTML`. */
export function sanitizeHtml(html: string, base = typeof location === 'undefined' ? 'http://localhost/' : location.href): string {
  if (!html) return '';
  const src = new DOMParser().parseFromString(html, 'text/html');
  const out = document.implementation.createHTMLDocument('');
  const box = out.createElement('div');
  clean(src.body, out, base, box);
  return box.innerHTML;
}

/** Plain text of an HTML fragment (whitespace collapsed). */
export function htmlToText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, .accesshide, .sr-only, .visually-hidden').forEach((n) => n.remove());
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Decode HTML entities in a short string (Moodle returns "Containers &amp; Docker" in titles). */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return new DOMParser().parseFromString(s, 'text/html').documentElement.textContent ?? s;
}
