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

/** A topic is a top-level section other than section 0; delegated subsections belong to their parent cm. */
export function topicSections(state: CourseState): Section[] {
  return state.sections.filter((s) => s.number > 0 && s.visible && !s.component);
}

export function section0(state: CourseState): Section | undefined {
  return state.sections.find((s) => s.number === 0);
}

/** The cms of a section (visible ones only), in order. Subsection cms expand into their own section's cms (flagged). */
export interface SectionCm extends Cm {
  /** Set for cms that come from a delegated subsection: the subsection title. */
  group?: string;
}

export function cmsOfSection(state: CourseState, section: Section): SectionCm[] {
  const byId = new Map(state.cms.map((c) => [c.id, c]));
  const out: SectionCm[] = [];
  for (const id of section.cmIds) {
    const cm = byId.get(id);
    if (!cm || !cm.uservisible) continue;
    if (cm.modname === 'subsection') {
      const sub = state.sections.find((s) => s.itemid === cm.id);
      if (sub) {
        for (const sid of sub.cmIds) {
          const c = byId.get(sid);
          if (c?.uservisible) out.push({ ...c, group: sub.title || cm.name });
        }
      }
      continue;
    }
    out.push(cm);
  }
  return out;
}
