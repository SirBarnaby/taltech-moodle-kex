import { cache, type Store } from '../cache';
import type { Cm, CompletionState, Section } from '../model';
import { decodeEntities } from '../../lib/sanitize';
import { ws } from '../ws';

/** Normalized `core_courseformat_get_state` (every course format) + the page-DOM extras we merge in. */
export interface CourseState {
  courseId: number;
  statekey: string;
  /** Moodle's label for the current section ("Current week"), when the format has one. */
  highlighted?: string;
  /** Sections in order, including section 0 and delegated (sub)sections. */
  sections: Section[];
  cms: Cm[];
  at: number;
}

interface RawState {
  course: { id: string | number; statekey?: string; highlighted?: string | null };
  section: RawSection[];
  cm: RawCm[];
}

interface RawSection {
  id: string | number;
  number?: number;
  section?: number;
  title?: string;
  rawtitle?: string | null;
  hassummary?: boolean;
  cmlist?: (string | number)[];
  visible?: boolean;
  uservisible?: boolean;
  current?: boolean;
  hasrestrictions?: boolean;
  sectionurl?: string;
  parentsectionid?: string | number | null;
  component?: string | null;
  itemid?: string | number | null;
}

interface RawCm {
  id: string | number;
  name?: string;
  module?: string;
  modname?: string;
  url?: string;
  sectionid?: string | number;
  sectionnumber?: number;
  uservisible?: boolean;
  visible?: boolean;
  hascmrestrictions?: boolean;
  istrackeduser?: boolean;
  completionstate?: number;
  hasdelegatedsection?: boolean;
  /** Moodle 4.5: the id of the section a subsection cm owns. */
  delegatesectionid?: string | number | null;
}

const num = (v: unknown): number => Number(v);

/** Pure normalization (unit-tested against a captured state). */
export function normalizeState(courseId: number, raw: RawState, now = Date.now()): CourseState {
  const sections: Section[] = raw.section.map((s) => {
    const number = s.number ?? s.section ?? 0;
    const title = s.rawtitle ? s.rawtitle : decodeEntities(s.title ?? '');
    return {
      id: num(s.id),
      number,
      title: title.trim(),
      url: s.sectionurl ?? '',
      visible: s.visible !== false && s.uservisible !== false,
      current: !!s.current,
      restricted: !!s.hasrestrictions,
      hasSummary: !!s.hassummary,
      cmIds: (s.cmlist ?? []).map(num),
      parentId: s.parentsectionid ? num(s.parentsectionid) : null,
      component: s.component || undefined,
      itemid: s.itemid ? num(s.itemid) : undefined,
    };
  });
  const cms: Cm[] = raw.cm.map((c) => ({
    id: num(c.id),
    courseId,
    sectionId: num(c.sectionid),
    sectionNumber: c.sectionnumber ?? 0,
    name: decodeEntities(c.name ?? ''),
    modname: c.module ?? (c.modname ?? '').toLowerCase(),
    url: c.url ?? '',
    uservisible: c.uservisible !== false,
    restricted: !!c.hascmrestrictions,
    tracked: c.completionstate !== undefined && c.istrackeduser !== false,
    completion: c.completionstate === undefined ? undefined : (c.completionstate as CompletionState),
    delegatedSectionId: c.delegatesectionid ? num(c.delegatesectionid) : undefined,
  }));
  return {
    courseId,
    statekey: raw.course.statekey ?? '',
    highlighted: raw.course.highlighted ?? undefined,
    sections,
    cms,
    at: now,
  };
}

export async function fetchCourseState(courseId: number): Promise<CourseState> {
  const json = await ws.call<string>('core_courseformat_get_state', { courseid: courseId });
  const raw = JSON.parse(json) as RawState;
  return normalizeState(courseId, raw);
}

const stores = new Map<number, Store<CourseState>>();

/** TTL 0: always revalidate in the background, render the cached copy first (architecture §8.5). */
export function courseStateStore(courseId: number): Store<CourseState> {
  let s = stores.get(courseId);
  if (!s) {
    s = cache.swr<CourseState>(`state:${courseId}`, 0, () => fetchCourseState(courseId));
    stores.set(courseId, s);
  }
  return s;
}

const norm = (v: string): string => v.replace(/\s+/g, ' ').trim().toLowerCase();

/** Moodle's default name for section 0 ("General" / "Üldine"); anything else is a title the teacher chose. */
const DEFAULT_TITLE_RE = /^(?:general|üldine)$/i;

/** Section 0 itself (never a delegated section, which may also carry number 0 on some builds). */
export function section0(state: CourseState): Section | undefined {
  return state.sections.find((s) => s.number === 0 && !s.component);
}

/**
 * Section 0 when it has something to show (a custom title, a summary or visible activities): it then becomes
 * the first topic under Moodle's own title (e.g. "House Rules"). An untouched, empty "General" stays out.
 */
