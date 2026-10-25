import { MOTION, motionAllowed } from './motion';
export { MOTION } from './motion';
/** Short, interruptible view changes. Visual copies never delay the real route or receive input. */
const running = new Map<string, () => void>();
let activeScroll: (() => void) | undefined;

/** Bound progress per painted frame: delayed hydration must not consume an entire scroll animation offscreen. */
export function scrollViewport(top: number): { finished: Promise<void>; cancel: () => void } {
  activeScroll?.();
  let resolve!: () => void;
  const finished = new Promise<void>((r) => { resolve = r; });
  let frame = 0;
  let stopped = false;
  const cancel = (): void => {
    if (stopped) return;
    stopped = true;
    if (activeScroll === cancel) activeScroll = undefined;
    cancelAnimationFrame(frame);
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(event, cancel, true);
    resolve();
  };
  const from = window.scrollY;
  let position = from;
  activeScroll = cancel;
  if (!viewMotionAllowed() || Math.abs(top - from) < 1) {
    window.scrollTo({ top, behavior: 'instant' });
    cancel();
    return { finished, cancel };
  }
  const duration = Math.min(420, Math.max(240, Math.abs(top - from) * 0.35));
  let elapsed = 0;
  let last = performance.now();
  const tick = (now: number): void => {
    if (stopped) return;
    elapsed += Math.min(34, Math.max(0, now - last));
    last = now;
    const p = Math.min(1, elapsed / duration);
    const proposed = from + (top - from) * (1 - (1 - p) ** 3);
    const delta = proposed - position;
    position += Math.sign(delta) * Math.min(Math.abs(delta), Math.max(80, window.innerHeight * 0.18));
    window.scrollTo({ top: position, behavior: 'instant' });
    if (p >= 1 && Math.abs(position - top) < 1) cancel();
    else frame = requestAnimationFrame(tick);
  };
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(event, cancel, { capture: true, passive: true });
  frame = requestAnimationFrame(tick);
  return { finished, cancel };
}

/** Focus never owns scrolling. Callers explicitly request a reveal for keyboard list navigation. */
export function focusWithoutJump(element: HTMLElement | null, reveal = false): void {
  if (!element) return;
  element.focus({ preventScroll: true });
  if (!reveal) return;
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
      revealInScroller(element, parent);
      return;
    }
  }
  const rect = element.getBoundingClientRect();
  const header = document.querySelector('.kex-header')?.getBoundingClientRect().bottom ?? 64;
  if (rect.top < header || rect.bottom > window.innerHeight) {
    scrollViewport(Math.max(0, window.scrollY + rect.top - header - 16));
  }
}

/** Reveal an item inside its own list without scrolling any ancestor or the page. */
export function revealInScroller(element: HTMLElement | null, container: HTMLElement | null): void {
  if (!element || !container) return;
  const item = element.getBoundingClientRect();
  const box = container.getBoundingClientRect();
  const y = item.top < box.top ? item.top - box.top : item.bottom > box.bottom ? item.bottom - box.bottom : 0;
  const x = item.left < box.left ? item.left - box.left : item.right > box.right ? item.right - box.right : 0;
  if (x || y) container.scrollTo({ top: container.scrollTop + y, left: container.scrollLeft + x, behavior: viewMotionAllowed() ? 'smooth' : 'instant' });
}

/** Reader focus and nested scroll positions are restored together under the viewport policy. */
export function preserveViewport(origin: HTMLElement | undefined): () => void {
  const point = { x: window.scrollX, y: window.scrollY };
  const parents: { el: HTMLElement; top: number; left: number }[] = [];
  for (let el = origin?.parentElement; el; el = el.parentElement) {
    if (el.scrollTop || el.scrollLeft) parents.push({ el, top: el.scrollTop, left: el.scrollLeft });
  }
  return () => {
    if (origin?.isConnected) focusWithoutJump(origin);
    parents.forEach(({ el, top, left }) => { el.scrollTop = top; el.scrollLeft = left; });
    if (window.scrollY !== point.y || window.scrollX !== point.x) window.scrollTo({ top: point.y, left: point.x, behavior: 'instant' });
  };
}

