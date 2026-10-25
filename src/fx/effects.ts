import type { EffectsSetting } from '../lib/settings';
import { MOTION } from './motion';
import { RibbonsRenderer, type RibbonsOptions } from './ribbons';

/** The public visual mode remains small; the canvas exposes its detailed lifecycle separately. */
export type EffectMode = 'live' | 'static' | 'fallback';
export type EffectState = 'deferred' | 'compiling' | 'painted' | 'live' | 'paused' | 'static' | 'fallback';

export interface EffectsConfig {
  effects: EffectsSetting;
  motion: 'reduced' | 'full';
  freezeTime?: number;
}

interface Entry {
  canvas: HTMLCanvasElement;
  opts: RibbonsOptions;
  onMode: (m: EffectMode) => void;
  renderer: RibbonsRenderer | null;
  visible: boolean;
  disposed: boolean;
  unavailable: boolean;
  adaptiveStatic: boolean;
  painted: boolean;
  dirty: boolean;
  state: EffectState;
  mode: EffectMode | null;
  cancelIdle?: () => void;
  io?: IntersectionObserver;
  ro?: ResizeObserver;
}

export interface EffectHandle {
  dispose(): void;
  setPointer(x: number, y: number): void;
}

/** One owner for context creation, readiness, visibility and the 30 Hz drawing budget. */
export class EffectsController {
  private entries = new Set<Entry>();
  private cfg: EffectsConfig = { effects: 'animated', motion: 'full' };
  private listening = false;
  private busy = false;
  private raf = 0;
  private lastFrame = 0;
  private cursor = 0;
  private paints = 0;
  private frames = 0;
  private overBudgetFrames = 0;
  private lastFrameMs = 0;
  private maxFrameMs = 0;

  configure(cfg: EffectsConfig): void {
    const changed = cfg.freezeTime !== this.cfg.freezeTime || cfg.effects !== this.cfg.effects || cfg.motion !== this.cfg.motion;
    this.cfg = cfg;
    if (changed) this.entries.forEach((entry) => { entry.dirty = true; });
    this.reconcile();
  }

  get liveCount(): number {
    return [...this.entries].filter((e) => e.renderer?.isRunning).length;
  }

  /** Local inspection only: no URLs, course names, identifiers or stored telemetry. */
  diagnostics(): Record<string, number | boolean> {
    return {
      entries: this.entries.size, contexts: [...this.entries].filter((e) => e.renderer?.ok).length,
      compiling: [...this.entries].filter((e) => e.state === 'compiling').length,
      live: this.liveCount, paused: [...this.entries].filter((e) => e.state === 'paused').length,
      busy: this.busy, paints: this.paints, frames: this.frames,
      overBudgetFrames: this.overBudgetFrames, lastFrameMs: this.lastFrameMs, maxFrameMs: this.maxFrameMs,
    };
  }

  register(canvas: HTMLCanvasElement, opts: RibbonsOptions, onMode: (m: EffectMode) => void): EffectHandle {
    const entry: Entry = {
      canvas, opts, onMode, renderer: null, visible: true, disposed: false, unavailable: false,
      adaptiveStatic: false, painted: false, dirty: true, state: 'deferred', mode: null,
    };
    this.entries.add(entry);
    this.listen();
    if (typeof IntersectionObserver !== 'undefined') {
      entry.io = new IntersectionObserver((list) => {
        if (entry.disposed) return;
        entry.visible = list.some((i) => i.isIntersecting);
        this.reconcile();
      }, { threshold: 0 });
      entry.io.observe(canvas);
    }
    if (typeof ResizeObserver !== 'undefined') {
      entry.ro = new ResizeObserver(() => {
        if (entry.disposed) return;
        // Resizing clears a canvas. Keep its backing store during an interaction,
        // then resize and repaint together before revealing the new dimensions.
        entry.dirty = true;
        this.reconcile();
      });
      entry.ro.observe(canvas);
    }
    this.reconcile();
    return {
      dispose: () => {
        if (entry.disposed) return;
        entry.disposed = true;
        entry.cancelIdle?.();
        entry.io?.disconnect();
        entry.ro?.disconnect();
        entry.renderer?.dispose();
        this.entries.delete(entry);
        this.reconcile();
        if (!this.entries.size) this.unlisten();
      },
      setPointer: (x, y) => { if (!entry.disposed) entry.renderer?.setPointer(x, y); },
    };
  }

