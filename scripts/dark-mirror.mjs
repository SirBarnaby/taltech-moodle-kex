// Generate the dark twin of TalTech's theme (round 8): for every rule in the captured taltech4_boost CSS that sets a light
// background, dark text or a light border, write the same selector for skin pages in dark mode with the colour mapped onto our
// dark palette (hue kept, lightness flipped). The output is plain CSS we can review: src/styles/skin/dark-mirror.css.
//
// Specificity: every rule is nested in one `:root:where([data-kex="skin"][data-kex-theme="dark"])` block, one class worth more
// than TalTech's own rule, so it wins over the theme, and less than our hand-written skin rules (`:root[data-kex="skin"] ...`),
// which keep winning where we designed something on purpose.
//
// Usage: node scripts/dark-mirror.mjs [theme.css]   (default: the newest captures/css/theme_styles_php_taltech4_boost_*.css)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as csstree from 'css-tree';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const capDir = path.join(root, 'captures/css');
const input = process.argv[2] ?? path.join(capDir, readdirSync(capDir).filter((f) => f.startsWith('theme_styles_php_taltech4_boost_')).sort().pop());
const out = path.join(root, 'src/styles/skin/dark-mirror.css');
const revision = /taltech4_boost_(\d+_\d+)/.exec(input)?.[1] ?? 'unknown';
const PREFIX = ':root:where([data-kex="skin"][data-kex-theme="dark"])';

// ---------------------------------------------------------------------------------------------------- colours

const NAMED = {
  white: '#ffffff', black: '#000000', gray: '#808080', grey: '#808080', silver: '#c0c0c0', whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3', ghostwhite: '#f8f8ff', aliceblue: '#f0f8ff', snow: '#fffafa', ivory: '#fffff0', beige: '#f5f5dc',
  linen: '#faf0e6', red: '#ff0000', darkgreen: '#006400', green: '#008000', blue: '#0000ff', navy: '#000080', darkred: '#8b0000',
  lightyellow: '#ffffe0', lightblue: '#add8e6', lightgreen: '#90ee90', lightpink: '#ffb6c1', lavender: '#e6e6fa', yellow: '#ffff00',
  orange: '#ffa500', purple: '#800080', maroon: '#800000', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', dimgray: '#696969', dimgrey: '#696969',
};
const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b[a-z]+\b/gi;

/** [r, g, b, a] in 0..1, or null when the token is not a plain colour. */
function parseColor(token) {
  let t = token.trim().toLowerCase();
  if (NAMED[t]) t = NAMED[t];
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
  }
  m = /^rgba?\(([^)]*)\)$/.exec(t);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255);
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const rgb = parts.slice(0, 3).map(ch);
    return rgb.some(Number.isNaN) || Number.isNaN(a) ? null : [...rgb, a];
  }
  m = /^hsla?\(([^)]*)\)$/.exec(t);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return [...hslToRgb(parseFloat(parts[0]) / 360, parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100), a];
  }
  return null;
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

const hex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const DARK_BG = [15 / 255, 11 / 255, 31 / 255];
const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
/** Chroma relative to lightness: greys (and near-greys like #f8f9fa) are neutral. */
const neutral = (s, l) => s * (1 - Math.abs(2 * l - 1)) < 0.06;

/** A surface: white and near-white become our page and raised surfaces; light tints keep their hue as a dark tint. */
function mapBackground(c) {
  const [, , , a] = c;
  if (a < 0.35) return null;
  const [h, s, l] = rgbToHsl(c);
  if (l < 0.8) return null;
  if (neutral(s, l)) return l >= 0.985 ? 'var(--kex-bg)' : l >= 0.95 ? 'var(--kex-surface-1)' : l >= 0.9 ? 'var(--kex-surface-2)' : 'var(--kex-surface-3)';
  return hex(mix(hslToRgb(h, Math.min(0.85, Math.max(0.45, s)), 0.55), DARK_BG, 0.18));
}

/** Text: dark greys become our text tokens, dark or mid colours keep their hue at a readable lightness. */
function mapText(c) {
  const [, , , a] = c;
  if (a < 0.3) return null;
  const [h, s, l] = rgbToHsl(c);
  if (neutral(s, l)) {
    if (l < 0.3) return 'var(--kex-text-2)';
    if (l < 0.55) return 'var(--kex-text-3)';
    return null;
  }
  if (l >= 0.62) return null;
  return hex(hslToRgb(h, Math.min(0.75, s), l < 0.35 ? 0.82 : 0.74));
}

/** Borders: light lines become our hairlines; black lines (invisible on dark) become the card border. */
function mapBorder(c) {
  const [, , , a] = c;
  if (a === 0) return null;
  const [h, s, l] = rgbToHsl(c);
  if (neutral(s, l) || a < 0.5) {
    if (a < 0.5) return 'var(--kex-border)';
    if (l >= 0.85) return 'var(--kex-border)';
    if (l >= 0.6) return 'var(--kex-border-card)';
    if (l < 0.25) return 'var(--kex-border-card)';
    return null;
  }
  if (l < 0.8) return null;
  return hex(mix(hslToRgb(h, Math.min(0.8, s), 0.55), DARK_BG, 0.35));
}

