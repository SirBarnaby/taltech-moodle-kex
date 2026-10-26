/**
 * Points of light (round 8): the sign-in hand-off sheds them from the ribbons, achievements burst with them. Canvas 2D with
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

export interface BrightPoint {
  u: number;
  v: number;
  /** The colour brightened toward white (a point of light). */
  rgb: string;
  /** The colour as it is, deepened a little (a fleck that shows on white). */
  ink: string;
}

/** Up to `n` bright points of an image, as fractions of its size with their colour, brightest most often. */
export function brightPoints(img: CanvasImageSource, n: number, threshold = 0.5): BrightPoint[] {
  const w = 192;
  const h = 108;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  try {
    ctx.drawImage(img, 0, 0, w, h);
  } catch {
    return [];
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  const pool: (BrightPoint & { weight: number })[] = [];
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (luma < threshold) continue;
      const weight = luma * luma;
      total += weight;
      // Brightened toward white: a point of light, not a pixel.
      const lift = (v: number): number => Math.round(v + (255 - v) * 0.35);
      const deep = (v: number): number => Math.round(v * 0.82);
      pool.push({ u: (x + Math.random()) / w, v: (y + Math.random()) / h, rgb: `${lift(r)},${lift(g)},${lift(b)}`, ink: `${deep(r)},${deep(g)},${deep(b)}`, weight });
    }
  }
  if (!pool.length) return [];
  const cumulative: number[] = [];
  let run = 0;
  for (const q of pool) cumulative.push((run += q.weight));
  const out: BrightPoint[] = [];
  for (let k = 0; k < n; k++) {
    const pick = Math.random() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cumulative[mid] ?? 0) < pick) lo = mid + 1;
      else hi = mid;
    }
    const p = pool[lo]!;
    out.push({ u: p.u, v: p.v, rgb: p.rgb, ink: p.ink });
  }
  return out;
}