export function viewMotionAllowed(): boolean {
  return motionAllowed();
}

export function cancelViewTransitions(): void {
  activeScroll?.();
  for (const stop of [...running.values()]) stop();
  running.clear();
}

/** Capture before changing state; call the returned function immediately after the change to reveal its destination. */
export function beginViewTransition(element: HTMLElement | null, scope: 'page' | 'topic', options: { top?: number; scroll?: 'top' | 'anchor' | 'preserve' } = {}): (selector: string) => Promise<void> {
  const height = document.documentElement.scrollHeight;
  // All scopes share one viewport and height lock; a newer interaction owns both.
  cancelViewTransitions();
  const root = document.getElementById('kex-root');
  if (!root) return () => Promise.resolve();
  let resolve!: () => void;
  const finished = new Promise<void>((r) => { resolve = r; });
  // A shorter destination must not let the browser clamp scrollY before our scroll policy runs.
  const minHeight = root.style.minHeight;
  root.style.minHeight = `${height}px`;
  const animate = !!element && viewMotionAllowed() && typeof element.animate === 'function';
  const bounds = element?.getBoundingClientRect();
  const ghost = animate ? element.cloneNode(true) as HTMLElement : null;
  if (ghost && bounds) {
    ghost.classList.add('kex-transition-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    for (const node of [ghost, ...Array.from(ghost.querySelectorAll<HTMLElement>('*'))]) {
      for (const attribute of Array.from(node.attributes)) {
        if (attribute.name === 'id' || attribute.name.startsWith('data-kex-')) node.removeAttribute(attribute.name);
      }
    }
    // Copies of interactive media do not preserve a running viewer and should not start a second request.
    ghost.querySelectorAll('iframe, video, audio, canvas').forEach((node) => node.remove());
    Object.assign(ghost.style, { position: 'fixed', top: `${bounds.top}px`, left: `${bounds.left}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', pointerEvents: 'none', zIndex: '24', overflow: 'hidden', background: 'var(--kex-bg)' });
    root.appendChild(ghost);
  }
  const exit = ghost?.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: MOTION.exit, easing: MOTION.ease });
  let frame = 0;
  let timer = 0;
  let enter: Animation | undefined;
  let scroll: ReturnType<typeof scrollViewport> | undefined;
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    exit?.cancel();
    enter?.cancel();
    scroll?.cancel();
    ghost?.remove();
    root.style.minHeight = minHeight;
    if (running.get(scope) === stop) running.delete(scope);
    resolve();
  };
  running.set(scope, stop);
  timer = window.setTimeout(stop, 10_000);
  void exit?.finished.then(() => ghost?.remove(), () => ghost?.remove());
  return (selector) => {
    frame = requestAnimationFrame(() => {
      if (running.get(scope) !== stop) return;
      const incoming = root.querySelector<HTMLElement>(selector);
      if (!incoming) return stop();
      const policy = options.scroll ?? (scope === 'page' ? 'top' : 'anchor');
      const header = root.querySelector('.kex-header')?.getBoundingClientRect().bottom ?? 64;
      const anchor = Math.max(0, window.scrollY + incoming.getBoundingClientRect().top - header - 20);
      const requested = options.top ?? (policy === 'top' ? 0 : policy === 'anchor' ? Math.min(window.scrollY, anchor) : window.scrollY);
      const main = root.querySelector('.kex-main');
      const max = main ? Math.max(0, window.scrollY + main.getBoundingClientRect().bottom - window.innerHeight) : Infinity;
      const top = Math.min(requested, max);
      const moves = Math.abs(top - window.scrollY) > 1;
      if (moves) scroll = scrollViewport(top);
      if (animate && viewMotionAllowed()) {
        enter = incoming.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: MOTION.enter, easing: MOTION.ease });
      }
      // Release height only after both the reveal and scroll finish, including on slow local devices.
      void Promise.all([enter?.finished.catch(() => undefined), scroll?.finished]).then(stop);
    });
    return finished;
  };
}