  private onVisibility = (): void => { this.reconcile(); };
  private onInteraction = (event: Event): void => {
    const detail = (event as CustomEvent<{ busy?: boolean }>).detail;
    if (typeof detail?.busy !== 'boolean') return;
    this.busy = detail.busy;
    this.reconcile();
  };

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    // The transaction owner publishes its current state for canvases mounted mid-navigation.
    this.busy = document.documentElement.dataset.kexInteraction === 'busy';
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('kex:interaction', this.onInteraction);
  }

  private unlisten(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('kex:interaction', this.onInteraction);
    this.listening = false;
    this.busy = false;
  }

  private mark(entry: Entry, state: EffectState): void {
    entry.state = state;
    entry.canvas.dataset.fxState = state;
    // Preserve the existing selector/test contract.
    entry.canvas.dataset.fx = state === 'live' ? 'running'
      : state === 'compiling' || state === 'deferred' ? 'fallback'
        : state === 'painted' ? 'static' : state;
  }

  private mode(entry: Entry, mode: EffectMode): void {
    if (entry.disposed || entry.mode === mode) return;
    entry.mode = mode;
    entry.onMode(mode);
  }

  private scheduleInit(entry: Entry): void {
    if (entry.cancelIdle || entry.renderer || entry.unavailable) return;
    this.mark(entry, 'deferred');
    const initialize = (): void => {
      entry.cancelIdle = undefined;
      if (entry.disposed || this.busy || document.hidden || !entry.visible || this.cfg.effects === 'off') return;
      this.mark(entry, 'compiling');
      // Callbacks can arrive after settings changed or the owning view was removed.
      const current = (): boolean => !entry.disposed && entry.renderer === renderer;
      const renderer: RibbonsRenderer = new RibbonsRenderer(entry.canvas, {
        ...entry.opts,
        canWork: () => !entry.disposed && !this.busy && !document.hidden && entry.visible && this.cfg.effects !== 'off',
        onFallback: (reason) => queueMicrotask(() => {
          if (!current()) return;
          entry.painted = false;
          entry.unavailable = reason === 'unsupported';
          this.reconcile();
        }),
        onReady: () => queueMicrotask(() => {
          if (!current()) return;
          entry.unavailable = false;
          entry.dirty = true;
          this.reconcile();
        }),
      });
      entry.renderer = renderer;
      renderer.onGiveUp = () => {
        if (!current()) return;
        entry.adaptiveStatic = true;
        entry.dirty = true;
        this.reconcile();
      };
      if (!renderer.ok) entry.unavailable = true;
      this.reconcile();
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(initialize, { timeout: 1000 });
      entry.cancelIdle = () => cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(initialize, MOTION.effectsIdleDelay);
      entry.cancelIdle = () => clearTimeout(id);
    }
  }

  private reconcile(): void {
    const eligible: Entry[] = [];
    for (const entry of this.entries) {
      const renderer = entry.renderer;
      if (this.cfg.effects === 'off') {
        entry.cancelIdle?.();
        entry.cancelIdle = undefined;
        // Retain the canvas context and phase for re-enable. Disposal deliberately
        // loses the context and is reserved for unmount; off performs no GL work.
        renderer?.stop();
        this.mark(entry, 'fallback');
        this.mode(entry, 'fallback');
        continue;
      }
      if (!renderer) {
        this.mode(entry, 'fallback');
        if (!this.busy && !document.hidden && entry.visible) this.scheduleInit(entry);
        else this.mark(entry, 'deferred');
        continue;
      }
      if (!renderer.ok || entry.unavailable) {
        renderer.stop();
        this.mark(entry, 'fallback');
        this.mode(entry, 'fallback');
        continue;
      }
      if (renderer.isPending) {
        renderer.stop();
        this.mark(entry, 'compiling');
        this.mode(entry, 'fallback');
        continue;
      }
      if (this.busy || document.hidden || !entry.visible) {
        renderer.stop();
        this.mark(entry, entry.painted ? 'paused' : 'deferred');
        this.mode(entry, entry.painted ? 'static' : 'fallback');
        continue;
      }
      if (!entry.painted || entry.dirty) {
        renderer.resize();
        if (!renderer.renderStatic(this.cfg.freezeTime ?? renderer.time)) continue;
        entry.painted = true;
        entry.dirty = false;
        this.paints++;
        this.mark(entry, 'painted');
      }
      if (entry.adaptiveStatic || this.cfg.effects === 'static' || this.cfg.motion === 'reduced' || this.cfg.freezeTime !== undefined) {
        renderer.stop();
        this.mark(entry, 'static');
        this.mode(entry, 'static');
      } else eligible.push(entry);
    }
    // Keep current slots stable and fill vacancies after every lifecycle change.
    eligible.sort((a, b) => Number(!!b.renderer?.isRunning) - Number(!!a.renderer?.isRunning));
    eligible.forEach((entry, i) => {
      if (i < MOTION.effectsMaxLive) {
        entry.renderer!.start(true);
        this.mark(entry, 'live');
        this.mode(entry, 'live');
      } else {
        entry.renderer!.stop();
        this.mark(entry, 'paused');
        this.mode(entry, 'static');
      }
    });
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (!this.liveCount || this.busy || document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastFrame = 0;
    } else if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.busy || document.hidden || !this.liveCount) return;
    if (this.lastFrame && now - this.lastFrame < MOTION.effectsFrameInterval - 1) {
      this.scheduleFrame();
      return;
    }
    this.lastFrame = now;
    const live = [...this.entries].filter((e) => e.renderer?.isRunning);
    const start = performance.now();
    const offset = this.cursor++ % live.length;
    for (let i = 0; i < live.length; i++) {
      const entry = live[(offset + i) % live.length]!;
      if (entry.renderer?.frame(now)) this.paints++;
      // A draw cannot be pre-empted. Alternate the first slot so a slow canvas
      // cannot starve the other canvas when the shared budget is consumed.
      if (performance.now() - start >= MOTION.effectsFrameBudget) break;
    }
    this.lastFrameMs = performance.now() - start;
    this.maxFrameMs = Math.max(this.maxFrameMs, this.lastFrameMs);
    this.frames++;
    if (this.lastFrameMs > MOTION.effectsFrameBudget) this.overBudgetFrames++;
    this.scheduleFrame();
  };
}

export const effects = new EffectsController();
