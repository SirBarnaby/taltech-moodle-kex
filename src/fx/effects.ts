import type { EffectsSetting } from '../lib/settings';
import { RibbonsRenderer, type RibbonsOptions } from './ribbons';

/** Decides what every ribbons canvas does (architecture §14). A singleton, driven by settings + page visibility. */

export type EffectMode = 'live' | 'static' | 'fallback';

export interface EffectsConfig {
  effects: EffectsSetting;
  motion: 'reduced' | 'full';
  /** Render a single frame at this time (tests, visual diff). */
  freezeTime?: number;
}

export const STATIC_TIME = 7.3;
const MAX_LIVE = 2;

interface Entry {
  renderer: RibbonsRenderer | null;
  canvas: HTMLCanvasElement;
  visible: boolean;
  forcedFallback: boolean;
  onMode: (m: EffectMode) => void;
  mode: EffectMode | null;
  io?: IntersectionObserver;
  ro?: ResizeObserver;
}

export interface EffectHandle {
  dispose(): void;
  setPointer(x: number, y: number): void;
  /** New seed, style, intensity or fade for the same canvas. */
  update(opts: RibbonsOptions): void;
  /** The current frame as a 2D canvas, for a cross-fade to the next look. */
  snapshot(): HTMLCanvasElement | null;
}

class EffectsController {
  private entries = new Set<Entry>();
  private cfg: EffectsConfig = { effects: 'animated', motion: 'full' };
  private listening = false;

  configure(cfg: EffectsConfig): void {
    this.cfg = cfg;
    this.entries.forEach((e) => this.evaluate(e));
  }

  get liveCount(): number {
    let n = 0;
    this.entries.forEach((e) => e.renderer?.isRunning && n++);
    return n;
  }

  register(canvas: HTMLCanvasElement, opts: RibbonsOptions, onMode: (m: EffectMode) => void): EffectHandle {
    const entry: Entry = { renderer: null, canvas, visible: true, forcedFallback: false, onMode, mode: null };
    const renderer = new RibbonsRenderer(canvas, {
      ...opts,
      onFallback: () => {
        entry.forcedFallback = true;
        this.evaluate(entry);
      },
      onReady: () => this.evaluate(entry),
    });
    renderer.onGiveUp = () => {
      entry.forcedFallback = false;
      this.mark(entry, 'static');
      this.setMode(entry, 'static');
      renderer.renderStatic(renderer.time);
    };
    entry.renderer = renderer.ok ? renderer : null;
    if (!renderer.ok) entry.forcedFallback = true;
    if (typeof IntersectionObserver !== 'undefined') {
      entry.io = new IntersectionObserver((list) => {
        entry.visible = list.some((i) => i.isIntersecting);
        this.evaluate(entry);
      }, { threshold: 0 });
      entry.io.observe(canvas);
    }
    if (typeof ResizeObserver !== 'undefined') {
      entry.ro = new ResizeObserver(() => {
        entry.renderer?.resize();
        if (entry.mode === 'static') entry.renderer?.renderStatic(this.staticTime());
      });
      entry.ro.observe(canvas);
    }
    this.entries.add(entry);
    this.listen();
    this.evaluate(entry);
    return {
      dispose: () => {
        entry.io?.disconnect();
        entry.ro?.disconnect();
        entry.renderer?.dispose();
        this.entries.delete(entry);
      },
      setPointer: (x, y) => entry.renderer?.setPointer(x, y),
      update: (o) => entry.renderer?.setOptions(o),
      snapshot: () => (entry.mode === 'fallback' ? null : entry.renderer?.snapshot() ?? null),
    };
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    document.addEventListener('visibilitychange', () => this.entries.forEach((e) => this.evaluate(e)));
  }

  private staticTime(): number {
    return this.cfg.freezeTime ?? STATIC_TIME;
  }

  private setMode(e: Entry, m: EffectMode): void {
    if (e.mode === m) return;
    e.mode = m;
    e.onMode(m);
  }

  /** `data-fx` on the canvas: running | paused | static | fallback (read by the e2e tests). */
  private mark(e: Entry, state: 'running' | 'paused' | 'static' | 'fallback'): void {
    e.canvas.dataset.fx = state;
  }

  private evaluate(e: Entry): void {
    const r = e.renderer;
    if (!r || e.forcedFallback || this.cfg.effects === 'off') {
      r?.stop();
      this.mark(e, 'fallback');
      this.setMode(e, 'fallback');
      return;
    }
    if (r.isPending) {
      // Still compiling: keep the CSS fallback showing; `onReady` runs this again.
      r.stop();
      this.mark(e, 'fallback');
      this.setMode(e, 'fallback');
      return;
    }
    if (this.cfg.freezeTime !== undefined || this.cfg.effects === 'static' || this.cfg.motion === 'reduced') {
      r.stop();
      this.mark(e, 'static');
      this.setMode(e, 'static');
      r.renderStatic(this.staticTime());
      return;
    }
    if (e.mode !== 'live') this.setMode(e, 'live');
    if (e.visible && !document.hidden && this.liveCount < MAX_LIVE + (r.isRunning ? 1 : 0)) {
      r.start();
      this.mark(e, 'running');
    } else {
      r.stop();
      this.mark(e, 'paused');
    }
  }
}

export const effects = new EffectsController();
