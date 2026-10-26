import { signal } from '@preact/signals';
import { heroCanvas } from './heroCanvas';
import { brightPoints, playSparks, type Spark, type SparkRun } from './particles';

/**
 * The sign-in hand-off (round 8). Signing in leaves Moodle for Uni-ID or TARA and comes back through redirects, and no browser
 * transition crosses that. So the login carries its own last frame across: it saves the ribbons' picture in sessionStorage (the
 * tab's, which survives the trip) and the first signed-in page paints it full-window at document_start. Once the shell is there,
 * the picture closes in on the page's band or hero (its own ribbons take over), its edges come apart into points of light, and
 * the sidebar and header settle in behind. Once per sign-in, never in the way: a click or a key ends it, and the page under it
 * is usable from the first frame.
 */

const KEY = 'kex-handoff';
/** The login must have seen the reader leave this recently. */
const FRESH_MS = 15 * 60 * 1000;
/** The saved frame's width: the ribbons are soft, and a small frame keeps the click that leaves the login quick. */
const WIDTH = 720;
const VEIL_ID = 'kex-handoff';
/** The veil never outlives a page that does not mount (a failed sign-in, an error page). */
const VEIL_MAX_MS = 6000;
const ARRIVE_MS = 1100;
/** Share of the arrival spent closing in; the rest is the cross-fade to the page's own ribbons. */
const CLOSE = 0.74;
const SPARKS = 700;
/** The welcome waits this long at most for the page to know the reader's name (the band then shows it for WELCOME_MS). */
const WELCOME_WAIT_MS = 12000;
export const WELCOME_MS = 5200;

interface Saved {
  t: number;
  /** The ribbons as a data URL; absent with effects off (the veil shows the login's own picture from the stylesheet). */
  img?: string;
}

/** True for a few seconds after the hand-off: the page band says Moodle's "Welcome back, Marten! 👋" in place of its label. */
export const arrivalWelcome = signal(false);

const reducedMotion = (): boolean =>
  document.documentElement.dataset.kexMotion === 'reduced' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const effectsOff = (): boolean => document.documentElement.dataset.kexEffects === 'off';

function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function frameUrl(): string | undefined {
  const snap = heroCanvas.snapshot();
  if (!snap || snap.width < 2) return undefined;
  const scale = Math.min(1, WIDTH / snap.width);
  const c = document.createElement('canvas');
  c.width = Math.round(snap.width * scale);
  c.height = Math.round(snap.height * scale);
  // A CPU-backed canvas: the encode below then never waits on a busy GPU.
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(snap, 0, 0, c.width, c.height);
  try {
    const webp = c.toDataURL('image/webp', 0.82);
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.85);
  } catch {
    return undefined;
  }
}

let leaving = false;

/**
 * The reader picked a way to sign in. Save the frame, then let the panel's words lift away while the ribbons widen to the
 * window, speed up and brighten. The navigation is already under way; this only fills the wait.
 */
export function leaveLogin(): void {
  if (leaving) return;
  leaving = true;
  try {
    store()?.setItem(KEY, JSON.stringify({ t: Date.now(), img: effectsOff() ? undefined : frameUrl() } satisfies Saved));
  } catch {
    // Storage full or blocked: the next page simply arrives without the hand-off.
  }
  if (reducedMotion()) return;
  document.documentElement.dataset.kexLeaving = '';
  heroCanvas.rush(1, 700);
  // Back from the identity provider's page with the browser's Back button: the login is whole again.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    delete document.documentElement.dataset.kexLeaving;
    heroCanvas.rush(0, 1);
  }, { once: true });
}

/** Forget a saved frame (the login page itself: a sign-in that failed and came back). */
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
 * At document_start of a page after the login: paint the saved frame over the whole window before the page exists. The frame
 * stays saved until a page plays or drops it, so the redirect from /my/ to My courses carries it one page further.
 */
export function showVeil(): boolean {
  const saved = peek();
  if (!saved || document.getElementById(VEIL_ID)) return false;
  const veil = document.createElement('div');
  veil.id = VEIL_ID;
  veil.className = 'kex-handoff';
  veil.setAttribute('aria-hidden', 'true');
  if (saved.img) {
    veil.style.backgroundImage = `url("${saved.img}")`;
    veil.dataset.img = '';
  }
  document.documentElement.appendChild(veil);
  window.setTimeout(() => dropVeil(), VEIL_MAX_MS);
  return true;
}

/**
 * Lift the veil without the arrival (plain Moodle, a failed sign-in). `keep` leaves the frame saved: a page on the way back from
 * the identity provider that is not a Moodle page passes it on to the next one.
 */
export function dropVeil(keep = false): void {
  const veil = document.getElementById(VEIL_ID);
  if (!veil || veil.dataset.leaving !== undefined) return;
  if (!keep) discardHandoff();
  veil.dataset.leaving = '';
  if (typeof veil.animate !== 'function') {
    veil.remove();
    return;
  }
  void veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' }).finished.then(() => veil.remove(), () => veil.remove());
}

const frames = (n: number): Promise<void> => new Promise((res) => {
  const step = (): void => (--n <= 0 ? res() : void requestAnimationFrame(step));
  requestAnimationFrame(step);
});

