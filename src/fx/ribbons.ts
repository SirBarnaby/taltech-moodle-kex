import FRAG from './ribbons.glsl';
import { DEBUG } from '../lib/log';
import { DEFAULT_RIBBONS, type RibbonStyle } from '../lib/school';
import { MOTION } from './motion';

/** WebGL2 ribbons renderer (architecture §14, design-spec §9). One full-screen triangle, all work in the fragment shader. */

const VERT = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

export interface RibbonsOptions {
  /** Offsets the animation phase so each instance looks different (thumbnails use the cmid). */
  seed?: number;
  /** 1 hero, .4 page band, 1.15 login. */
  intensity?: number;
  /** Where the ribbons start (fraction of the width). .46 hero, 0 login. */
  leftFade?: number;
  /** Part of the 1339x253 reference frame the canvas shows: [x0, y0, x1, y1]. Default: all of it. */
  window?: [number, number, number, number];
  /** School theme: palette, shape and seed offset. Default: the iteration3 look. */
  style?: RibbonStyle;
  /** Called when the context is lost or cannot be created, so the caller can show the CSS fallback. */
  onFallback?: (reason: 'unsupported' | 'lost') => void;
  /** Called once the shader program is compiled and linked (asynchronously after construction). */
  onReady?: () => void;
  /** The shared runtime defers driver work while navigation or scrolling owns the frame. */
  canWork?: () => boolean;
}

