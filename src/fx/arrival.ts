import { MOTION } from './navigation';
import { motionTier } from './motion';

/**
 * Pages Moodle renders itself (Participants, Grades, activities) are full loads: the next document just starts at the top.
 * The old page leaves a note (scroll position, time) when a click is what unloads it; the new page reads it and plays the
 * same slide-down as a soft navigation, so a switch from such a page looks like the others.
 */
const KEY = 'kex-nav-from';
const FRESH_MS = 5000;
const CLICK_MS = 1500;
let lastClick = -Infinity;
let watching = false;

function write(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ y: Math.round(window.scrollY), t: Date.now() }));
  } catch {
    /* storage blocked: the page simply arrives without the slide */
  }
}

/** Called before a hard navigation that was not started by a click handler of ours (the soft-navigation fallback). */
export function markDeparture(): void {
  write();
}

export function watchDepartures(): void {
  if (watching) return;
  watching = true;
  document.addEventListener('click', () => { lastClick = performance.now(); }, true);
  window.addEventListener('pagehide', (e) => {
    if (!e.persisted && performance.now() - lastClick < CLICK_MS) write();
  });
}

/** On the new page, once the view is mounted: slide `main` in the way a soft navigation does. */
export function playArrival(main: HTMLElement | null): void {
  let note: { y?: number; t?: number } | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    note = raw ? (JSON.parse(raw) as { y?: number; t?: number }) : null;
  } catch {
    note = null;
  }
  if (!main || !note || typeof note.t !== 'number' || Date.now() - note.t > FRESH_MS) return;
  if (motionTier() !== 'full' || typeof main.animate !== 'function') return;
  const lift = note.y && note.y > 0 ? Math.min(note.y, MOTION.liftMax) : MOTION.liftRest;
  main.animate(
    [{ opacity: 0, transform: `translateY(${-lift}px)` }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: MOTION.enter, easing: MOTION.ease, fill: 'backwards' },
  );
}