/** easeInOutCubic; the clip below runs on cubic-bezier(.65,0,.35,1), its usual stand-in. */
const ease = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const EASE_CSS = 'cubic-bezier(.65,0,.35,1)';

/** The progress (0..1, of the closing) at which the eased edges reach `k`. */
function unease(k: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < k) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How far (0..1) the edges have closed in when the point (x, y) falls outside the picture; Infinity if it stays inside. */
function exitAt(x: number, y: number, to: Box, W: number, H: number): number {
  let k = Infinity;
  if (x < to.left) k = Math.min(k, x / to.left);
  if (x > to.right) k = Math.min(k, (W - x) / (W - to.right));
  if (y < to.top) k = Math.min(k, y / to.top);
  if (y > to.bottom) k = Math.min(k, (H - y) / (H - to.bottom));
  return k;
}

/**
 * The signed-in page is mounted: close the saved picture in on its band or hero (the header strip on a page without one), let
 * its edges come apart into points of light as they pass, cross-fade to the page's own ribbons, and assemble the shell.
 */
export async function playHandoff(root: HTMLElement): Promise<void> {
  const veil = document.getElementById(VEIL_ID);
  if (!veil || veil.dataset.leaving !== undefined) return;
  discardHandoff();
  veil.dataset.leaving = '';
  const html = document.documentElement;
  arrivalWelcome.value = true;
  window.setTimeout(() => (arrivalWelcome.value = false), WELCOME_WAIT_MS);
  if (reducedMotion() || typeof veil.animate !== 'function') {
    if (typeof veil.animate !== 'function') veil.remove();
    else void veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => veil.remove(), () => veil.remove());
    return;
  }
  // The shell lays out under the veil first, so the target is where the band really is.
  await frames(2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const el = root.querySelector<HTMLElement>('#kex-main .kex-hero, #kex-main .kex-band') ?? root.querySelector<HTMLElement>('.kex-header');
  const r = el?.getBoundingClientRect();
  const to: Box = r && r.width > 40 && r.height > 20 && r.bottom > 0 && r.top < H
    ? { left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(W, r.right), bottom: Math.min(H, r.bottom) }
    : { left: 0, top: 0, right: W, bottom: Math.min(H, 64) };
  const round = el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0;
  const closed = `inset(${to.top}px ${W - to.right}px ${H - to.bottom}px ${to.left}px round ${round}px)`;
  html.dataset.kexArrive = '';
  const anim = veil.animate([
    { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1, easing: EASE_CSS },
    { clipPath: closed, opacity: 1, offset: CLOSE },
    { clipPath: closed, opacity: 0 },
  ], { duration: ARRIVE_MS, fill: 'forwards' });

  // Points of light where the ribbons are bright, born as the closing edges pass them, drifting away from where the picture goes.
  let sparks: SparkRun | null = null;
  const img = veil.dataset.img !== undefined && !effectsOff() ? await loadVeilImage(veil) : null;
  if (img) {
    const closeMs = ARRIVE_MS * CLOSE;
    // Light on a dark page; on a light one, light added to white would not show: flecks of the ribbons' own colour instead.
    const dark = html.dataset.kexTheme === 'dark';
    const cx = (to.left + to.right) / 2;
    const cy = (to.top + to.bottom) / 2;
    const list: Spark[] = [];
    for (const p of brightPoints(img, SPARKS)) {
      const x = p.u * W;
      const y = p.v * H;
      const k = exitAt(x, y, to, W, H);
      // Inside the band the page's own ribbons take over; a few still glint through the cross-fade.
      const inside = !Number.isFinite(k);
      if (inside && Math.random() > 0.12) continue;
      const delay = inside ? closeMs + Math.random() * (ARRIVE_MS - closeMs) : unease(Math.min(1, k)) * closeMs;
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const speed = inside ? 10 + Math.random() * 30 : 30 + Math.random() * 150;
      list.push({
        x, y, delay,
        vx: (dx / len) * speed + (Math.random() - 0.5) * 30,
        vy: (dy / len) * speed * 0.5 - 12 - Math.random() * 36,
        r: (dark ? 0.7 : 0.9) + Math.random() * 1.5,
        life: 480 + Math.random() * 720,
        rgb: dark ? p.rgb : p.ink,
      });
    }
    sparks = playSparks(list, { drag: 0.25, gravity: -14, blend: dark ? 'light' : 'ink' });
  }
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    anim.cancel();
    veil.remove();
    sparks?.stop();
    delete html.dataset.kexArrive;
    window.removeEventListener('pointerdown', finish, true);
    window.removeEventListener('keydown', finish, true);
    window.removeEventListener('wheel', finish, true);
  };
  // A click or a key ends it at once: the page under it is already usable.
  window.addEventListener('pointerdown', finish, true);
  window.addEventListener('keydown', finish, true);
  window.addEventListener('wheel', finish, { capture: true, passive: true });
  await anim.finished.catch(() => undefined);
  // The last points of light and the sidebar rows finish on their own; then the page is plain.
  await Promise.race([sparks?.done ?? Promise.resolve(), new Promise((res) => window.setTimeout(res, 1400))]);
  finish();
}

function loadVeilImage(veil: HTMLElement): Promise<HTMLImageElement | null> {
  const url = /url\("(.+)"\)/.exec(veil.style.backgroundImage)?.[1];
  if (!url) return Promise.resolve(null);
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img, () => null);
}
