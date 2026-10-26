/**
 * Teacher colours in the dark theme (round 8). Course texts carry their own inline colours: black or dark grey text, white
 * table cells, yellow highlighter. Under the dark theme those read as black on navy or as white slabs. Each inline colour is
 * remapped once, keeping its hue: dark text is lifted until it reads (4.5:1), light fills become a dark tint of the same hue,
 * and transparent pictures (diagrams drawn in black) get a paper backing.
 *
 * Nothing is rewritten: the new colour is a custom property beside the teacher's own (`--kex-ink`, `--kex-paint`) and a data
 * attribute that the dark stylesheet (skin/ink.css) reads, so the light theme and a switch back show the original untouched.
 * Editable regions (`[contenteditable]`, editors, form fields) are never touched.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** --kex-bg and the raised surfaces of the dark theme (tokens.css). */
const DARK_BG: Rgb = { r: 15, g: 11, b: 31, a: 1 };
const SURFACE: Record<string, Rgb> = {
  'var(--kex-surface-2)': { r: 27, g: 21, b: 51, a: 1 },
  'var(--kex-surface-3)': { r: 36, g: 29, b: 64, a: 1 },
  'var(--kex-text-2)': { r: 217, g: 214, b: 238, a: 1 },
  'var(--kex-text-3)': { r: 167, g: 162, b: 198, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500',
  purple: '#800080', navy: '#000080', maroon: '#800000', gray: '#808080', grey: '#808080', silver: '#c0c0c0', teal: '#008080',
  olive: '#808000', lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff', darkred: '#8b0000', darkblue: '#00008b',
  darkgreen: '#006400', brown: '#a52a2a', lightgray: '#d3d3d3', lightgrey: '#d3d3d3', whitesmoke: '#f5f5f5',
  lightyellow: '#ffffe0', lightblue: '#add8e6', lightgreen: '#90ee90', pink: '#ffc0cb', gold: '#ffd700',
};

/** "#abc", "#aabbcc", "#aabbccdd", "rgb(1, 2, 3)", "rgba(1 2 3 / 50%)" or a common colour name; anything else is null. */
export function parseColor(input: string | null | undefined): Rgb | null {
  if (!input) return null;
  let v = input.trim().toLowerCase().replace(/\s*!important$/, '');
  v = NAMED[v] ?? v;
  const hex = /^#([0-9a-f]{3,8})$/.exec(v)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = (i: number): number => Number.parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v)?.[1];
  if (fn) {
    const p = fn.split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const ch = (s: string): number => (s.endsWith('%') ? (Number.parseFloat(s) * 255) / 100 : Number.parseFloat(s));
    const a = p[3] === undefined ? 1 : p[3].endsWith('%') ? Number.parseFloat(p[3]) / 100 : Number.parseFloat(p[3]);
    const out = { r: ch(p[0] ?? ''), g: ch(p[1] ?? ''), b: ch(p[2] ?? ''), a };
    return [out.r, out.g, out.b, out.a].every(Number.isFinite) ? out : null;
  }
  return null;
}

const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = (c: Rgb): number => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const over = (top: Rgb, under: Rgb): Rgb => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
  a: 1,
});
export function contrast(fg: Rgb, bg: Rgb): number {
  const [hi, lo] = [luminance(over(fg, bg)), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [x, y, z] = [r / 255, g / 255, b / 255];
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4), a: 1 };
}

