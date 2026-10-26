// Render matching high-resolution hero and portrait login fallbacks at t=7.3.
// Every shader uniform is set explicitly, including palette and shape.
// Usage: node scripts/render-fallback.mjs [name ...]   (names such as login-fallback or hero-it-fallback; default: all)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = 7.3;
const glsl = readFileSync(path.join(root, 'src/fx/ribbons.glsl'), 'utf8');
const schoolModule = await transform(readFileSync(path.join(root, 'src/lib/school.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
const { SCHOOLS, DEFAULT_RIBBONS } = await import(`data:text/javascript;base64,${Buffer.from(schoolModule.code).toString('base64')}`);
const surfaces = Object.values(SCHOOLS).flatMap(({ id, ribbons }) => [
  { name: id === 'default' ? 'hero-fallback' : `hero-${id}-fallback`, W: 2560, H: 480, intensity: 1, leftFade: 0.46, seed: 0, style: ribbons },
  { name: id === 'default' ? 'band-fallback' : `band-${id}-fallback`, W: 2560, H: 264, intensity: 0.4, leftFade: 0.46, seed: 0, style: ribbons },
]);
surfaces.push({ name: 'login-fallback', W: 1440, H: 1600, intensity: 1.15, leftFade: 0, seed: 11, style: DEFAULT_RIBBONS });

const only = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.KEX_CHROMIUM || undefined, channel: process.env.KEX_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
for (const { name, W, H, intensity, leftFade, seed, style } of surfaces.filter((x) => !only.length || only.includes(x.name))) {
const out = path.join(root, `assets/${name}.webp`);
await page.setContent(`<canvas id="c" width="${W}" height="${H}"></canvas>`);
const b64 = await page.evaluate(async ({ glsl, W, H, T, intensity, leftFade, seed, style }) => {
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
  gl.uniform1f(u('uIntensity'), intensity);
  gl.uniform1f(u('uLeftFade'), leftFade);
  gl.uniform1f(u('uSeed'), (seed + style.seed) * 0.37);
  gl.uniform4f(u('uWin'), 0, 0, 1339, 253);
  gl.uniform3f(u('uBody'), ...style.body);
  gl.uniform3f(u('uAccent'), ...style.accent);
  gl.uniform3f(u('uHi'), ...style.hi);
  gl.uniform4f(u('uShape'), ...style.shape);
  gl.uniform1f(u('uSharp'), style.sharp);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.95));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}, { glsl, W, H, T, intensity, leftFade, seed, style });
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`wrote ${path.relative(root, out)} (${Buffer.from(b64, 'base64').length} bytes)`);
}
await browser.close();
