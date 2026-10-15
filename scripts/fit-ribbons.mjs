// Fits the tunable constants (K_*, Q_*) of src/fx/ribbons.glsl to the hero of iteration3.png by coordinate search.
// The loss is the mean absolute difference of the two images after a Gaussian-ish blur, so thin strands do not dominate.
// Usage: node scripts/fit-ribbons.mjs [--sweeps=3] [--write]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLSL = path.join(root, 'src/fx/ribbons.glsl');
const MOCK = path.join(root, 'ai_generated_enhanced_drafts/iteration3.png');
const arg = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const sweeps = Number(arg('sweeps', 3));
const write = process.argv.includes('--write');
const W = 1339, H = 253, X0 = 560;
const T = Number(arg('t', 7.3));

const src = readFileSync(GLSL, 'utf8');
const floats = [...src.matchAll(/\b(K_[A-Z0-9_]+)\s*=\s*([-\d.]+)/g)].map((m) => ({ name: m[1], kind: 'f', value: [Number(m[2])] }));
const vecs = [...src.matchAll(/\b(Q_[A-Z0-9_]+)\s*=\s*vec3\(([^)]*)\)/g)].map((m) => ({ name: m[1], kind: 'v', value: m[2].split(',').map(Number) }));
const params = [...floats, ...vecs];
console.log(`${params.length} parameters`);

const apply = (text, ps) => {
  let out = text;
  for (const p of ps) {
    const v = p.kind === 'f' ? p.value[0].toFixed(4) : `vec3(${p.value.map((x) => x.toFixed(4)).join(',')})`;
    const re = p.kind === 'f' ? new RegExp(`\\b${p.name}\\s*=\\s*[-\\d.]+`) : new RegExp(`\\b${p.name}\\s*=\\s*vec3\\([^)]*\\)`);
    out = out.replace(re, `${p.name} = ${v}`);
  }
  return out;
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id=c width=${W} height=${H}></canvas>`);
const mockB64 = readFileSync(MOCK).toString('base64');
await page.evaluate(async ({ mockB64, W, H }) => {
  const img = new Image();
  img.src = `data:image/png;base64,${mockB64}`;
  await img.decode();
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const x = c2.getContext('2d'); x.drawImage(img, 246, 67, W, H, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const blur = (data, w, h, r) => {
    const out = new Float32Array(data.length);
    const tmp = new Float32Array(data.length);
    for (let pass = 0; pass < 2; pass++) {
      const srcA = pass === 0 ? data : out; const dst = pass === 0 ? tmp : out;
      // horizontal then vertical box blur (applied twice by the caller for a tent kernel)
      if (pass === 0) {
        for (let y = 0; y < h; y++) for (let ch = 0; ch < 3; ch++) {
          let acc = 0; for (let xx = -r; xx <= r; xx++) acc += srcA[(y * w + Math.max(0, Math.min(w - 1, xx))) * 4 + ch];
          for (let xx = 0; xx < w; xx++) { dst[(y * w + xx) * 4 + ch] = acc / (2 * r + 1); const a = Math.min(w - 1, xx + r + 1), b = Math.max(0, xx - r); acc += srcA[(y * w + a) * 4 + ch] - srcA[(y * w + b) * 4 + ch]; }
        }
      } else {
        for (let xx = 0; xx < w; xx++) for (let ch = 0; ch < 3; ch++) {
          let acc = 0; for (let yy = -r; yy <= r; yy++) acc += tmp[(Math.max(0, Math.min(h - 1, yy)) * w + xx) * 4 + ch];
          for (let y = 0; y < h; y++) { dst[(y * w + xx) * 4 + ch] = acc / (2 * r + 1); const a = Math.min(h - 1, y + r + 1), b = Math.max(0, y - r); acc += tmp[(a * w + xx) * 4 + ch] - tmp[(b * w + xx) * 4 + ch]; }
        }
      }
    }
    return out;
  };
  window.__blur = blur;
  window.__mock = blur(d, W, H, 3);
}, { mockB64, W, H, X0 });

async function loss(text) {
  return page.evaluate(({ glsl, T, W, H }) => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
    const mk = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }'));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, glsl));
    gl.linkProgram(p); gl.useProgram(p); gl.viewport(0, 0, W, H);
    const u = (n) => gl.getUniformLocation(p, n);
    gl.uniform2f(u('uRes'), W, H); gl.uniform1f(u('uTime'), T); gl.uniform2f(u('uPointer'), 0, 0); gl.uniform1f(u('uIntensity'), 1); gl.uniform1f(u('uLeftFade'), 0.46); gl.uniform1f(u('uSeed'), 0); gl.uniform4f(u('uWin'), 0, 0, 1339, 253);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.deleteProgram(p);
    // flip vertically into RGBA array
    const flipped = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) flipped.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    const b = window.__blur(flipped, W, H, 3);
    let acc = 0, n = 0;
    for (let y = 0; y < H; y += 2) for (let x = X0; x < W; x += 2) { const i = (y * W + x) * 4; acc += Math.abs(b[i] - window.__mock[i]) + Math.abs(b[i + 1] - window.__mock[i + 1]) + Math.abs(b[i + 2] - window.__mock[i + 2]); n += 3; }
    return acc / n;
  }, { glsl: text, T, W, H, X0 });
}

let best = await loss(apply(src, params));
console.log('start loss', best.toFixed(3));
let step = 0.25;
for (let s = 0; s < sweeps; s++) {
  let improved = 0;
  const order = params.map((_, i) => i).sort(() => Math.random() - 0.5);
  for (const i of order) {
    const p = params[i];
    const dims = p.kind === 'f' ? [0] : [0, 1, 2];
    for (const d of dims) {
      for (const dir of [1, -1]) {
        const old = p.value[d];
        const delta = p.kind === 'f' ? old * step * dir || 0.05 * dir : 0.08 * (step / 0.25) * dir;
        p.value[d] = Math.max(0, p.kind === 'f' ? old + delta : Math.min(1.4, old + delta));
        const l = await loss(apply(src, params));
        if (l < best - 1e-4) { best = l; improved++; break; }
        p.value[d] = old;
      }
    }
  }
  console.log(`sweep ${s + 1}: loss ${best.toFixed(3)} (${improved} improvements), step ${step.toFixed(2)}`);
  step *= 0.6;
}
if (write) {
  writeFileSync(GLSL, apply(src, params));
  console.log('written', GLSL);
} else {
  console.log(apply(src, params).split('\n').filter((l) => /K_|Q_/.test(l) && /const/.test(l)).join('\n'));
}
await browser.close();