const hex = (c: Rgb): string => `#${[c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** The colour a dark-theme reader sees for a value returned by inkFor/paintFor (custom properties resolved to their tokens). */
export const resolved = (v: string): Rgb | null => SURFACE[v] ?? parseColor(v);

/**
 * Text colour for the dark theme, or null when the teacher's colour already reads on `under`. Neutral dark text becomes the
 * body text tone (black was meant as "normal"); coloured text keeps its hue and gains lightness until it reaches 4.5:1.
 */
export function inkFor(fg: Rgb, under: Rgb = DARK_BG): string | null {
  const was = contrast(fg, under);
  if (fg.a < 0.3 || was >= 4.5) return null;
  // On a light fill the teacher chose (one we leave), the pairing was designed for it.
  if (luminance(under) > 0.4) return null;
  const { h, s, l } = toHsl(fg);
  let out = 'var(--kex-text-2)';
  if (s >= 0.15 && l >= 0.06) {
    const sat = Math.min(s, 0.85);
    for (let L = Math.max(l, 0.55); L <= 0.92; L += 0.03) {
      const c = fromHsl(h, sat, L);
      if (contrast(c, under) >= 4.5) {
        out = hex(c);
        break;
      }
    }
  } else if (l >= 0.42) {
    out = 'var(--kex-text-3)';
  }
  // A mid-tone fill can make the lighter colour no better than the teacher's (black on mid blue): keep theirs then.
  const now = resolved(out);
  return now && contrast(now, under) > was ? out : null;
}

/**
 * Fill colour for the dark theme, or null when the teacher's fill is already dark or mid-tone (a designed pairing with its
 * own text colour). White and near-white panels dissolve into the page or a raised surface; light colours become a dark shade
 * of the same hue, a strong highlighter a little brighter so it still reads as a highlight.
 */
export function paintFor(bg: Rgb): string | null {
  if (bg.a < 0.1 || luminance(bg) < 0.45) return null;
  const { h, s, l } = toHsl(bg);
  if (s < 0.12) return l > 0.96 ? 'transparent' : l > 0.9 ? 'var(--kex-surface-2)' : 'var(--kex-surface-3)';
  // Same hue, dark enough for body text (#d9d6ee) to keep 4.5:1 and more.
  const highlighter = s > 0.7 && l < 0.62;
  return hex(highlighter ? fromHsl(h, Math.min(s, 0.6), 0.22) : fromHsl(h, Math.min(s, 0.4), 0.15));
}

/** Where teachers' own HTML shows on a skinned page. */
const CONTENT = [
  '.no-overflow', '.text_to_html', '.activity-description', '#intro', '.box.generalbox', '.qtext', '.posting',
  '.post-content-container', '.book_content', '.summary', '.specificfeedback', '.generalfeedback', '.rightanswer',
  '.course-description', '.feedback', '.page-content-description', '.contentwithoutlink', '.mod_lesson .contents',
].join(', ');
const EDITABLE = '[contenteditable], [contenteditable] *, .tox, .tox *, .editor_atto, .editor_atto *, textarea, input, select, option';
const INLINE = '[style], font[color], [bgcolor]';

function inlineFill(el: HTMLElement): Rgb | null {
  const s = el.style;
  const v = s.backgroundColor || (/^\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)\s*$/i.test(s.background) ? s.background : '') || el.getAttribute('bgcolor');
  return parseColor(v);
}

const inlineText = (el: HTMLElement): Rgb | null => parseColor(el.style.color || (el.tagName === 'FONT' ? el.getAttribute('color') : null));

/** The fill an element sits on in the dark theme: the nearest inline fill up to its content root, as remapped. */
function fillUnder(el: HTMLElement, root: Element): Rgb {
  for (let n: HTMLElement | null = el; n && n !== root.parentElement; n = n.parentElement) {
    const own = inlineFill(n);
    if (!own || own.a < 0.1) continue;
    const painted = n.dataset.kexPaint !== undefined ? resolved(n.style.getPropertyValue('--kex-paint').trim()) : own;
    if (painted && painted.a > 0) return over(painted, DARK_BG);
  }
  return DARK_BG;
}

const done = new WeakSet<Element>();

function inkElement(el: HTMLElement, root: Element): void {
  if (done.has(el) || el.matches(EDITABLE)) return;
  done.add(el);
  const fill = inlineFill(el);
  const paint = fill && paintFor(fill);
  if (paint) {
    el.style.setProperty('--kex-paint', paint);
    el.dataset.kexPaint = '';
  }
  const text = inlineText(el);
  const ink = text && inkFor(text, fillUnder(el, root));
  if (ink) {
    el.style.setProperty('--kex-ink', ink);
    el.dataset.kexInk = '';
  }
}

/** Pictures that can be transparent (not JPEG) and large enough to be a figure, not an inline icon or emoji. */
function paperImage(img: HTMLImageElement): void {
  if (done.has(img) || img.closest(EDITABLE)) return;
  const mark = (): void => {
    if (done.has(img)) return;
    done.add(img);
    const src = img.currentSrc || img.src;
    if (/\.jpe?g(\?|$)/i.test(src) || img.naturalWidth < 48 || img.naturalHeight < 32) return;
    img.dataset.kexPaper = '';
  };
  if (img.complete && img.naturalWidth) mark();
  else img.addEventListener('load', mark, { once: true });
}

/** Mark every inline colour and picture in the page's content areas. Safe to call repeatedly; each element is seen once. */
export function inkPage(doc: Document = document): void {
  for (const root of Array.from(doc.querySelectorAll(CONTENT))) {
    if (root.closest(EDITABLE) || root.closest('#kex-root')) continue;
    // Outer fills first, so text inside can be judged against the remapped fill.
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(INLINE))) inkElement(el, root);
    for (const img of Array.from(root.querySelectorAll('img'))) paperImage(img);
  }
}

/**
 * The editing area of TinyMCE is its own document in a frame, out of reach of our stylesheet. A small sheet goes into its head
 * (never into the body, which is what the editor saves) and follows the page's theme through one attribute on its root.
 */
const FRAME_CSS = `:root[data-kex-dark]{color-scheme:dark}
:root[data-kex-dark] body{background-color:#151029!important;color:#d9d6ee!important}
:root[data-kex-dark] a{color:#d6c8ff!important}
:root[data-kex-dark] .mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before{color:#6f6a92}`;
const FRAMES = 'iframe.tox-edit-area__iframe, .tox-edit-area iframe';
const frames = new Set<HTMLIFrameElement>();

function frameDoc(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

function themeFrame(frame: HTMLIFrameElement, dark: boolean): void {
  const doc = frameDoc(frame);
  if (!doc?.head) return;
  if (!doc.getElementById('kex-dark-frame')) {
    const style = doc.createElement('style');
    style.id = 'kex-dark-frame';
    style.textContent = FRAME_CSS;
    doc.head.append(style);
  }
  doc.documentElement.toggleAttribute('data-kex-dark', dark);
}

const pageDark = (doc: Document): boolean => doc.documentElement.dataset.kexTheme === 'dark';

/** Find new editor frames; each is themed now and again whenever it loads a new document. */
export function inkEditors(doc: Document = document): void {
  for (const frame of Array.from(doc.querySelectorAll<HTMLIFrameElement>(FRAMES))) {
    if (frames.has(frame)) continue;
    frames.add(frame);
    frame.addEventListener('load', () => themeFrame(frame, pageDark(doc)));
    themeFrame(frame, pageDark(doc));
  }
}

/** Keep marking while Moodle's JS adds content (forum replies, quiz pages, lazy sections, editors). Returns the stop function. */
export function watchInk(doc: Document = document): () => void {
  let timer = 0;
  const run = (): void => {
    timer = 0;
    try {
      inkPage(doc);
      inkEditors(doc);
    } catch {
      // A content area we could not read stays as the teacher wrote it.
    }
  };
  run();
  const target = doc.querySelector('#page-content, #region-main, #page') ?? doc.body;
  const mo = new MutationObserver(() => {
    if (!timer) timer = window.setTimeout(run, 250);
  });
  mo.observe(target, { childList: true, subtree: true });
  // The theme switch reaches the editor frames too.
  const themeMo = new MutationObserver(() => {
    for (const frame of frames) {
      if (frame.isConnected) themeFrame(frame, pageDark(doc));
      else frames.delete(frame);
    }
  });
  themeMo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-kex-theme'] });
  return () => {
    window.clearTimeout(timer);
    mo.disconnect();
    themeMo.disconnect();
  };
}
