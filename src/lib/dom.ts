/** Small DOM helpers shared by the content script and the UI. */

export function qs<T extends Element = Element>(root: ParentNode, selectors: readonly string[]): T | null {
  for (const s of selectors) {
    const el = root.querySelector<T>(s);
    if (el) return el;
  }
  return null;
}

export function qsa<T extends Element = Element>(root: ParentNode, selectors: readonly string[]): T[] {
  for (const s of selectors) {
    const list = root.querySelectorAll<T>(s);
    if (list.length) return Array.from(list);
  }
  return [];
}

/** Text of an element without screen-reader-only children, whitespace collapsed. */
export function cleanText(el: Element | null | undefined, skip: string = '.sr-only, .visually-hidden, .accesshide'): string {
  if (!el) return '';
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll(skip).forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false;
  if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  return false;
}

export function inModal(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('.modal, [role="dialog"][aria-modal="true"]:not(.kex-dialog)');
}

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
