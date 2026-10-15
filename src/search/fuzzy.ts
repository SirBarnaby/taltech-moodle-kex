/** Text matching for the command palette (architecture §12.1). Diacritic- and case-insensitive. */

export interface Normalized {
  s: string;
  /** map[i] = index in the original string of normalized char i. */
  map: number[];
}

/** NFD, strip combining marks, lowercase; keeps an index map so highlights land on the original text. */
export function normalize(text: string): Normalized {
  let s = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const n = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const c of n) {
      s += c;
      map.push(i);
    }
    i += ch.length;
  }
  return { s, map };
}

export const norm = (text: string): string => normalize(text).s;

export const SCORE = { exact: 120, prefix: 100, wordStart: 80, substring: 60, subsequence: 30 } as const;

export interface Match {
  score: number;
  /** [start, end) ranges in the original text to highlight. */
  ranges: [number, number][];
}

const isWordChar = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}]/u.test(c);

function toRanges(idx: number[], map: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of idx) {
    const o = map[i];
    if (o === undefined) continue;
    const last = out[out.length - 1];
    if (last && last[1] === o) last[1] = o + 1;
    else out.push([o, o + 1]);
  }
  return out;
}

/** Score one token against one text. Returns null when it does not match. */
function matchToken(q: string, t: Normalized): Match | null {
  if (!q) return { score: 0, ranges: [] };
  const s = t.s;
  if (s === q) return { score: SCORE.exact, ranges: toRanges(range(0, q.length), t.map) };
  if (s.startsWith(q)) return { score: SCORE.prefix, ranges: toRanges(range(0, q.length), t.map) };
  // word-start prefix
  for (let i = 1; i < s.length; i++) {
    if (!isWordChar(s[i - 1]) && s.startsWith(q, i)) return { score: SCORE.wordStart, ranges: toRanges(range(i, i + q.length), t.map) };
  }
  const at = s.indexOf(q);
  if (at >= 0) return { score: SCORE.substring, ranges: toRanges(range(at, at + q.length), t.map) };
  // subsequence: greedy, penalise gaps between matched runs
  const idx: number[] = [];
  let j = 0;
  for (let i = 0; i < s.length && j < q.length; i++) {
    if (s[i] === q[j]) {
      idx.push(i);
      j++;
    }
  }
  if (j < q.length) return null;
  let gaps = 0;
  for (let k = 1; k < idx.length; k++) if ((idx[k] ?? 0) - (idx[k - 1] ?? 0) > 1) gaps++;
  return { score: Math.max(1, SCORE.subsequence - gaps), ranges: toRanges(idx, t.map) };
}

function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i < b; i++) r.push(i);
  return r;
}

/**
 * Match a (possibly multi-word) query against a text. The whole query is tried first; for multi-word
 * queries every word must also match somewhere and the average counts.
 */
export function matchText(query: string, text: string): Match | null {
  const q = norm(query).trim();
  if (!q) return { score: 0, ranges: [] };
  const t = normalize(text);
  const whole = matchToken(q, t);
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length < 2) return whole;
  let sum = 0;
  const ranges: [number, number][] = [];
  for (const w of words) {
    const m = matchToken(w, t);
    if (!m) return whole;
    sum += m.score;
    ranges.push(...m.ranges);
  }
  const multi: Match = { score: Math.round((sum / words.length) * 0.9), ranges: ranges.sort((a, b) => a[0] - b[0]) };
  return !whole || multi.score > whole.score ? multi : whole;
}
