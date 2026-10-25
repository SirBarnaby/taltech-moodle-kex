import type { Season } from './model';
import { t } from '../i18n';

const CODE_RE = /\b[A-Z]{3}\d{4}\b/;
const CODE_ALL_RE = /\b[A-Z]{3}\d{4}\b/g;
const SEASONS = 'sügis|autumn|kevad|spring|suvi|summer|talv|winter';
const SEMESTER_RE = new RegExp(`\\((\\d{4})\\s+(${SEASONS})`, 'i');
/** A parenthesised group that starts with a year and a season, e.g. "(2026 sügis/autumn)". */
const SEMESTER_GROUP_RE = new RegExp(`\\s*\\(\\s*\\d{4}\\s+(?:${SEASONS})[^)]*\\)`, 'gi');

const SEASON_MAP: Record<string, Season> = {
  sügis: 'autumn', autumn: 'autumn', kevad: 'spring', spring: 'spring', suvi: 'summer', summer: 'summer', talv: 'winter', winter: 'winter',
};

export interface ParsedName {
  code: string;
  name: string;
  semester?: { season: Season; year: number };
}

export function parseCode(shortname: string, fullname: string, idnumber = ''): string {
  for (const s of [shortname, fullname, idnumber]) {
    const m = CODE_RE.exec(s);
    if (m) return m[0];
  }
  return shortname.trim() || idnumber.trim();
}

/** Semester from "(2026 sügis)"; falls back to the current date (Aug-Jan autumn, Feb-Jul spring). */
export function parseSemester(fullname: string, now: Date = new Date()): { season: Season; year: number } {
  const m = SEMESTER_RE.exec(fullname);
  if (m) return { year: Number(m[1]), season: SEASON_MAP[(m[2] ?? '').toLowerCase()] ?? 'autumn' };
  const month = now.getMonth(); // 0-based
  if (month >= 7) return { season: 'autumn', year: now.getFullYear() };
  if (month === 0) return { season: 'autumn', year: now.getFullYear() - 1 };
  return { season: 'spring', year: now.getFullYear() };
}

/** Readable course name: drop codes and semester groups, pick a language half, "and" to "&". */
export function parseName(fullname: string, lang: 'en' | 'et' = 'en'): string {
  let s = fullname.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(SEMESTER_GROUP_RE, '').trim();
    s = s.replace(/\s*\(\s*[A-Z]{3}\d{4}\s*\)\s*$/, '').trim(); // trailing "(CODE)"
    s = s.replace(/^(?:[A-Z]{3}\d{4}[\s:.\-–—]*)+/, '').trim(); // leading codes
    s = s.replace(/[\s:.\-–—]*(?:[A-Z]{3}\d{4})$/, '').trim(); // trailing bare code
    if (s === before) break;
  }
  if (s.includes(' / ')) {
    const parts = s.split(' / ');
    s = (lang === 'en' ? parts[parts.length - 1] : parts[0]) ?? s;
  }
  s = s.replace(/\s+and\s+/g, ' & ').replace(/\s+/g, ' ').trim();
  return s || fullname.replace(CODE_ALL_RE, '').trim() || fullname;
}

export function parseCourseName(
  shortname: string,
  fullname: string,
  idnumber = '',
  lang: 'en' | 'et' = 'en',
): ParsedName {
  const hasSemester = SEMESTER_RE.test(fullname);
  return {
    code: parseCode(shortname, fullname, idnumber),
    name: parseName(fullname, lang),
    semester: hasSemester ? parseSemester(fullname) : undefined,
  };
}

/** Title split for the hero (architecture §9). Single-word names stay on one line. */
export function splitTitle(name: string): [string, string?] {
  if (name.includes(' & ')) {
    const i = name.indexOf(' & ');
    return [name.slice(0, i), `& ${name.slice(i + 3)}`];
  }
  const words = name.split(' ');
  if (words.length < 2) return [name];
  const tail = Math.max(1, Math.ceil(words.length * 0.4));
  return [words.slice(0, words.length - tail).join(' '), words.slice(words.length - tail).join(' ')];
}

export const seasonLabel = (s: Season): string => t(`season.${s}`).toLocaleUpperCase();
