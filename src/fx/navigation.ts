import { motionTier } from './motion';
/** Short, interruptible view changes. Visual copies never delay the real route or receive input. */
const running = new Map<string, () => void>();
let activeScroll: (() => void) | undefined;

/** The one choreography of a page change (milliseconds, measured from the click). Every duration stays under 300. */
export const MOTION = {
  ease: 'cubic-bezier(.23, 1, .32, 1)',
  /** The copy of the old page fades out. */
  exit: 120,
  /** The new page fades in where it lands; nothing on it moves. */
  enterDelay: 40,
  enter: 200,
  /** Hero title pieces (white and coloured words together). */
  titleDelay: 80,
  title: 260,
  titleStagger: 35,
  /** The coloured second title line starts this much after the first and slides in like it. */
  accentDelay: 200,
  /** Teachers, progress and next deadline under the title. */
  metaDelay: 140,
  meta: 160,
  /** Characters of the topic title; the whole stagger fits in `topicStagger`. */
  topicDelay: 160,
  topic: 220,
  topicStagger: 120,
  /** Effects off: a plain crossfade. */
  subtle: 120,
  /** Switching topic inside a course. */
  topicExit: 110,
  topicEnter: 190,
} as const;

let lastPageBegin = -Infinity;

/**
 * Milliseconds since the last page change began, or 0 when it was a while ago. The new view mounts a little after the click;
 * delays in the table are counted from the click, so late starters take that time off their own delay.
 */
export function sinceNavigation(): number {
  const ms = performance.now() - lastPageBegin;
  return ms >= 0 && ms < 400 ? ms : 0;
}

export function viewMotionAllowed(): boolean {
  return motionTier() !== 'none';
}

/** Scroll without any smooth scrolling (the old page is still painted on top while this happens). */
export function scrollInstant(top: number): void {
  window.scrollTo({ top, left: 0, behavior: 'instant' as ScrollBehavior });
}

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
    scrollInstant(top);
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
    scrollInstant(position);
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

/**
 * Back, forward and reload: put the old scroll position back as soon as the view is mounted, and keep the page tall enough to
 * hold it (`ready` says when the real content is in; at most 2 s) so the position is not clamped while the skeleton is short.
 * Content that is already there (a cached course) is scrolled at once.
 */
