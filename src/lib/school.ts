/**
 * Faculty themes. TalTech course codes start with a letter that names the school
 * (I = Information Technology, E = Engineering, Y = Science, T = Business, V and M = Maritime Academy).
 * A school sets the ribbon palette, a seed and shape parameters for the hero shader, and the course accent colour (src/styles/components/schools.css).
 */

export type SchoolId = 'default' | 'it' | 'eng' | 'sci' | 'biz' | 'sea';

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
  // Information Technology: cyan over violet.
  it: { id: 'it', ribbons: { body: [0.45, 0.06, 0.95], accent: [0.0, 0.85, 1.0], hi: [0.2, 0.55, 0.85], shape: [1, 1, 1, 1], sharp: 0, seed: 1.7 } },
  // Engineering: amber over copper, a sharper ribbon.
  eng: { id: 'eng', ribbons: { body: [0.55, 0.2, 0.05], accent: [0.95, 0.6, 0.0], hi: [0.8, 0.7, 0.5], shape: [1.12, 1, 1.1, 1.1], sharp: 5, seed: 3.1 } },
  // Science: green over teal, a slower wave.
  sci: { id: 'sci', ribbons: { body: [0.0, 0.4, 0.45], accent: [0.3, 0.85, 0.25], hi: [0.6, 0.9, 0.8], shape: [1, 1, 1.25, 0.5], sharp: 0, seed: 5.3 } },
  // Business: indigo with gold.
  biz: { id: 'biz', ribbons: { body: [0.0, 0.05, 0.9], accent: [0.8, 0.5, 0.0], hi: [0.1, 0.15, 0.6], shape: [1, 1, 1, 1], sharp: 0, seed: 7.9 } },
  // Maritime Academy: navy and sea blue, a long horizontal swell.
  sea: { id: 'sea', ribbons: { body: [0.05, 0.22, 0.62], accent: [0.0, 0.65, 0.8], hi: [0.55, 0.85, 0.95], shape: [0.7, 1.2, 1.4, 0.7], sharp: 0, seed: 9.4 } },
};

const BY_LETTER: Record<string, SchoolId> = { I: 'it', E: 'eng', Y: 'sci', T: 'biz', V: 'sea', M: 'sea' };

/** The school of a course code ("ITI8801" -> 'it'). Codes without a known first letter get the default look. */
export function schoolOf(code: string | undefined | null): SchoolId {
  const c = (code ?? '').trim().charAt(0).toUpperCase();
  return BY_LETTER[c] ?? 'default';
}

export function schoolFor(code: string | undefined | null, enabled: boolean): SchoolId {
  return enabled ? schoolOf(code) : 'default';
}