export function webgl2Supported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export class RibbonsRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private running = false;
  private tFrozen = 7.3;
  private pointer: [number, number] = [0, 0];
  private pointerTarget: [number, number] = [0, 0];
  private scale = 1;
  private frameTimes: number[] = [];
  private drawTimes: number[] = [];
  private lastDrawMs = 0;
  private drawn = 0;
  private last = 0;
  private lost = false;
  private disposed = false;
  private pendingTimer = 0;
  private idleCallback = 0;
  private generation = 0;
  private waiters: Array<(ok: boolean) => void> = [];
  /** True from linkProgram until the driver has finished: nothing can be drawn yet. */
  private pending = false;
  /** Called with `'static'` when adaptive quality gives up. */
  public onGiveUp?: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: RibbonsOptions = {},
  ) {
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.init();
  }

  get ok(): boolean {
    return !!this.gl && !this.lost && !this.disposed;
  }

  /** Resolves true once the program is linked (false when it could not be, or the context was lost). */
  ready(): Promise<boolean> {
    if (!this.gl || this.lost) return Promise.resolve(false);
    if (!this.pending) return Promise.resolve(true);
    return new Promise((res) => this.waiters.push(res));
  }

  private settle(ok: boolean): void {
    this.waiters.splice(0).forEach((r) => r(ok));
  }

  /** The program is still compiling: the caller shows its fallback until `onReady`. */
  get isPending(): boolean {
    return this.pending;
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
    this.pending = false;
    this.cancelPending();
    this.settle(false);
    this.stop();
    this.opts.onFallback?.('lost');
  };

  private onRestored = (): void => {
    if (this.disposed) return;
    this.lost = false;
    this.gl = null;
    this.prog = null;
    this.loc = {};
    this.pending = true;
    const restore = (): void => {
      this.pendingTimer = 0;
      if (this.disposed || this.lost) return;
      if (this.opts.canWork && !this.opts.canWork()) {
        this.pendingTimer = window.setTimeout(restore, MOTION.effectsIdleDelay);
        return;
      }
      this.init();
    };
    this.pendingTimer = window.setTimeout(restore, MOTION.effectsIdleDelay);
  };

  private cancelPending(): void {
    this.generation++;
    clearTimeout(this.pendingTimer);
    this.pendingTimer = 0;
    if (this.idleCallback && typeof cancelIdleCallback === 'function') cancelIdleCallback(this.idleCallback);
    this.idleCallback = 0;
  }

  private init(): void {
    if (this.disposed || this.lost) return;
    const generation = ++this.generation;
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) {
      this.pending = false;
      this.settle(false);
      this.opts.onFallback?.('unsupported');
      return;
    }
    // Compile and link without asking for the result: reading COMPILE_STATUS / LINK_STATUS blocks the main thread until the driver is done
    // (seconds on software GL). With KHR_parallel_shader_compile the page stays responsive and the hero shows its CSS fallback meanwhile.
    const compile = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (prog) gl.deleteProgram(prog);
      this.pending = false;
      this.settle(false);
      this.opts.onFallback?.('unsupported');
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    this.gl = gl;
    this.prog = prog;
    this.pending = true;
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const finish = (): void => {
      this.pendingTimer = 0;
      this.idleCallback = 0;
      if (this.disposed || this.lost || generation !== this.generation) return;
      if (this.opts.canWork && !this.opts.canWork()) {
        this.pendingTimer = window.setTimeout(finish, MOTION.effectsIdleDelay);
        return;
      }
      if (ext && !gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR)) {
        this.pendingTimer = window.setTimeout(finish, 16);
        return;
      }
      const tLink = DEBUG ? performance.now() : 0;
      const linked = gl.getProgramParameter(prog, gl.LINK_STATUS);
      if (DEBUG) {
        // The blocking part when the driver has no parallel compile (software GL): lets the perf test attribute the long task.
        const w = window as unknown as { __kexShaderCompileMs?: number[] };
        (w.__kexShaderCompileMs ??= []).push(performance.now() - tLink);
      }
      if (!linked) {
        console.warn('[KEX] shader link failed', gl.getShaderInfoLog(fs), gl.getProgramInfoLog(prog));
        this.pending = false;
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(prog);
        this.gl = null;
        this.prog = null;
        this.settle(false);
        this.opts.onFallback?.('unsupported');
        return;
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.useProgram(prog);
      for (const n of ['uRes', 'uTime', 'uPointer', 'uIntensity', 'uLeftFade', 'uSeed', 'uWin', 'uBody', 'uAccent', 'uHi', 'uShape', 'uSharp']) this.loc[n] = gl.getUniformLocation(prog, n);
      this.pending = false;
      this.resize();
      this.settle(true);
      this.opts.onReady?.();
    };
    // Without the extension the blocking read happens after the first paint instead of inside the caller's task.
    if (ext) this.pendingTimer = window.setTimeout(finish, 0);
    else if (typeof requestIdleCallback === 'function') this.idleCallback = requestIdleCallback(finish, { timeout: 1500 });
    else this.pendingTimer = window.setTimeout(finish, MOTION.effectsIdleDelay);
  }

  /** Match the canvas backing store to its CSS size (DPR capped at 2, times the adaptive scale). */
  resize(): void {
    const gl = this.gl;
    if (!gl || this.lost || this.disposed) return;
    // An offscreen canvas (video thumbnails) keeps the size it was given.
    const attached = this.canvas.isConnected;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scale;
    const w = attached ? Math.max(1, Math.round(this.canvas.clientWidth * dpr)) : this.canvas.width;
    const h = attached ? Math.max(1, Math.round(this.canvas.clientHeight * dpr)) : this.canvas.height;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  /** Change seed, style, intensity or fade without rebuilding the context: a canvas moved to another hero keeps its compiled shader. */
  setOptions(o: Pick<RibbonsOptions, 'seed' | 'intensity' | 'leftFade' | 'style' | 'window'>): void {
    Object.assign(this.opts, o);
    if (!this.running && !this.pending && this.gl && this.canvas.dataset.drawn) this.draw(this.tFrozen);
  }

  /**
   * The frame on screen as a 2D canvas (drawn again first: a WebGL buffer is only readable in the task that drew it), so the
   * caller can lay it over the next look and fade it out. Null before the first frame or without a context.
   */
  snapshot(): HTMLCanvasElement | null {
    if (!this.gl || this.lost || this.pending || !this.canvas.dataset.drawn || this.canvas.width < 2) return null;
    this.draw(this.tFrozen);
    const snap = document.createElement('canvas');
    snap.width = this.canvas.width;
    snap.height = this.canvas.height;
    const ctx = snap.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(this.canvas, 0, 0);
    } catch {
      return null;
    }
    return snap;
  }

  setPointer(x: number, y: number): void {
    this.pointerTarget = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  }

  private draw(time: number): boolean {
    const gl = this.gl;
    if (!gl || this.lost || this.pending || this.disposed) return false;
    if (this.canvas.isConnected && (!this.canvas.clientWidth || !this.canvas.clientHeight)) return false;
    const started = performance.now();
    this.resize();
    gl.uniform2f(this.loc.uRes ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.loc.uTime ?? null, time);
    gl.uniform2f(this.loc.uPointer ?? null, this.pointer[0], this.pointer[1]);
    gl.uniform1f(this.loc.uIntensity ?? null, this.opts.intensity ?? 1);
    gl.uniform1f(this.loc.uLeftFade ?? null, this.opts.leftFade ?? 0.46);
    const st = this.opts.style ?? DEFAULT_RIBBONS;
    gl.uniform1f(this.loc.uSeed ?? null, ((this.opts.seed ?? 0) + st.seed) * 0.37);
    gl.uniform3f(this.loc.uBody ?? null, st.body[0], st.body[1], st.body[2]);
    gl.uniform3f(this.loc.uAccent ?? null, st.accent[0], st.accent[1], st.accent[2]);
    gl.uniform3f(this.loc.uHi ?? null, st.hi[0], st.hi[1], st.hi[2]);
    gl.uniform4f(this.loc.uShape ?? null, st.shape[0], st.shape[1], st.shape[2], st.shape[3]);
    gl.uniform1f(this.loc.uSharp ?? null, st.sharp);
    const w = this.opts.window ?? [0, 0, 1339, 253];
    gl.uniform4f(this.loc.uWin ?? null, w[0], w[1], w[2], w[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.lastDrawMs = performance.now() - started;
    if (DEBUG) {
      // CPU submission time only: gl.finish() would stall interaction frames while measuring them.
      const w = window as unknown as { __kexShaderCompileMs?: number[]; __kexShaderMs?: number[] };
      if (this.drawn === 0) (w.__kexShaderCompileMs ??= []).push(this.lastDrawMs);
      else if (this.drawn % 5 === 0) (w.__kexShaderMs ??= []).push(this.lastDrawMs);
    }
    // The first real frame: CSS fades the canvas in from this point instead of showing it half-ready.
    if (!this.canvas.dataset.drawn && this.canvas.isConnected && this.canvas.clientWidth > 1) this.canvas.dataset.drawn = '1';
    this.drawn++;
    return true;
  }

  /** One frame at a fixed time (reduced motion, effects "static", tests). */
  renderStatic(t: number): boolean {
    if (!this.draw(t)) return false;
    this.tFrozen = t;
    return true;
  }

  /** Managed renderers use the controller's single frame pump; standalone callers keep the same API. */
  start(managed = false): void {
    if (this.running || !this.gl || this.lost || this.pending) return;
    this.running = true;
    this.last = 0;
    this.frameTimes = [];
    this.drawTimes = [];
    if (managed) return;
    const tick = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      if (this.last && now - this.last < MOTION.effectsFrameInterval - 1) return;
      this.frame(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Advance only by time actually spent running. Resuming never catches up paused wall time. */
  frame(now: number): boolean {
    if (!this.running || this.disposed || (this.opts.canWork && !this.opts.canWork())) return false;
    const elapsed = this.last ? Math.max(0, now - this.last) : 0;
    this.last = now;
    const delta = Math.min(elapsed, MOTION.effectsMaxDelta);
    const blend = 1 - Math.exp(-delta / 180);
    this.pointer[0] += (this.pointerTarget[0] - this.pointer[0]) * blend;
    this.pointer[1] += (this.pointerTarget[1] - this.pointer[1]) * blend;
    const time = this.tFrozen + delta / 1000;
    if (!this.draw(time)) return false;
    this.tFrozen = time;
    this.adapt(elapsed);
    return true;
  }

  /** Slow submission or sustained missed 30 Hz frames lowers resolution, then freezes. */
  private adapt(elapsed: number): void {
    if (elapsed) this.frameTimes.push(elapsed);
    this.drawTimes.push(this.lastDrawMs);
    if (this.frameTimes.length < 60) return;
    const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
    const slow = median(this.frameTimes) > MOTION.effectsFrameInterval * 1.8 || median(this.drawTimes) > MOTION.effectsFrameBudget;
    this.frameTimes = [];
    this.drawTimes = [];
    if (!slow) return;
    if (this.scale > 0.7) {
      this.scale = 0.66;
      this.resize();
    } else {
      this.stop();
      this.onGiveUp?.();
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get time(): number {
    return this.tFrozen;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPending();
    this.settle(false);
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    const gl = this.gl;
    if (gl) {
      if (this.prog) gl.deleteProgram(this.prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
    this.prog = null;
  }
}