export function restoreScroll(y: number, ready: () => boolean): void {
  if (!(y > 0)) return;
  const t0 = performance.now();
  let held: HTMLElement | null = null;
  let placed = false;
  const tick = (): void => {
    const main = document.getElementById('kex-main');
    const done = ready() || performance.now() - t0 > 2000;
    // Whichever view is current holds the height (a skeleton can give way to the view itself) until its content is in.
    if (held && (done || held !== main)) {
      held.style.minHeight = '';
      held = null;
    }
    if (main && !done && !held) {
      main.style.minHeight = `${y + window.innerHeight}px`;
      held = main;
    }
    if (main && !placed) {
      scrollInstant(y);
      placed = true;
    }
    if (!done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function cancelViewTransitions(): void {
  activeScroll?.();
  for (const stop of [...running.values()]) stop();
  running.clear();
}

function stripIdentity(ghost: HTMLElement): void {
  for (const node of [ghost, ...Array.from(ghost.querySelectorAll<HTMLElement>('*'))]) {
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name === 'id' || attribute.name.startsWith('data-kex-')) node.removeAttribute(attribute.name);
    }
  }
  // Copies of interactive media do not preserve a running viewer and should not start a second request.
  ghost.querySelectorAll('iframe, video, audio, canvas').forEach((node) => node.remove());
}

/** Rows below or above the viewport are not worth painting twice: they keep their height and lose their contents. */
function pruneOffscreen(source: HTMLElement, copy: HTMLElement): void {
  const from = Array.from(source.querySelectorAll<HTMLElement>('.kex-rows > *'));
  const to = Array.from(copy.querySelectorAll<HTMLElement>('.kex-rows > *'));
  const h = window.innerHeight;
  from.forEach((node, i) => {
    const target = to[i];
    if (!target) return;
    const r = node.getBoundingClientRect();
    if (r.bottom >= 0 && r.top <= h) return;
    target.style.height = `${r.height}px`;
    target.replaceChildren();
  });
}

/**
 * Capture before changing state; call the returned function immediately after the change to reveal its destination.
 * `page` copies the whole `.kex-main` (hero text and content), clipped to the viewport, and fades it out while the real page
 * (already scrolled to the top underneath) fades in where it stands: a slide would read as the page jumping. `topic` copies the
 * detail panel.
 */
export function beginViewTransition(
  element: HTMLElement | null,
  scope: 'page' | 'topic',
  options: { top?: number; scroll?: 'top' | 'anchor' | 'preserve' } = {},
): (selector: string) => Promise<void> {
  if (scope === 'page') {
    cancelViewTransitions();
    lastPageBegin = performance.now();
  } else running.get(scope)?.();
  const tier = motionTier();
  if (!element || tier === 'none' || typeof element.animate !== 'function') return () => Promise.resolve();
  const root = document.getElementById('kex-root');
  if (!root) return () => Promise.resolve();
  let resolve!: () => void;
  const finished = new Promise<void>((r) => { resolve = r; });
  const t0 = performance.now();
  const bounds = element.getBoundingClientRect();
  const copy = element.cloneNode(true) as HTMLElement;
  stripIdentity(copy);
  const ghost = document.createElement('div');
  ghost.classList.add('kex-transition-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  const base = { position: 'fixed', left: `${bounds.left}px`, width: `${bounds.width}px`, margin: '0', pointerEvents: 'none', zIndex: '24', overflow: 'hidden', background: 'var(--kex-bg)' };
  // The page head (hero or band) never fades: the copy of the old one turns see-through, so the old title leaves over the
  // new head, whose ribbons canvas carries straight on (and cross-fades its own palette).
  const headOnScreen = scope === 'page' && !!element.querySelector(':scope > :is(.kex-hero, .kex-band)') && element.getBoundingClientRect().top >= 0 && window.scrollY < 4;
  if (scope === 'page') {
    pruneOffscreen(element, copy);
    Object.assign(ghost.style, base, { top: '0px', height: `${Math.min(window.innerHeight, bounds.bottom)}px` });
    if (headOnScreen) {
      ghost.style.background = 'transparent';
      copy.style.background = 'transparent';
      const head = copy.querySelector<HTMLElement>(':scope > :is(.kex-hero, .kex-band)');
      if (head) {
        head.style.background = 'transparent';
        head.style.boxShadow = 'none';
        head.querySelectorAll('.kex-cross, .kex-hero__snap').forEach((n) => n.remove());
      }
      const content = copy.querySelector<HTMLElement>(':scope > .kex-content');
      if (content) {
        content.style.background = 'var(--kex-bg)';
        content.style.minHeight = `${Math.max(0, window.innerHeight - (head?.offsetHeight ?? 0))}px`;
      }
    }
    Object.assign(copy.style, { position: 'absolute', top: `${bounds.top}px`, left: '0px', width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', minHeight: '0', transform: 'none', transition: 'none' });
  } else {
    Object.assign(ghost.style, base, { top: `${bounds.top}px`, height: `${bounds.height}px` });
    Object.assign(copy.style, { margin: '0', width: '100%', height: '100%' });
  }
  ghost.appendChild(copy);
  root.appendChild(ghost);
  const exitMs = scope === 'page' ? (tier === 'full' ? MOTION.exit : MOTION.subtle) : MOTION.topicExit;
  const exit = ghost.animate(
    tier === 'full' && scope === 'topic' ? [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-14px)' }] : [{ opacity: 1 }, { opacity: 0 }],
    { duration: exitMs, easing: MOTION.ease, fill: 'forwards' },
  );
  let frame = 0;
  let enter: Animation | undefined;
  const stop = (): void => {
    cancelAnimationFrame(frame);
    exit.cancel();
    enter?.cancel();
    ghost.remove();
    if (running.get(scope) === stop) running.delete(scope);
    resolve();
  };
  running.set(scope, stop);
  void exit.finished.then(() => ghost.remove(), () => ghost.remove());
  return (selector) => {
    let tries = 0;
    const reveal = (): void => {
      frame = requestAnimationFrame(() => {
        if (running.get(scope) !== stop || !viewMotionAllowed()) return stop();
        const incoming = root.querySelector<HTMLElement>(selector);
        // The new view can be a frame late (it mounts after the state change): wait a few frames before giving up on the enter.
        if (!incoming && ++tries < 4) return reveal();
        if (!incoming || incoming === element && !incoming.isConnected) return stop();
        if (scope === 'page') {
          const full = tier === 'full';
          const lag = performance.now() - t0;
          const timing: KeyframeAnimationOptions = {
            duration: full ? MOTION.enter : MOTION.subtle,
            delay: Math.max(0, (full ? MOTION.enterDelay : 0) - lag),
            easing: MOTION.ease,
            fill: 'backwards',
          };
          const head = incoming.querySelector<HTMLElement>(':scope > :is(.kex-hero, .kex-band)');
          const body = incoming.querySelector<HTMLElement>(':scope > .kex-content');
          // The head stays opaque (its canvas never blanks); only the content fades in.
          enter = (head && body ? body : incoming).animate([{ opacity: 0 }, { opacity: 1 }], timing);
        } else {
          // Filters and lists: when the new content starts above the viewport, go back up to its top.
          if (options.scroll !== 'preserve') {
            const header = root.querySelector('.kex-header')?.getBoundingClientRect().bottom ?? 64;
            const anchor = Math.max(0, window.scrollY + incoming.getBoundingClientRect().top - header - 20);
            const top = options.top ?? Math.min(window.scrollY, anchor);
            if (Math.abs(top - window.scrollY) > 1) scrollViewport(top);
          }
          enter = incoming.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: MOTION.topicEnter, easing: MOTION.ease });
        }
        void enter.finished.then(stop, stop);
      });
    };
    reveal();
    return finished;
  };
}
