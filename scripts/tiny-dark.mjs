// Generate the dark TinyMCE chrome (round 8) from TinyMCE's own two skins: every declaration where oxide-dark differs from
// oxide (the light skin Moodle loads) is written for skin pages in dark mode, with TinyMCE's blue-grey neutrals mapped onto our
// violet-navy palette. Accent colours and translucent whites are kept as TinyMCE has them. Output: src/styles/skin/tiny-dark.css.
//
// Specificity: like the dark mirror, one `:root:where([data-kex="skin"][data-kex-theme="dark"])` block, one class above TinyMCE's
// own `.tox ...` rules and below our hand-written skin rules.
//
// Usage: npm pack tinymce@7.3.0 && tar xzf tinymce-7.3.0.tgz package/skins
//        node scripts/tiny-dark.mjs package/skins/ui      (the folder holding oxide/ and oxide-dark/)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as csstree from 'css-tree';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) throw new Error('Usage: node scripts/tiny-dark.mjs <tinymce>/skins/ui');
const out = path.join(root, 'src/styles/skin/tiny-dark.css');
const PREFIX = ':root:where([data-kex="skin"][data-kex-theme="dark"])';

// oxide-dark neutrals, darkest first, onto ours (tokens.css dark block). Borders get our border tones: TinyMCE draws them darker
// than the surface, we draw them lighter.
const FILL = {
  '#161f29': 'var(--kex-bg)', '#19232e': '#120d24', '#222f3e': 'var(--kex-surface-1)', '#2b3b4e': 'var(--kex-surface-2)',
  '#2f4055': 'var(--kex-surface-3)', '#324053': '#2a2148', '#34485f': 'var(--kex-border-strong)', '#3d546f': '#3a3166',
};
const BORDER = {
  '#161f29': 'var(--kex-border)', '#19232e': 'var(--kex-border)', '#222f3e': 'var(--kex-border)', '#2b3b4e': 'var(--kex-border-card)',
  '#2f4055': 'var(--kex-border-card)', '#324053': 'var(--kex-border-strong)', '#34485f': 'var(--kex-border-strong)', '#3d546f': '#3a3166',
};
const TEXT = { '#fff': 'var(--kex-text)', '#ffffff': 'var(--kex-text)' };
// The neutral at an alpha (shadows, scrims) keeps its alpha on our base.
const ALPHA = { '34,47,62': '21,16,41', '43,59,78': '27,21,51' };

function mapValue(prop, value) {
  const border = /^(border|outline)/.test(prop);
  const text = prop === 'color' || prop === 'fill';
  return value
    .replace(/#[0-9a-f]{3,8}\b/gi, (h) => {
      const k = h.toLowerCase();
      if (text && TEXT[k]) return TEXT[k];
      return (border ? BORDER[k] : FILL[k]) ?? TEXT[k] ?? h;
    })
    .replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g, (m, r, g, b) => {
      const to = ALPHA[`${r},${g},${b}`];
      return to ? `rgba(${to},` : m;
    });
}

function splitList(prelude) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
/** Vendor pseudo-classes and -elements make Firefox drop the whole rule. */
const VENDOR = /::?-(webkit|ms)-|:-(webkit|ms)-/i;

function rules(file) {
  const list = [];
  const visit = (children, media) => children.forEach((n) => {
    if (n.type === 'Atrule' && n.block) {
      const name = n.name.toLowerCase();
      if (name === 'media' || name === 'supports') visit(n.block.children, [...media, `@${name} ${n.prelude ? csstree.generate(n.prelude) : ''}`]);
      return;
    }
    if (n.type !== 'Rule') return;
    const decls = n.block.children.toArray().filter((d) => d.type === 'Declaration')
      .map((d) => ({ prop: d.property.toLowerCase(), value: (d.value.type === 'Raw' ? d.value.value : csstree.generate(d.value)).trim(), important: !!d.important }));
    list.push({ sel: n.prelude.type === 'Raw' ? n.prelude.value : csstree.generate(n.prelude), media, decls });
  });
  visit(csstree.parse(readFileSync(file, 'utf8'), { parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false }).children, []);
  return list;
}

const light = rules(path.join(dir, 'oxide/skin.css'));
const dark = rules(path.join(dir, 'oxide-dark/skin.css'));
// A selector can occur more than once (`.tox` twice); its n-th occurrence pairs with the n-th in the other skin.
const keyed = (list) => {
  const seen = new Map();
  return list.map((r) => {
    const k = `${r.media.join('|')}::${r.sel}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    return [`${k}#${seen.get(k)}`, r];
  });
};
const byKey = new Map(keyed(light));
const blocks = [];
let decls = 0;
for (const [key, r] of keyed(dark)) {
  const twin = byKey.get(key);
  const body = r.decls.filter((d) => twin?.decls.find((l) => l.prop === d.prop)?.value !== d.value)
    .map((d) => `${d.prop}:${mapValue(d.prop, d.value)}${d.important ? '!important' : ''}`);
  if (!body.length) continue;
  decls += body.length;
  // Inside the nested block every selector continues from the prefix.
  const sels = splitList(r.sel).filter((s) => !VENDOR.test(s));
  if (!sels.length) continue;
  const sel = sels.map((s) => `& ${s}`).join(',');
  blocks.push(r.media.reduceRight((inner, m) => `${m}{${inner}}`, `${sel}{${body.join(';')}}`));
}

const version = /"version":\s*"([^"]+)"/.exec((() => {
  try { return readFileSync(path.join(dir, '../../package.json'), 'utf8'); } catch { return ''; }
})())?.[1] ?? 'unknown';
writeFileSync(out, `/* GENERATED by scripts/tiny-dark.mjs from TinyMCE ${version}'s oxide and oxide-dark skins. Do not edit by hand: change the mapping
   in the script and run it again. Dark mode only, skin pages only; the editing area inside the frame is darkened by content/darkink.ts. */
${PREFIX} {
${blocks.join('\n')}
}
`);
console.log(`tiny-dark: ${dark.length} rules read, ${blocks.length} written (${decls} declarations) -> ${path.relative(root, out)}`);
