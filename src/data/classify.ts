import type { Format, Kind } from './model';

/**
 * Classification rules (happy-path §6): kind, format (icon, thumb and verb selection), labels, title/subtitle split, button verb.
 * Matching is case-insensitive and Unicode-aware. `\b` fails on õäöü, so word starts use a lookbehind on letters and digits.
 */

const START = '(?<![\\p{L}\\p{N}])';
const re = (body: string): RegExp => new RegExp(`${START}(?:${body})`, 'iu');

export const LECTURE_RE = re('lecture|loeng|slaid|slide|presentation|esitlus|ettekanne|konspekt');
export const LAB_RE = re('lab(?:or|s)?(?![\\p{L}])|labor|praktikum|practic|harjutus|exercise|tutorial|workshop|seminar|homework|kodutöö|ülesanne|assignment|task|project|projekt');
export const RECORDING_RE = re('recording|salvestus|video|echo ?360|panopto|youtube|youtu\\.be|vimeo|stream|veebinar|webinar');
export const READING_RE = re('reading|lugemis|article|artikkel|paper|chapter|peatükk|reference|raamat');
export const PREFIX_RE = /^((?:lecture|loeng|practi(?:ce|cal)|praktikum|lab|labor|harjutus|exercise|seminar|tutorial|week|nädal|recording|salvestus|quiz|test|homework|kodutöö)\s*#?\d+[a-z]?)\s*[:—–\-|.]\s+(.+)$/iu;

const PRACTICAL_PREFIXES = new Set(['practice', 'practical', 'praktikum', 'lab', 'labor', 'harjutus', 'exercise', 'seminar', 'tutorial', 'homework', 'kodutöö']);
const LECTURE_PREFIXES = new Set(['lecture', 'loeng']);

export interface ClassifyInput {
  /** Plugin name: resource, url, page, assign, quiz, forum, label, … */
  modname: string;
  name: string;
  /** From the activity icon: `f/pdf`, `f/mpeg`, … (resources) or the module name. */
  iconKey?: string;
  /** Title of the section the cm sits in (used only as a tie-breaker). */
  sectionTitle?: string;
}

const CONTENT_MODS = new Set(['resource', 'url', 'page', 'book', 'folder', 'imscp', 'lesson', 'scorm']);

/** The word of a "Practice 6: …" prefix, lower-case ("practice"). */
function prefixWord(name: string): string | undefined {
  const m = PREFIX_RE.exec(name.trim());
  if (!m) return undefined;
  return /^[\p{L}]+/u.exec(m[1] ?? '')?.[0].toLowerCase();
}

/** The `f/<type>` part of an icon key, or undefined. */
export function iconFileType(iconKey = ''): string | undefined {
  return /(?:^|\/)f\/([a-z0-9_-]+)/i.exec(iconKey)?.[1]?.toLowerCase().replace(/-\d+$/, '');
}

const VIDEO_TYPES = new Set(['video', 'mpeg', 'quicktime', 'avi', 'wmv', 'mp4']);
const AUDIO_TYPES = new Set(['audio', 'mp3', 'wav']);
const IMAGE_TYPES = new Set(['image', 'jpeg', 'png', 'gif', 'bmp', 'svg']);

export function classifyKind(input: ClassifyInput): Kind {
  const { modname, name } = input;
  if (modname === 'label') return 'note';
  if (modname === 'assign' || modname === 'workshop') return 'assignment';
  if (modname === 'quiz') return 'quiz';
  if (modname === 'h5pactivity') return 'practical';
  if (modname === 'forum') return 'discussion';
  if (['feedback', 'choice', 'survey', 'questionnaire'].includes(modname)) return 'survey';
  if (['lti', 'bigbluebuttonbn', 'zoom'].includes(modname)) return RECORDING_RE.test(name) ? 'recording' : 'tool';
  if (!CONTENT_MODS.has(modname)) return 'tool';

  const file = iconFileType(input.iconKey);
  if (RECORDING_RE.test(name) || (file && (VIDEO_TYPES.has(file) || AUDIO_TYPES.has(file)))) return 'recording';
  const pw = prefixWord(name);
  if ((pw && PRACTICAL_PREFIXES.has(pw)) || LAB_RE.test(name)) return 'practical';
  if (LECTURE_RE.test(name) || (pw && LECTURE_PREFIXES.has(pw))) return 'lecture';
  if (READING_RE.test(name) || modname === 'book') return 'reading';
  const st = input.sectionTitle ?? '';
  if (st && LAB_RE.test(st)) return 'practical';
  if (st && RECORDING_RE.test(st)) return 'recording';
  return 'material';
}

export function classifyFormat(input: ClassifyInput, kind: Kind): Format {
  const { modname } = input;
  switch (modname) {
    case 'url':
      return kind === 'recording' ? 'VIDEO' : 'LINK';
    case 'lti':
    case 'bigbluebuttonbn':
    case 'zoom':
      return kind === 'recording' ? 'VIDEO' : 'TOOL';
    case 'page': return 'PAGE';
    case 'book': return 'BOOK';
    case 'folder': return 'FOLDER';
    case 'assign':
    case 'workshop': return 'ASSIGNMENT';
    case 'quiz': return 'QUIZ';
    case 'forum': return 'FORUM';
    case 'h5pactivity': return 'H5P';
    case 'feedback':
    case 'choice':
    case 'survey':
    case 'questionnaire': return 'SURVEY';
    case 'resource':
    case 'imscp':
    case 'lesson':
    case 'scorm':
      break;
    default:
      return 'TOOL';
  }
  const f = iconFileType(input.iconKey);
  if (!f) return kind === 'recording' ? 'VIDEO' : 'FILE';
  if (f === 'pdf') return 'PDF';
  if (f === 'powerpoint') return 'SLIDES';
  if (f === 'document') return 'DOC';
  if (f === 'spreadsheet') return 'SHEET';
  if (f === 'archive') return 'ZIP';
  if (VIDEO_TYPES.has(f)) return 'VIDEO';
  if (AUDIO_TYPES.has(f)) return 'AUDIO';
  if (IMAGE_TYPES.has(f)) return 'IMAGE';
  if (f === 'text') return 'TEXT';
  if (f === 'sourcecode' || f === 'html' || f === 'markdown') return 'CODE';
  return 'FILE';
}

const KIND_WORD: Record<Kind, string> = {
  lecture: 'LECTURE', recording: 'RECORDING', reading: 'READING', material: 'MATERIAL', practical: 'PRACTICAL',
  assignment: 'ASSIGNMENT', quiz: 'QUIZ', discussion: 'FORUM', survey: 'SURVEY', tool: 'TOOL', note: 'NOTE',
};

export const kindWord = (k: Kind): string => KIND_WORD[k];

/** "KIND / FORMAT"; assignments and quizzes use the status text (e.g. "DUE THU 15 OCT") when there is one. */
export function monoLabel(kind: Kind, format: Format, status?: string): string {
  const second = (kind === 'assignment' || kind === 'quiz') && status ? status.toUpperCase() : format;
  return `${KIND_WORD[kind]} / ${second}`;
}

export interface TitleParts {
  title: string;
  /** The prefix group ("Practice 6"), capitalised, when PREFIX_RE matched. */
  prefix?: string;
}

/** "Practice 6: Deploy a service" -> title "Deploy a service", prefix "Practice 6". */
export function splitName(name: string): TitleParts {
  const clean = name.replace(/\s+/g, ' ').trim();
  const m = PREFIX_RE.exec(clean);
  if (!m) return { title: clean };
  const prefix = (m[1] ?? '').trim();
  return { title: (m[2] ?? clean).trim(), prefix: prefix.charAt(0).toUpperCase() + prefix.slice(1) };
}

/** First sentence of a plain-text description, at most `max` characters. */
export function firstSentence(text: string, max = 90): string | undefined {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  const m = /^(.+?[.!?])(?:\s|$)/u.exec(t);
  const s = m?.[1] ?? t;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

export interface SubtitleInput {
  prefix?: string;
  dueText?: string;
  resourceDetails?: string;
  descriptionText?: string;
}

/** Subtitle: the prefix group, else due text, else file details, else the first description sentence. */
export function subtitleFor(i: SubtitleInput): string | undefined {
  if (i.prefix) return i.prefix;
  if (i.dueText) return i.dueText;
  if (i.resourceDetails) return i.resourceDetails;
  return i.descriptionText ? firstSentence(i.descriptionText) : undefined;
}

export type Verb = 'open' | 'watch' | 'submit';

export function verbFor(kind: Kind, opts: { assignOpen?: boolean } = {}): Verb {
  if (kind === 'recording') return 'watch';
  if (kind === 'assignment' && opts.assignOpen) return 'submit';
  return 'open';
}

const SUBTITLE_ORDER: { kind: Kind; word: string }[] = [
  { kind: 'lecture', word: 'lecture' },
  { kind: 'practical', word: 'practical work' },
  { kind: 'assignment', word: 'assignment' },
  { kind: 'quiz', word: 'quiz' },
  { kind: 'recording', word: 'recording' },
  { kind: 'reading', word: 'reading' },
  { kind: 'material', word: 'materials' },
  { kind: 'discussion', word: 'discussion' },
];

/** Topic subtitle (§6.9): "Lecture, practical work and recording". Empty when nothing counts. */
export function topicSubtitle(kinds: readonly Kind[], words: Partial<Record<Kind, string>> = {}, and = 'and'): string {
  const present = new Set(kinds);
  const parts = SUBTITLE_ORDER.filter((s) => present.has(s.kind)).map((s) => words[s.kind] ?? s.word);
  if (!parts.length) return '';
  const joined = parts.length === 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/** Resources counted in "N RESOURCES": everything except notes. */
export const countsAsResource = (k: Kind): boolean => k !== 'note';
