import FRAG from './ribbons.glsl';

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
  /** Called when the context is lost or cannot be created, so the caller can show the CSS fallback. */
  onFallback?: (reason: 'unsupported' | 'lost') => void;
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
  private t0 = 0;
  private tFrozen = 0;
  private skip = false;
  private pointer: [number, number] = [0, 0];
  private pointerTarget: [number, number] = [0, 0];
  private scale = 1;
  private frameTimes: number[] = [];
  private last = 0;
  private lost = false;
  /** Called with `'static'` when adaptive quality gives up. */
  public onGiveUp?: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: RibbonsOptions = {},
  ) {
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.init();
  }

  get ok(): boolean {
    return !!this.gl && !this.lost;
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
    this.stop();
    this.opts.onFallback?.('lost');
  };

  private init(): void {
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) {
      this.opts.onFallback?.('unsupported');
      return;
    }
    const compile = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[KEX] shader compile failed', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      this.opts.onFallback?.('unsupported');
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[KEX] shader link failed', gl.getProgramInfoLog(prog));
      this.opts.onFallback?.('unsupported');
      return;
    }
    gl.useProgram(prog);
    for (const n of ['uRes', 'uTime', 'uPointer', 'uIntensity', 'uLeftFade', 'uSeed', 'uWin']) this.loc[n] = gl.getUniformLocation(prog, n);
    this.gl = gl;
    this.prog = prog;
    this.resize();
  }

  /** Match the canvas backing store to its CSS size (DPR capped at 1.5, times the adaptive scale). */
  resize(): void {
    const gl = this.gl;
    if (!gl) return;
    // An offscreen canvas (video thumbnails) keeps the size it was given.
    const attached = this.canvas.isConnected;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this.scale;
    const w = attached ? Math.max(1, Math.round(this.canvas.clientWidth * dpr)) : this.canvas.width;
    const h = attached ? Math.max(1, Math.round(this.canvas.clientHeight * dpr)) : this.canvas.height;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  setPointer(x: number, y: number): void {
    this.pointerTarget = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  }

  private draw(time: number): void {
    const gl = this.gl;
    if (!gl || this.lost) return;
    this.resize();
    gl.uniform2f(this.loc.uRes ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.loc.uTime ?? null, time);
    gl.uniform2f(this.loc.uPointer ?? null, this.pointer[0], this.pointer[1]);
    gl.uniform1f(this.loc.uIntensity ?? null, this.opts.intensity ?? 1);
    gl.uniform1f(this.loc.uLeftFade ?? null, this.opts.leftFade ?? 0.46);
    gl.uniform1f(this.loc.uSeed ?? null, (this.opts.seed ?? 0) * 0.37);
    const w = this.opts.window ?? [0, 0, 1339, 253];
    gl.uniform4f(this.loc.uWin ?? null, w[0], w[1], w[2], w[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** One frame at a fixed time (reduced motion, effects "static", tests). */
  renderStatic(t: number): void {
    this.tFrozen = t;
    this.draw(t);
  }

  start(): void {
    if (this.running || !this.gl || this.lost) return;
    this.running = true;
    this.t0 = performance.now() - this.tFrozen * 1000;
    this.last = 0;
    this.frameTimes = [];
    const tick = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.adapt(now);
      this.skip = !this.skip; // 30 fps cap: draw every other 60 Hz frame
      if (this.skip) return;
      this.pointer[0] += (this.pointerTarget[0] - this.pointer[0]) * 0.08;
      this.pointer[1] += (this.pointerTarget[1] - this.pointer[1]) * 0.08;
      this.tFrozen = (now - this.t0) / 1000;
      this.draw(this.tFrozen);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Adaptive quality: median rAF delta over 60 frames above 22 ms drops to .66 resolution; still above, give up (static). */
  private adapt(now: number): void {
    if (this.last) this.frameTimes.push(now - this.last);
    this.last = now;
    if (this.frameTimes.length < 60) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    this.frameTimes = [];
    if (median <= 22) return;
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
  }

  get isRunning(): boolean {
    return this.running;
  }

  get time(): number {
    return this.tFrozen;
  }

  dispose(): void {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    const gl = this.gl;
    if (gl) {
      if (this.prog) gl.deleteProgram(this.prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
    this.prog = null;
  }
}
