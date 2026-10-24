import { effects, type EffectHandle } from './effects';
import type { RibbonsOptions } from './ribbons';
import { heroEffectMode } from '../state/effects';
import { motionTier } from './motion';

/** Cross-fade from one course's ribbons to the next (milliseconds). */
const BLEND_MS = 320;

/**
 * One ribbons canvas for every hero and the login art. Each new WebGL context compiles the shader again (about a second on a real
 * GPU), which showed as the shader popping in after the text on every course switch. The canvas is created once, as early as boot,
 * and moved into whichever hero is on screen; its compiled program and the first drawn frame travel with it.
 */
let canvas: HTMLCanvasElement | null = null;
let handle: EffectHandle | null = null;
let last: RibbonsOptions | null = null;

const sameLook = (a: RibbonsOptions | null, b: RibbonsOptions): boolean =>
  !!a && a.seed === b.seed && a.style === b.style && a.intensity === b.intensity && a.leftFade === b.leftFade;

function ensure(opts: RibbonsOptions): { canvas: HTMLCanvasElement; handle: EffectHandle } {
  if (!canvas || !handle) {
    canvas = document.createElement('canvas');
    canvas.className = 'kex-hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    handle = effects.register(canvas, opts, (m) => (heroEffectMode.value = m));
  }
  return { canvas, handle };
}

export const heroCanvas = {
  /** Start compiling now, with the default look; the hero that mounts sets its own seed and palette. */
  warm(): void {
    ensure({ seed: 0, intensity: 1, leftFade: 0.46 });
  },
  /** Put the canvas into `host` (first child) with this look. Returns the function that takes it out again. */
  attach(host: HTMLElement, opts: RibbonsOptions): () => void {
    const { canvas: c, handle: h } = ensure(opts);
    // A new look (another course, another school palette): the old frame is laid over the new one and fades out, so the
    // ribbons morph instead of jumping. Reduced motion just switches.
    const snap = !sameLook(last, opts) && motionTier() === 'full' ? h.snapshot() : null;
    last = opts;
    h.update(opts);
    host.prepend(c);
    let fade: Animation | undefined;
    if (snap && typeof snap.animate === 'function') {
      snap.className = 'kex-hero__canvas kex-hero__snap';
      snap.setAttribute('aria-hidden', 'true');
      snap.dataset.drawn = '1';
      c.after(snap);
      fade = snap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BLEND_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
      void fade.finished.then(() => snap.remove(), () => snap.remove());
    }
    return () => {
      fade?.cancel();
      snap?.remove();
      if (c.parentElement === host) c.remove();
    };
  },
  setPointer(x: number, y: number): void {
    handle?.setPointer(x, y);
  },
};
