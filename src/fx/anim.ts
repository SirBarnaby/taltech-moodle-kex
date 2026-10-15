/**
 * Tracks running UI animations and mirrors the result on `<html data-kex-anim="running|done">`.
 * The visual-diff and e2e tests wait for "done" before taking pixels.
 */
let pending = 0;
let timer: number | undefined;

function set(v: 'running' | 'done'): void {
  document.documentElement.dataset.kexAnim = v;
}

export function animBegin(): void {
  pending++;
  window.clearTimeout(timer);
  set('running');
}

export function animEnd(): void {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    window.clearTimeout(timer);
    // Debounce: a view often starts the next animation right after one ends.
    timer = window.setTimeout(() => pending === 0 && set('done'), 60);
  }
}

/** Track a promise (or an already-finished animation). */
export function animTrack(p: Promise<unknown>): void {
  animBegin();
  void p.then(animEnd, animEnd);
}

/** Mark "done" when nothing is running (call after a view's first render). */
export function animSettle(): void {
  if (pending === 0) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => pending === 0 && set('done'), 60);
  }
}

export function animReset(): void {
  pending = 0;
  window.clearTimeout(timer);
  set('running');
}
