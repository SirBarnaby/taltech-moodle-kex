import { RibbonsRenderer } from './ribbons';
import { DEBUG } from '../lib/log';

/**
 * Video thumbnails: one offscreen 268x184 render per seed (the cmid), kept as a data URL in memory only.
 * A single shared canvas is created on demand and released after 5 s of idle (architecture §14).
 */
const cache = new Map<number, string>();
const pending = new Map<number, Promise<string | undefined>>();
let canvas: HTMLCanvasElement | null = null;
let renderer: RibbonsRenderer | null = null;
let idle: number | undefined;
let queue: Promise<unknown> = Promise.resolve();

function note(ms: number): void {
  // Debug builds only: spans where software GL does its work inside our call, so the perf test can attribute the long task (see m6.spec.ts).
  const w = window as unknown as { __kexShaderCompileMs?: number[] };
  (w.__kexShaderCompileMs ??= []).push(ms);
}

function release(): void {
  const t = DEBUG ? performance.now() : 0;
  renderer?.dispose();
  if (DEBUG) note(performance.now() - t);
  renderer = null;
  canvas = null;
}

export function videoThumb(seed: number): Promise<string | undefined> {
  const hit = cache.get(seed);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(seed);
  if (inflight) return inflight;
  const job = queue.then(async () => {
    // One thumbnail per task: back-to-back promise jobs would otherwise run as a single long task and block input.
    await new Promise<void>((r) => window.setTimeout(r, 0));
    window.clearTimeout(idle);
    try {
      if (!canvas) {
        const tc = DEBUG ? performance.now() : 0;
        canvas = document.createElement('canvas');
        canvas.width = 268;
        canvas.height = 184;
        // A flipped window of the hero's right edge (x0 > x1 mirrors it): a magenta curve rising to the right over dark strands.
        renderer = new RibbonsRenderer(canvas, { seed, intensity: 0.8, leftFade: 0, window: [1339, -18, 1139, 119] });
        if (DEBUG) note(performance.now() - tc);
      }
      if (!renderer?.ok || !(await renderer.ready())) return undefined;
      // Different seeds sample different moments of the animation.
      const t0 = DEBUG ? performance.now() : 0;
      renderer.renderStatic(7.3 + (seed % 9) * 0.9);
      const url = canvas.toDataURL('image/webp', 0.8);
      if (DEBUG) note(performance.now() - t0); // the read-back is where software GL finally compiles and runs the shader
      cache.set(seed, url);
      return url;
    } catch {
      return undefined;
    } finally {
      idle = window.setTimeout(release, 5000);
      pending.delete(seed);
    }
  });
  queue = job;
  pending.set(seed, job);
  return job;
}
