/**
 * Points of light (round 8): achievements burst with them. Canvas 2D with
 * additive blending on one full-window overlay that ignores the pointer; no shader to compile, so it draws on the first frame.
 */

export interface Spark {
  x: number;
  y: number;
  /** Pixels per second. */
  vx: number;
  vy: number;
  /** Radius in CSS pixels. */
  r: number;
  /** Milliseconds from the start of the run before the spark appears, and how long it lives after that. */
  delay: number;
  life: number;
  /** "r,g,b" (0..255). */
  rgb: string;
}

export interface SparkRun {
  /** Stop now and remove the overlay. */
  stop(): void;
  done: Promise<void>;
}

export interface SparkOptions {
  /** Velocity kept per second (0..1); 0.25 slows a spark to a quarter in a second. */
  drag?: number;
  /** Downward pull, px/s². */
  gravity?: number;
  /** Stacking order of the overlay. */
  z?: number;
  /** 'light' adds the sparks up with a soft halo (on dark pages); 'ink' paints them as they are (on light pages, where light
   *  added to white does not show). */
  blend?: 'light' | 'ink';
}

/** Draw `sparks` until the last one has faded, then remove the overlay. */
export function playSparks(sparks: Spark[], opts: SparkOptions = {}): SparkRun {
  const canvas = document.createElement('canvas');
  canvas.className = 'kex-sparks';
  canvas.setAttribute('aria-hidden', 'true');
  if (opts.z !== undefined) canvas.style.zIndex = String(opts.z);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  document.documentElement.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let finish: () => void = () => undefined;
  const done = new Promise<void>((res) => (finish = res));
  const stop = (): void => {
    cancelAnimationFrame(raf);
    canvas.remove();
    finish();
  };
  if (!ctx || !sparks.length) {
    stop();
    return { stop, done };
  }
  const end = Math.max(...sparks.map((s) => s.delay + s.life));
  const drag = opts.drag ?? 0.3;
  const gravity = opts.gravity ?? 0;
  const light = opts.blend !== 'ink';
  let start = 0;
  let last = 0;
  const frame = (now: number): void => {
    if (!start) start = last = now;
    const t = now - start;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = light ? 'lighter' : 'source-over';
    const keep = drag ** dt;
    for (const s of sparks) {
      const age = t - s.delay;
      if (age < 0 || age > s.life) continue;
      s.vx *= keep;
      s.vy = s.vy * keep + gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = age / s.life;
      // In fast, out slow: a spark flares and then fades over most of its life.
      const a = Math.min(1, age / 90) * (1 - k) ** 1.6;
      if (a <= 0.01) continue;
      const r = s.r * (1 - 0.4 * k);
      if (light) {
        // The glow around the point: what makes it read as light rather than a dot.
        ctx.fillStyle = `rgba(${s.rgb},${(a * 0.16).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${s.rgb},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t < end) raf = requestAnimationFrame(frame);
    else stop();
  };
  raf = requestAnimationFrame(frame);
  return { stop, done };
}
