/**
 * Faculty themes. A TalTech course code is three letters and four digits; the first two letters name the department and the
 * first one its school: I = Information Technology, E = Engineering, L = Science, M = Business and Governance, V = Maritime
 * Academy, U = university-wide. Codes from before the 2017 reform still run: Y and N (science), T and H (business and law),
 * K and A (engineering), and MED/MES/MET/MHK, where the old M meant mechanical engineering.
 * A school sets the ribbon palette, a seed and shape parameters for the hero shader, and the course accent colour
 * (src/styles/components/schools.css); the three-letter prefix nudges the ribbons a little within the school (`ribbonsFor`).
 * The study level is not in the course code (it is in the programme code), so it does not change the look.
 */

export type SchoolId = 'default' | 'it' | 'eng' | 'sci' | 'biz' | 'sea' | 'gen';

export type RGB = readonly [number, number, number];

export interface RibbonStyle {
  /** What the shader's blue channel (the body of the violet ribbons) turns into. */
  body: RGB;
  /** What the red channel (the pink highlights) turns into. */
  accent: RGB;
  /** What the green channel (the pale, near-white parts) turns into. */
  hi: RGB;
  /** [vertical scale of the curves, horizontal stretch, drift amplitude, drift speed]. */
  shape: readonly [number, number, number, number];
  /** Sharpness of the ribbon turns (0 = the default's smooth curves). */
  sharp: number;
  /** Added to the instance seed so every school has its own phase. */
  seed: number;
}

export interface School {
  id: SchoolId;
  ribbons: RibbonStyle;
}

export const DEFAULT_RIBBONS: RibbonStyle = { body: [0, 0, 1], accent: [1, 0, 0], hi: [0, 1, 0], shape: [1, 1, 1, 1], sharp: 0, seed: 0 };

export const SCHOOLS: Record<SchoolId, School> = {
  default: { id: 'default', ribbons: DEFAULT_RIBBONS },
  // Information Technology: blue, with cyan highlights.
  it: { id: 'it', ribbons: { body: [0.08, 0.22, 0.85], accent: [0.1, 0.78, 1.0], hi: [0.45, 0.7, 1.0], shape: [1, 1, 1, 1], sharp: 0, seed: 1.7 } },
  // Engineering: yellow over amber, a sharper ribbon.
  eng: { id: 'eng', ribbons: { body: [0.4, 0.2, 0.015], accent: [1.0, 0.84, 0.16], hi: [0.95, 0.9, 0.62], shape: [1.12, 1, 1.1, 1.1], sharp: 5, seed: 3.1 } },
  // Science: pink over raspberry, a slower wave.
  sci: { id: 'sci', ribbons: { body: [0.48, 0.07, 0.32], accent: [1.0, 0.5, 0.76], hi: [1.0, 0.82, 0.91], shape: [1, 1, 1.25, 0.5], sharp: 0, seed: 5.3 } },
  // Business and Governance: green, with a light lime highlight.
  biz: { id: 'biz', ribbons: { body: [0.03, 0.28, 0.16], accent: [0.45, 0.95, 0.42], hi: [0.76, 0.96, 0.74], shape: [1, 1, 1, 1], sharp: 0, seed: 7.9 } },
  // Maritime Academy: teal, a long horizontal swell.
  sea: { id: 'sea', ribbons: { body: [0.0, 0.3, 0.38], accent: [0.15, 0.9, 0.82], hi: [0.6, 0.95, 0.93], shape: [0.7, 1.2, 1.4, 0.7], sharp: 0, seed: 9.4 } },
  // University-wide and support units: graphite, a calm wave.
  gen: { id: 'gen', ribbons: { body: [0.24, 0.25, 0.3], accent: [0.72, 0.74, 0.8], hi: [0.9, 0.91, 0.94], shape: [0.9, 1.1, 0.8, 0.6], sharp: 0, seed: 11.2 } },
};

const BY_LETTER: Record<string, SchoolId> = {
  I: 'it', E: 'eng', L: 'sci', M: 'biz', V: 'sea', U: 'gen',
  // Before the 2017 reform.
  Y: 'sci', N: 'sci', T: 'biz', H: 'biz', K: 'eng', A: 'eng',
};
/** Old mechanical engineering codes that start with M. */
const BY_PREFIX: Record<string, SchoolId> = { MED: 'eng', MES: 'eng', MET: 'eng', MHK: 'eng' };

/** The school of a course code ("ITI8801" -> 'it'). Codes without a known first letter get the default look. */
export function schoolOf(code: string | undefined | null): SchoolId {
  const c = (code ?? '').trim().toUpperCase();
  return BY_PREFIX[c.slice(0, 3)] ?? BY_LETTER[c.charAt(0)] ?? 'default';
}

export function schoolFor(code: string | undefined | null, enabled: boolean): SchoolId {
  return enabled ? schoolOf(code) : 'default';
}

/** FNV-1a: the same prefix gives the same nudge in every browser and every release. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

/** Turn a colour's hue by `deg` degrees about the grey axis (blue toward cyan or indigo, green toward teal or lime). */
function turn(c: RGB, deg: number): RGB {
  const a = (deg * Math.PI) / 180;
  const k = (1 - Math.cos(a)) / 3;
  const q = Math.sqrt(1 / 3) * Math.sin(a);
  const d = Math.cos(a) + k;
  const v = (x: number): number => round(Math.min(1, Math.max(0, x)));
  return [v(d * c[0] + (k - q) * c[1] + (k + q) * c[2]), v((k + q) * c[0] + d * c[1] + (k - q) * c[2]), v((k - q) * c[0] + (k + q) * c[1] + d * c[2])];
}
const variants = new Map<string, RibbonStyle>();
/** How far a prefix may turn its school's hue, in degrees (positive turns toward green): engineering stays gold to orange, never lime. */
const HUES: Partial<Record<SchoolId, readonly [number, number]>> = { eng: [-12, 0] };

/**
 * The ribbons of a course: its school's palette, nudged by the three-letter prefix of the code, so IAS, ITB and IEE are all blue
 * but each a little differently: the hue turns up to 14 degrees (bluer, more cyan, more indigo), the curves are a little taller
 * or flatter, wider or narrower, and drift more or less. One object per prefix, so the hero sees the same look as the same look.
 */
export function ribbonsFor(code: string | undefined | null, enabled: boolean): RibbonStyle {
  const school = schoolFor(code, enabled);
  const base = SCHOOLS[school].ribbons;
  const prefix = (code ?? '').trim().slice(0, 3).toUpperCase();
  if (school === 'default' || !/^[A-Z]{3}$/.test(prefix)) return base;
  const known = variants.get(prefix);
  if (known) return known;
  const h = hash(prefix);
  // Six numbers in -1..1 from the hash.
  const r = (k: number): number => (((h >>> (k * 5)) & 31) / 31) * 2 - 1;
  const [a, b, c, d] = base.shape;
  const [lo, hi] = HUES[school] ?? [-14, 14];
  const hue = lo + ((r(5) + 1) / 2) * (hi - lo);
  const style: RibbonStyle = {
    body: turn(base.body, hue),
    accent: turn(base.accent, hue),
    hi: turn(base.hi, hue / 2),
    shape: [round(a * (1 + 0.12 * r(0))), round(b * (1 + 0.1 * r(1))), round(c * (1 + 0.25 * r(2))), round(d * (1 + 0.2 * r(3)))],
    sharp: base.sharp ? round(base.sharp * (1 + 0.25 * r(4))) : 0,
    seed: round(base.seed + ((h >>> 7) % 1000) / 160),
  };
  variants.set(prefix, style);
  return style;
}