export function promotedSection0(state: CourseState): Section | undefined {
  const s = section0(state);
  if (!s || !s.visible) return undefined;
  const byId = new Map(state.cms.map((c) => [c.id, c]));
  const hasCms = s.cmIds.some((id) => byId.get(id)?.uservisible);
  const customTitle = !!s.title && !DEFAULT_TITLE_RE.test(s.title);
  return s.hasSummary || hasCms || customTitle ? s : undefined;
}

/** A topic is a visible top-level section; delegated subsections belong to their parent cm. Section 0 leads when promoted. */
export function topicSections(state: CourseState): Section[] {
  const rest = state.sections.filter((s) => s.number > 0 && s.visible && !s.component);
  const first = promotedSection0(state);
  return first ? [first, ...rest] : rest;
}

const subsectionCache = new WeakMap<CourseState, Map<number, Section>>();

/**
 * The delegated section each subsection cm owns. Moodle 4.5 gives `cm.delegatesectionid`; when it is missing
 * (older states, cached copies) the section is found by component and title, then by the legacy `itemid`.
 * `section.itemid` is the subsection *instance* id on 4.5, so it cannot be compared with the cm id there.
 */
export function subsectionMap(state: CourseState): Map<number, Section> {
  const hit = subsectionCache.get(state);
  if (hit) return hit;
  const out = new Map<number, Section>();
  const byId = new Map(state.sections.map((s) => [s.id, s]));
  const claimed = new Set<number>();
  const subCms = state.cms.filter((c) => c.modname === 'subsection' || c.delegatedSectionId);
  for (const cm of subCms) {
    const sec = cm.delegatedSectionId ? byId.get(cm.delegatedSectionId) : undefined;
    if (sec) {
      out.set(cm.id, sec);
      claimed.add(sec.id);
    }
  }
  const delegated = state.sections.filter((s) => s.component === 'mod_subsection' && !claimed.has(s.id));
  for (const cm of subCms) {
    if (out.has(cm.id)) continue;
    const name = norm(cm.name);
    const pool = delegated.filter((s) => !claimed.has(s.id));
    const sec =
      pool.find((s) => s.parentId === ownerSectionId(state, cm) && norm(s.title) === name) ??
      pool.find((s) => norm(s.title) === name) ??
      pool.find((s) => s.itemid === cm.id);
    if (sec) {
      out.set(cm.id, sec);
      claimed.add(sec.id);
    }
  }
  subsectionCache.set(state, out);
  return out;
}

const ownerSectionId = (state: CourseState, cm: Cm): number => cm.sectionId || state.sections.find((s) => s.cmIds.includes(cm.id))?.id || 0;

/** The cms of a section (visible ones only), in order. Subsection cms expand into their own section's cms (flagged). */
export interface SectionCm extends Cm {
  /** Set for cms that come from a delegated subsection: the subsection title. */
  group?: string;
  /** Id of that delegated section. */
  groupId?: number;
}

/** What a section holds, in order: plain cms and subsections (the cm plus its delegated section and visible cms). */
export type SectionItem =
  | { type: 'cm'; cm: SectionCm }
  | { type: 'sub'; cm: Cm; section: Section; cms: SectionCm[] };

export function itemsOfSection(state: CourseState, section: Section): SectionItem[] {
  const byId = new Map(state.cms.map((c) => [c.id, c]));
  const subs = subsectionMap(state);
  const out: SectionItem[] = [];
  for (const id of section.cmIds) {
    const cm = byId.get(id);
    if (!cm || !cm.uservisible) continue;
    const sub = cm.modname === 'subsection' || cm.delegatedSectionId ? subs.get(cm.id) : undefined;
    if (!sub) {
      // A subsection we cannot resolve stays reachable as a plain link.
      out.push({ type: 'cm', cm });
      continue;
    }
    const cms: SectionCm[] = [];
    for (const sid of sub.cmIds) {
      const c = byId.get(sid);
      if (c?.uservisible) cms.push({ ...c, group: sub.title || cm.name, groupId: sub.id });
    }
    out.push({ type: 'sub', cm, section: sub, cms });
  }
  return out;
}

/** Every visible cm of a section in order, subsection cms flattened in place of their container. */
export function cmsOfSection(state: CourseState, section: Section): SectionCm[] {
  return itemsOfSection(state, section).flatMap((it) => (it.type === 'cm' ? [it.cm] : it.cms));
}

/** The topic number a cm is shown under (a subsection cm belongs to the topic holding its container). */
export function topicNumberOfCm(state: CourseState, cm: Cm): number | undefined {
  const sec = state.sections.find((s) => s.id === cm.sectionId);
  if (!sec) return cm.sectionNumber > 0 ? cm.sectionNumber : undefined;
  if (!sec.component) return topicSections(state).some((t) => t.id === sec.id) ? sec.number : undefined;
  for (const [cmId, delegated] of subsectionMap(state)) {
    if (delegated.id !== sec.id) continue;
    const owner = state.cms.find((c) => c.id === cmId);
    return owner ? topicNumberOfCm(state, owner) : undefined;
  }
  return undefined;
}
