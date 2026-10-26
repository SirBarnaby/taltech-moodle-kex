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
import { buildTrack, defaultOpen, type LabTrackItem } from '../data/labtrack';
import { detectCourseSeries, detectTopicSeries, WORK_MODS, type TopicSeries } from '../data/series';
import { recordError } from '../lib/log';
import { activeCourseId, settings } from './index';

/** State of the course view (page-designs §5). Written by src/actions/course.ts, read by src/ui/views/Course.tsx. */

export const courseState = signal<CourseState | undefined>(undefined);
/** 'loading' only while there is nothing cached to show. */
export const courseStatus = signal<'loading' | 'ready' | 'error'>('loading');
export const courseError = signal<string | undefined>(undefined);

/** Selected topic number (0 is section 0, when it is shown as the first topic). */
export const topicNumber = signal<number | undefined>(undefined);
export type FocusZone = 'topics' | 'rows';
export const focusZone = signal<FocusZone>('topics');
/** Selected row (cmid) inside the detail list. */
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

const EMPTY_VIEW: SectionView = { blocks: [], rows: [] };

/** The selected topic as Moodle has it: rows and subsection group cards in order. */
const baseView = computed<SectionView>(() => {
  const st = courseState.value;
  const section = currentTopic.value?.section;
  if (!st || !section) return EMPTY_VIEW;
  return buildSectionView(
    section,
    { state: st, details: cmDetails.value, events: courseEvents.value, fmtDue, typeNames: modTypeNames.value },
    { summaries: mergedSummaries.value, tiles: tileImages.value },
  );
});

/** `courseId:sectionId`, the key of the reader's Labs or List choice. */
export const seriesKey = computed<string | undefined>(() => {
  const id = activeCourseId.value;
  const section = currentTopic.value?.section;
  return id && section ? `${id}:${section.id}` : undefined;
});

/** Topics whose board crashed in this page: they show the list (the error is in Details). */
export const boardFailed = signal<ReadonlySet<string>>(new Set());

/** The series of the selected topic (labs, numbered home assignments), when the detector is sure enough; never with labs off. */
export const topicSeries = computed<TopicSeries | null>(() => {
  const section = currentTopic.value?.section;
  if (!section || settings.value.labsView === 'off') return null;
  try {
    return detectTopicSeries(baseView.value, section);
  } catch (e) {
    recordError('series', e);
    return null;
  }
});

/** The board is on: the reader chose Labs for this topic, or did not choose and the detector is sure. */
export const seriesOn = computed<boolean>(() => {
  const s = topicSeries.value;
  const key = seriesKey.value;
  if (!s || !key || boardFailed.value.has(key)) return false;
  const choice = settings.value.seriesChoice[key];
  return choice ? choice === 'labs' : s.confidence === 'high';
});

/** The detail pane of the selected topic: Moodle's order, or numbered activities gathered into lab cards while the board is on. */
export const sectionView = computed<SectionView>(() => (seriesOn.value && topicSeries.value ? topicSeries.value.view : baseView.value));

/** Every row of the detail pane, subsection rows included (notes too). */
export const rows = computed<RowModel[]>(() => sectionView.value.rows);

/** The lab track of the selected topic while its board is on, else undefined (an ordinary topic). */
export const labTrack = computed<LabTrackItem[] | undefined>(() => {
  const s = topicSeries.value;
  if (!s || !seriesOn.value) return undefined;
  return buildTrack(s.groups, Math.floor(Date.now() / 1000));
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

/** Labs the user opened or folded in this topic; until then the next lab (and anything overdue) is open. */
export const openGroupsSet = signal<{ topic: number | undefined; ids: ReadonlySet<number> } | undefined>(undefined);

/**
 * Whether the track knows its next lab: once the deadlines are in (at once when they are cached). Completion alone is not
 * enough, since a past deadline makes a lab overdue and "next" skips it. Until then no lab is opened by default, so the first
 * lab does not open and then give way to the real next one a second later.
 */
export const labTrackSettled = computed(() => !labTrack.value || courseEventsReady.value);

export const openGroups = computed<ReadonlySet<number>>(() => {
  const track = labTrack.value;
  if (!track) return new Set();
  const chosen = openGroupsSet.value;
  if (chosen && chosen.topic === topicNumber.value) return chosen.ids;
  return labTrackSettled.value ? new Set(defaultOpen(track)) : new Set();
});

/** Rows the keyboard can reach: rows of folded labs are left out. */
export const visibleRows = computed<RowModel[]>(() => {
  const track = labTrack.value;
  if (!track) return rows.value;
  const open = openGroups.value;
  const hidden = new Set<number>();
  for (const item of track) if (!open.has(item.group.section.id)) item.group.rows.forEach((r) => hidden.add(r.cm.id));
  return rows.value.filter((r) => !hidden.has(r.cm.id));
});

/** Pins for the PINNED row: this course first. */
export const pinnedRow = computed<Pin[]>(() => rowPins(pinsStore().value.value ?? [], activeCourseId.value));

/** cmids of every cm of a section number, for prefetching. */
export function cmIdsOfTopic(st: CourseState, number: number): number[] {
  const sec = st.sections.find((s) => s.number === number && !s.component);
  return sec ? cmsOfSection(st, sec).map((c) => c.id) : [];
}
