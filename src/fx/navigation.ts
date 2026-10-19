import { motionTier } from './motion';
/** Short, interruptible view changes. Visual copies never delay the real route or receive input. */
const running = new Map<string, () => void>();

/** The one choreography of a page change (milliseconds, measured from the click). Every duration stays under 300. */
export const MOTION = {
  ease: 'cubic-bezier(.23, 1, .32, 1)',
  /** The copy of the old page fades out. */
  exit: 120,
  /** The new page fades in and slides down from `lift` px above. */
  enterDelay: 40,
  enter: 240,
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
  /** Page lift: min(old scroll, liftMax); liftRest when the old page was at the top. */
  liftMax: 160,
  liftRest: 8,
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

/**
 * Back and forward: put the old scroll position back as soon as the view is mounted, and keep the page tall enough to hold it
 * (`ready` says when the real content is in; at most 2 s) so the position is not clamped while the skeleton is short.
 */
export function restoreScroll(y: number, ready: () => boolean): void {
  if (!(y > 0)) return;
  const t0 = performance.now();
  const tick = (): void => {
    const main = document.getElementById('kex-main');
    if (ready() || performance.now() - t0 > 2000) {
      if (main) main.style.minHeight = '';
      return;
    }
    if (main && !main.style.minHeight) {
      main.style.minHeight = `${y + window.innerHeight}px`;
      scrollInstant(y);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function cancelViewTransitions(): void {
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
 * (already scrolled to the top underneath) fades in and slides down: it reads as one short scroll up. `topic` copies the detail panel.
 */
export function beginViewTransition(element: HTMLElement | null, scope: 'page' | 'topic'): (selector: string) => void {
  if (scope === 'page') {
    cancelViewTransitions();
    lastPageBegin = performance.now();
  } else running.get(scope)?.();
  const tier = motionTier();
  if (!element || tier === 'none' || typeof element.animate !== 'function') return () => undefined;
  const root = document.getElementById('kex-root');
  if (!root) return () => undefined;
  const t0 = performance.now();
  const bounds = element.getBoundingClientRect();
  const lift = scope === 'page' && tier === 'full' ? (window.scrollY > 0 ? Math.min(window.scrollY, MOTION.liftMax) : MOTION.liftRest) : 0;
  const copy = element.cloneNode(true) as HTMLElement;
  stripIdentity(copy);
  const ghost = document.createElement('div');
  ghost.classList.add('kex-transition-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  const base = { position: 'fixed', left: `${bounds.left}px`, width: `${bounds.width}px`, margin: '0', pointerEvents: 'none', zIndex: '24', overflow: 'hidden', background: 'var(--kex-bg)' };
  if (scope === 'page') {
    pruneOffscreen(element, copy);
    Object.assign(ghost.style, base, { top: '0px', height: `${Math.min(window.innerHeight, bounds.bottom)}px` });
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
          const keyframes: Keyframe[] = lift
            ? [{ opacity: 0, transform: `translateY(${-lift}px)` }, { opacity: 1, transform: 'translateY(0)' }]
            : [{ opacity: 0 }, { opacity: 1 }];
          const lag = performance.now() - t0;
          enter = incoming.animate(keyframes, {
            duration: lift ? MOTION.enter : MOTION.subtle,
            delay: Math.max(0, (lift ? MOTION.enterDelay : 0) - lag),
            easing: MOTION.ease,
            fill: 'backwards',
          });
        } else {
          enter = incoming.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: MOTION.topicEnter, easing: MOTION.ease });
        }
        void enter.finished.then(stop, stop);
      });
    };
    reveal();
  };
}