/** The one plain colour in a value ("1px solid #ddd", "#fff", "#fff!important"), else null. */
function soleColor(value) {
  const tokens = (value.match(COLOR_RE) ?? []).filter((tk) => parseColor(tk));
  if (tokens.length !== 1 || /url\(|gradient\(|var\(/i.test(value)) return null;
  return parseColor(tokens[0]);
}

// ---------------------------------------------------------------------------------------------------- selectors

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
const VENDOR = /::?-(webkit|moz|ms)-|:-(webkit|moz|ms)-/i;
/** Pages and modes a student never sees: site administration, question and course editing, backup and restore. */
const STAFF_ONLY = /#page-(admin|question-type|question-edit|course-edit|course-management|backup|restore|grade-edit|mod-[a-z]+-mod\b)|\.path-admin\b|body\.editing\b|\.editing\s|\.editing$|\.course-content-edit|\.block_settings/i;

/** The selector, nested under the one dark block: `&` stands for the root (html and :root selectors), else a descendant. */
function nested(selector) {
  if (VENDOR.test(selector) || STAFF_ONLY.test(selector)) return null;
  if (/^html(?![\w-])/i.test(selector)) return `&${selector.slice(4)}`;
  if (/^:root(?![\w-])/i.test(selector)) return `&${selector.slice(5)}`;
  return selector;
}

// ---------------------------------------------------------------------------------------------------- walk

const css = readFileSync(input, 'utf8');
let parseErrors = 0;
const ast = csstree.parse(css, { parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false, onParseError: () => parseErrors++ });

const SIDES = /^border-(top|right|bottom|left)$/;
const stats = { rules: 0, decls: 0 };
const blocks = [];

function mapDecl(prop, value) {
  const c = soleColor(value);
  if (!c) return null;
  if (prop === 'background-color' || prop === 'background') {
    // The shorthand only when it is nothing but a colour (no image, no gradient).
    if (prop === 'background' && value.trim().split(/\s+/).length > 1 && !/^(rgb|hsl)a?\(/i.test(value.trim())) return null;
    const v = mapBackground(c);
    return v && ['background-color', v];
  }
  if (prop === 'color') {
    const v = mapText(c);
    return v && ['color', v];
  }
  if (prop === 'border-color' || prop === 'border' || SIDES.test(prop) || /^border-(top|right|bottom|left)-color$/.test(prop)) {
    if (prop === 'border-color' && value.trim().split(/\s+/).length > 1) return null;
    const v = mapBorder(c);
    const side = SIDES.exec(prop)?.[1] ?? /^border-(top|right|bottom|left)-color$/.exec(prop)?.[1];
    return v && [side ? `border-${side}-color` : 'border-color', v];
  }
  return null;
}

function visitRules(list, media) {
  list.forEach((node) => {
    if (node.type === 'Atrule') {
      const name = node.name.toLowerCase();
      const prelude = node.prelude ? csstree.generate(node.prelude) : '';
      if (name === 'media' && /\bprint\b/.test(prelude) && !/\bscreen\b/.test(prelude)) return;
      if ((name === 'media' || name === 'supports') && node.block) visitRules(node.block.children, [...media, `@${name} ${prelude}`]);
      return;
    }
    if (node.type !== 'Rule') return;
    stats.rules++;
    const decls = [];
    node.block.children.forEach((d) => {
      if (d.type !== 'Declaration') return;
      const prop = d.property.toLowerCase();
      const value = d.value.type === 'Raw' ? d.value.value : csstree.generate(d.value);
      const mapped = mapDecl(prop, value);
      if (mapped) decls.push(`${mapped[0]}:${mapped[1]}${d.important ? '!important' : ''}`);
    });
    if (!decls.length) return;
    const raw = node.prelude.type === 'Raw' ? node.prelude.value : csstree.generate(node.prelude);
    const sels = splitList(raw).map(nested).filter(Boolean);
    if (!sels.length) return;
    stats.decls += decls.length;
    blocks.push({ media, sel: sels.join(','), body: [...new Set(decls)].join(';') });
  });
}
visitRules(ast.children, []);

// Rules with the same body that follow each other share one selector list (order across bodies is kept).
const merged = [];
for (const b of blocks) {
  const last = merged[merged.length - 1];
  if (last && last.body === b.body && last.media.join() === b.media.join()) last.sel += `,${b.sel}`;
  else merged.push({ ...b });
}
const text = merged.map((b) => {
  const rule = `${b.sel}{${b.body}}`;
  return b.media.reduceRight((inner, m) => `${m}{${inner}}`, rule);
}).join('\n');

writeFileSync(out, `/* GENERATED by scripts/dark-mirror.mjs from TalTech's taltech4_boost theme, revision ${revision}. Do not edit by hand: change the
   mapping in the script and run it again. Dark mode only, skin pages only; our own skin rules outrank every line here. */
${PREFIX} {
${text}
}
`);
console.log(`dark-mirror: ${stats.rules} rules read, ${blocks.length} mirrored (${stats.decls} declarations), ${merged.length} written, ${parseErrors} parse errors skipped, ${(text.length / 1024).toFixed(0)} KB -> ${path.relative(root, out)}`);
