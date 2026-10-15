// Renders the hero shader once (1920x360, frozen at t=7.3) into assets/hero-fallback.webp.
// The image is the CSS fallback when effects are off or WebGL2 is unavailable (design-spec §2.3).
// Usage: node scripts/render-fallback.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets/hero-fallback.webp');
const W = 1920;
const H = 360;
const T = 7.3;
const glsl = readFileSync(path.join(root, 'src/fx/ribbons.glsl'), 'utf8');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id="c" width="${W}" height="${H}"></canvas>`);
const b64 = await page.evaluate(async ({ glsl, W, H, T }) => {
  const c = document.getElementById('c');
  const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is not available');
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, glsl));
  gl.linkProgram(p);
  gl.useProgram(p);
  gl.viewport(0, 0, W, H);
  const u = (n) => gl.getUniformLocation(p, n);
  gl.uniform2f(u('uRes'), W, H);
  gl.uniform1f(u('uTime'), T);
  gl.uniform2f(u('uPointer'), 0, 0);
  gl.uniform1f(u('uIntensity'), 1);
  gl.uniform1f(u('uLeftFade'), 0.46);
  gl.uniform1f(u('uSeed'), 0);
  gl.uniform4f(u('uWin'), 0, 0, 1339, 253);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}, { glsl, W, H, T });
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`wrote ${path.relative(root, out)} (${Buffer.from(b64, 'base64').length} bytes)`);
await browser.close();
