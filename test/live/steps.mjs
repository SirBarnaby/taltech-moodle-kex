// What a reader does, sent as real input: wheel scrolls and mouse clicks at screen positions (nothing is scrolled into view first,
// so a click only works on what is on screen), keys, and full page loads. Plus the per-frame recorder (recorder.js).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { actions, exec, execAsync } from './wd.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** KEX has drawn its shell and no page change is running. */
export async function ready(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ok = await exec('return document.readyState === "complete" && document.documentElement.dataset.kexShell === "ready" && !document.documentElement.dataset.kexNav && !document.documentElement.dataset.kexInteraction').catch(() => false);
    if (ok) return true;
    await sleep(150);
  }
  return false;
}

/** A full page load of `url` (a change of the hash alone is followed by a reload, so it is a real load too). */
export async function load(url, settle = 1500) {
  const u = JSON.stringify(url);
  await exec(`const u = new URL(${u}); if (u.pathname + u.search === location.pathname + location.search) { history.replaceState(null, '', u.href); location.reload(); } else location.href = u.href;`);
  await sleep(700);
  const ok = await ready();
  await sleep(settle);
  return ok;
}

export async function wheel(dy, x = 960, y = 600, duration = 250) {
  await actions([{ type: 'wheel', id: 'wheel', actions: [{ type: 'scroll', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY: dy, duration, origin: 'viewport' }] }]);
}

export async function clickAt(x, y) {
  await actions([{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
    { type: 'pointerMove', x: Math.round(x), y: Math.round(y), duration: 120, origin: 'viewport' },
    { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 70 }, { type: 'pointerUp', button: 0 },
  ] }]);
}

/** Click the first element matching `sel` that is on screen and not covered, at its centre. Throws when there is none. */
export async function click(sel) {
  const r = await exec(`const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => !e.closest('.kex-transition-ghost'));
    for (const e of els) { const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      if (r.width && r.height && r.top >= 0 && r.bottom <= innerHeight && top && (e === top || e.contains(top))) return { x, y, text: e.textContent.trim().slice(0, 40) }; }
    return null;`);
  if (!r) throw new Error(`not on screen: ${sel}`);
  await clickAt(r.x, r.y);
  return r;
}

const KEYS = { Escape: '', Enter: '', ArrowDown: '', ArrowUp: '', ArrowLeft: '', ArrowRight: '', Control: '', Shift: '', Alt: '', Home: '', End: '' };
export async function key(k, mods = []) {
  const v = (x) => KEYS[x] ?? x;
  await actions([{ type: 'key', id: 'kbd', actions: [
    ...mods.map((m) => ({ type: 'keyDown', value: v(m) })), { type: 'keyDown', value: v(k) }, { type: 'keyUp', value: v(k) }, ...mods.reverse().map((m) => ({ type: 'keyUp', value: v(m) })),
  ] }]);
}

export const state = () => exec(`return { y: Math.round(scrollY), h: document.documentElement.scrollHeight, vh: innerHeight, hash: location.hash, url: location.pathname + location.search,
  topic: document.querySelector('[data-kex-topic][aria-current="true"], [data-kex-bartopic][aria-current="true"]')?.dataset.kexTopic ?? document.querySelector('[data-kex-bartopic][aria-current="true"]')?.dataset.kexBartopic };`);

/** Start (or reset) the recorder in the page. */
export const record = () => exec('return ' + readFileSync(path.join(HERE, 'recorder.js'), 'utf8').replace(/\r/g, '').replace(/^(\/\/[^\n]*\n)+/, '').trim());
export const now = () => exec('return Math.round(performance.now())');
export const dump = () => exec('const r = window.__rec; return r ? { frames: r.frames, events: r.events, moves: r.moves } : null');
export { exec, execAsync };
