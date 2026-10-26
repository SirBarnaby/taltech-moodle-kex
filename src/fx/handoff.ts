import { signal } from '@preact/signals';
import { heroCanvas } from './heroCanvas';
import { armArrivalRush, startArrivalRush } from './rush';

/**
 * The sign-in hand-off (round 9). Signing in leaves Moodle for the identity provider (Microsoft, TARA), whose pages are white and
 * cannot be styled, and comes back through redirects. So white is the colour in between: the login lets its words go, its
 * ribbons speed up, and the window eases to white before the provider's page takes over; the first signed-in page starts from
 * that same white at document_start and the shell comes in through it (the menu slides in, the band's ribbons start fast and
 * settle, the content rises). Once per sign-in, never in the way: the white layer takes no clicks, and a key ends it.
 */

const KEY = 'kex-handoff';
/** The login must have seen the reader leave this recently. */
const FRESH_MS = 15 * 60 * 1000;
const VEIL_ID = 'kex-handoff';
const WASH_ID = 'kex-leave-wash';
/** The white never outlives a page that does not mount (a failed sign-in, an error page). */
const VEIL_MAX_MS = 6000;
/** The white lifts over this long once the shell is there; the shell's own entrance runs underneath. */
const LIFT_MS = 460;
/** The shell's entrance (data-kex-arrive), from the first frame of the lift. */
const ARRIVE_MS = 1100;
/** The welcome waits this long at most for the page to know the reader's name (the band then shows it for WELCOME_MS). */
const WELCOME_WAIT_MS = 12000;
export const WELCOME_MS = 5200;

interface Saved {
  t: number;
}

/** True for a few seconds after the hand-off: the page band says Moodle's "Welcome back, Marten! 👋" in place of its label. */
export const arrivalWelcome = signal(false);

const reducedMotion = (): boolean =>
  document.documentElement.dataset.kexMotion === 'reduced' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

let leaving = false;

/**
 * The reader picked a way to sign in. The navigation is already under way; this only fills the wait: the panel's words lift
 * away, the ribbons speed up, and the window eases to the white the provider's page will show.
 */
export function leaveLogin(): void {
  if (leaving) return;
  leaving = true;
  try {
    store()?.setItem(KEY, JSON.stringify({ t: Date.now() } satisfies Saved));
  } catch {
    // Storage full or blocked: the next page simply arrives without the hand-off.
  }
  if (reducedMotion()) return;
  const html = document.documentElement;
  html.dataset.kexLeaving = '';
  heroCanvas.rush(1, 700);
  if (!document.getElementById(WASH_ID)) {
    const wash = document.createElement('div');
    wash.id = WASH_ID;
    wash.className = 'kex-leave-wash';
    wash.setAttribute('aria-hidden', 'true');
    html.appendChild(wash);
  }
  // Back from the identity provider's page with the browser's Back button: the login is whole again.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    delete html.dataset.kexLeaving;
    document.getElementById(WASH_ID)?.remove();
    heroCanvas.rush(0, 1);
  }, { once: true });
}

/** Forget the hand-off (the login page itself: a sign-in that failed and came back). */
export function discardHandoff(): void {
  try {
    store()?.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

function peek(): Saved | null {
  let raw: string | null | undefined;
  try {
    raw = store()?.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Saved;
    const age = Date.now() - saved.t;
    if (typeof saved.t === 'number' && age >= 0 && age < FRESH_MS) return saved;
  } catch {
    // Not ours, or damaged.
  }
  discardHandoff();
  return null;
}

/**
 * At document_start of a page after the login: the white the provider left, over the whole window before the page exists. A
 * plain colour, so it is there in the first frame. The hand-off stays saved until a page plays or drops it.
 */
export function showVeil(): boolean {
  if (!peek() || document.getElementById(VEIL_ID)) return false;
  const veil = document.createElement('div');
  veil.id = VEIL_ID;
  veil.className = 'kex-handoff';
  veil.setAttribute('aria-hidden', 'true');
  document.documentElement.appendChild(veil);
  armArrivalRush(true);
  window.setTimeout(() => dropVeil(), VEIL_MAX_MS);
  return true;
}

/** The white is up and waiting for the shell. */
export function arriving(): boolean {
  const veil = document.getElementById(VEIL_ID);
  return !!veil && veil.dataset.leaving === undefined;
}

/**
 * Lift the white without the arrival (plain Moodle, a failed sign-in). `keep` leaves the hand-off saved: a page on the way back
 * from the identity provider that is not a Moodle page passes it on to the next one.
 */
export function dropVeil(keep = false): void {
  const veil = document.getElementById(VEIL_ID);
  if (!veil || veil.dataset.leaving !== undefined) return;
  if (!keep) discardHandoff();
  armArrivalRush(false);
  veil.dataset.leaving = '';
  if (typeof veil.animate !== 'function') {
    veil.remove();
    return;
  }
  void veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' }).finished.then(() => veil.remove(), () => veil.remove());
}

/** The signed-in page is mounted: lift the white and let the shell come in under it. */
export function playHandoff(): void {
  const veil = document.getElementById(VEIL_ID);
  if (!veil || veil.dataset.leaving !== undefined) return;
  discardHandoff();
  veil.dataset.leaving = '';
  const html = document.documentElement;
  arrivalWelcome.value = true;
  window.setTimeout(() => (arrivalWelcome.value = false), WELCOME_WAIT_MS);
  armArrivalRush(false);
  if (reducedMotion() || typeof veil.animate !== 'function') {
    if (typeof veil.animate !== 'function') veil.remove();
    else void veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => veil.remove(), () => veil.remove());
    return;
  }
  startArrivalRush();
  html.dataset.kexArrive = '';
  const lift = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LIFT_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    lift.cancel();
    veil.remove();
    delete html.dataset.kexArrive;
    window.removeEventListener('keydown', finish, true);
  };
  // A key ends it at once (the white never takes a click: the page under it is usable from the first frame).
  window.addEventListener('keydown', finish, true);
  void lift.finished.then(() => veil.remove(), () => undefined);
  window.setTimeout(finish, ARRIVE_MS);
}
