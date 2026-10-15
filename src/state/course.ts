import { computed, signal } from '@preact/signals';
import type { TabKey } from '../data/classify';
import { formatDate } from '../i18n';
import type { Pin } from '../data/model';
import { cmDetails } from '../data/repo/cmdetails';
import type { CmEvent } from '../data/repo/courseevents';
import { cmsOfSection, section0, type CourseState } from '../data/repo/coursestate';
import { pinsStore, rowPins } from '../data/repo/pins';
import { buildRows, buildTopics, visibleRows, type RowModel, type TopicModel } from '../data/topics';
import { activeCourseId } from './index';

/** State of the course view (page-designs §5). Written by src/actions/course.ts, read by src/ui/views/Course.tsx. */

export const courseState = signal<CourseState | undefined>(undefined);
/** 'loading' only while there is nothing cached to show. */
export const courseStatus = signal<'loading' | 'ready' | 'error'>('loading');
export const courseError = signal<string | undefined>(undefined);

/** Selected topic number; ignored while `infoOpen`. */
export const topicNumber = signal<number | undefined>(undefined);
/** Course info (section 0) is shown in the detail pane. */
export const infoOpen = signal(false);
export const tab = signal<TabKey>('all');
export type FocusZone = 'topics' | 'rows';
export const focusZone = signal<FocusZone>('topics');
/** Selected row (cmid) inside the detail list. */
export const selectedCmId = signal<number | undefined>(undefined);
/** cmid of the material shown in the preview sheet. */
export const previewCmId = signal<number | undefined>(undefined);

export const courseEvents = signal<ReadonlyMap<number, CmEvent>>(new Map());
export const tileImages = signal<ReadonlyMap<number, string>>(new Map());
/** Sanitized section summaries from the page DOM, by section id. */
export const summaries = signal<ReadonlyMap<number, string>>(new Map());

const fmtDue = (ts: number): string =>
  formatDate(ts * 1000, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

export const topics = computed<TopicModel[]>(() => {
  const st = courseState.value;
  return st ? buildTopics(st, cmDetails.value, tab.value, tileImages.value) : [];
});

export const currentTopic = computed<TopicModel | undefined>(() => topics.value.find((t) => t.section.number === topicNumber.value));

/** Rows of the detail pane, unfiltered (notes included). */
export const allRows = computed<RowModel[]>(() => {
  const st = courseState.value;
  if (!st) return [];
  const section = infoOpen.value ? section0(st) : currentTopic.value?.section;
  if (!section) return [];
  return buildRows(st, section, cmDetails.value, courseEvents.value, tab.value, fmtDue);
});

export const rows = computed<RowModel[]>(() => visibleRows(allRows.value, tab.value));

/** Pins for the PINNED row: this course first. */
export const pinnedRow = computed<Pin[]>(() => rowPins(pinsStore().value.value ?? [], activeCourseId.value));

/** cmids of every cm of a section number, for prefetching. */
export function cmIdsOfTopic(st: CourseState, number: number): number[] {
  const sec = st.sections.find((s) => s.number === number);
  return sec ? cmsOfSection(st, sec).map((c) => c.id) : [];
}
