import { computed, signal } from '@preact/signals';
import { formatDate } from '../i18n';
import type { Pin } from '../data/model';
import { cmDetails } from '../data/repo/cmdetails';
import type { CmEvent } from '../data/repo/courseevents';
import { cmsOfSection, type CourseState } from '../data/repo/coursestate';
import { modTypeNames } from '../data/repo/modnames';
import { pinsStore, rowPins } from '../data/repo/pins';
import type { NavTab } from '../data/scrape/secondarynav';
import { buildSectionView, buildTopics, type RowModel, type SectionView, type TopicModel } from '../data/topics';
import { buildTrack, type LabTrackItem } from '../data/labtrack';
import { detectCourseSeries, detectTopicSeries, WORK_MODS } from '../data/series';
import { recordError } from '../lib/log';
import { activeCourseId, settings } from './index';

/** State of the course view (page-designs §5). Written by src/actions/course.ts, read by src/ui/views/Course.tsx. */

export const courseState = signal<CourseState | undefined>(undefined);
/** 'loading' only while there is nothing cached to show. */
export const courseStatus = signal<'loading' | 'ready' | 'error'>('loading');
export const courseError = signal<string | undefined>(undefined);

/** The topic being read: the one at the top of the window (0 is section 0, when it is shown as the first topic). */
export const topicNumber = signal<number | undefined>(undefined);
export type FocusZone = 'topics' | 'rows';
export const focusZone = signal<FocusZone>('topics');
/** Selected row (cmid). */
export const selectedCmId = signal<number | undefined>(undefined);
/** cmid of the material shown in the preview sheet. */
export const previewCmId = signal<number | undefined>(undefined);

export const courseEvents = signal<ReadonlyMap<number, CmEvent>>(new Map());
/** The course's deadlines have arrived (or failed): until then a lab track without completion tracking cannot tell its next lab. */
export const courseEventsReady = signal(false);
export const tileImages = signal<ReadonlyMap<number, string>>(new Map());
/** Sanitized section summaries from the page DOM (or section.php), by section id. */
export const summaries = signal<ReadonlyMap<number, string>>(new Map());
/** Summaries fetched from section.php for sections Moodle's page did not hold (persisted per course). */
export const fetchedSummaries = signal<ReadonlyMap<number, string>>(new Map());
/** The course's own secondary navigation (Course, Participants, Grades, …) with Moodle's labels and URLs. */
export const secondaryNav = signal<readonly NavTab[]>([]);

const fmtDue = (ts: number): string =>
  formatDate(ts * 1000, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

export const topics = computed<TopicModel[]>(() => {
  const st = courseState.value;
  return st ? buildTopics(st, tileImages.value) : [];
});

export const currentTopic = computed<TopicModel | undefined>(() => topics.value.find((t) => t.section.number === topicNumber.value));

export const mergedSummaries = computed<ReadonlyMap<number, string>>(() => new Map([...fetchedSummaries.value, ...summaries.value]));

/** One topic of the course page: Moodle's rows and subsection cards in order, and the lab state of each subsection when they are a series of labs. */
export interface TopicBlock {
  topic: TopicModel;
  view: SectionView;
  /** Lab states by subsection id; undefined for an ordinary topic. */
  labs?: ReadonlyMap<number, LabTrackItem>;
}

/** Every topic of the course, in Moodle's order (round 10: the whole course is one page). */
export const courseBlocks = computed<TopicBlock[]>(() => {
  const st = courseState.value;
  if (!st) return [];
  const ctx = { state: st, details: cmDetails.value, events: courseEvents.value, fmtDue, typeNames: modTypeNames.value };
  const opts = { summaries: mergedSummaries.value, tiles: tileImages.value };
  const labsOn = settings.value.labsView !== 'off';
  const now = Math.floor(Date.now() / 1000);
  return topics.value.map((topic) => {
    const view = buildSectionView(topic.section, ctx, opts);
    let labs: ReadonlyMap<number, LabTrackItem> | undefined;
    if (labsOn) {
      try {
        // Only real subsections become labs: numbered rows stay in Moodle's order, as on Moodle's own page.
        const s = detectTopicSeries(view, topic.section);
        if (s?.shape === 'groups') labs = new Map(buildTrack(s.groups, now).map((i) => [i.group.section.id, i]));
      } catch (e) {
        recordError('series', e);
      }
    }
    return { topic, view, labs };
  });
});

/** Every row of the course in page order, subsection rows included (notes too). */
export const rows = computed<RowModel[]>(() => courseBlocks.value.flatMap((b) => b.view.rows));

/** Topics the reader folded (section ids), remembered per course. */
export const foldedTopics = signal<ReadonlySet<number>>(new Set());
/** Labs the reader opened or folded by hand (subsection id: open). Without a choice a finished lab is folded. */
export const labChoice = signal<ReadonlyMap<number, boolean>>(new Map());

export const labOpen = (id: number, item: LabTrackItem | undefined, choice: ReadonlyMap<number, boolean> = labChoice.value): boolean =>
  choice.get(id) ?? item?.state !== 'done';

/** Rows the keyboard can reach: rows of folded topics and folded labs are left out. */
export const visibleRows = computed<RowModel[]>(() => {
  const folded = foldedTopics.value;
  const choice = labChoice.value;
  const out: RowModel[] = [];
  for (const b of courseBlocks.value) {
    if (folded.has(b.topic.section.id)) continue;
    for (const block of b.view.blocks) {
      if (block.type === 'row') out.push(block.row);
      else if (!b.labs || labOpen(block.group.section.id, b.labs.get(block.group.section.id), choice)) out.push(...block.group.rows);
    }
  }
  return out;
});

/**
 * Courses whose topics are the series (one topic per lab, or a weeks-format course with work every week): done, overdue and next
 * marks for the topic chips, by section number. Empty for every other course.
 */
export const topicMarks = computed<ReadonlyMap<number, LabTrackItem['state']>>(() => {
  const st = courseState.value;
  const tps = topics.value;
  if (!st || !tps.length || settings.value.labsView === 'off') return new Map();
  try {
    const events = courseEvents.value;
    const info = tps.map((tp) => {
      const cms = cmsOfSection(st, tp.section);
      const tracked = cms.filter((c) => c.tracked);
      return {
        number: tp.section.number,
        title: tp.section.title,
        work: cms.some((c) => WORK_MODS.has(c.modname) || events.has(c.id)),
        done: tracked.length > 0 && tracked.every((c) => c.completion !== 0),
        overdue: cms.some((c) => events.get(c.id)?.overdue && (!c.tracked || c.completion === 0)),
      };
    });
    const members = detectCourseSeries(info);
    if (!members) return new Map();
    const marks = new Map<number, LabTrackItem['state']>();
    for (const n of members) {
      const t = info.find((i) => i.number === n);
      if (t) marks.set(n, t.done ? 'done' : t.overdue ? 'overdue' : 'todo');
    }
    const next = members.find((n) => marks.get(n) === 'todo');
    if (next !== undefined) marks.set(next, 'next');
    return marks;
  } catch (e) {
    recordError('series.course', e);
    return new Map();
  }
});

/** Pins for the PINNED row: this course first. */
export const pinnedRow = computed<Pin[]>(() => rowPins(pinsStore().value.value ?? [], activeCourseId.value));

/** cmids of every cm of a section number, for prefetching. */
export function cmIdsOfTopic(st: CourseState, number: number): number[] {
  const sec = st.sections.find((s) => s.number === number && !s.component);
  return sec ? cmsOfSection(st, sec).map((c) => c.id) : [];
}
