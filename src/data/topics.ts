import { classifyFormat, classifyKind, countsAsResource, inTab, monoLabel, splitName, subtitleFor, topicSubtitle, verbFor, type TabKey, type Verb } from './classify';
import type { Cm, CmDetails, Format, Kind, Section } from './model';
import { cmsOfSection, topicSections, type CourseState, type SectionCm } from './repo/coursestate';
import type { CmEvent } from './repo/courseevents';
import { isRecentUi, type CourseUi } from './repo/ui';
import { htmlToText } from '../lib/sanitize';

/** View models for the course page: topics, rows, labels, the initial-topic rule (happy-path §3.3, §6). */

export interface RowModel {
  cm: SectionCm;
  kind: Kind;
  format: Format;
  title: string;
  subtitle?: string;
  /** "LECTURE / PDF" */
  label: string;
  verb: Verb;
  locked: boolean;
  availability?: string;
  /** Notes (label cms) render their sanitized HTML instead of a row. */
  noteHtml?: string;
  /** Manual completion state, when the cm has a manual toggle. */
  manual?: { done: boolean };
  /** Tracked and not complete. */
  incomplete: boolean;
  /** Matches the active tab. */
  inTab: boolean;
  /** Due/close text from the calendar event or the activity dates. */
  dueText?: string;
  overdue?: boolean;
  due?: number;
  /** Subsection group header to render before this row. */
  group?: string;
  /** True while the details are not loaded yet (the label shows the provisional classification). */
  provisional: boolean;
}

export interface TopicModel {
  section: Section;
  /** Zero-padded display number: "06". */
  number: string;
  title: string;
  restricted: boolean;
  /** The title is only a date range (weeks format): the UI shows "Week N" and keeps the range as a caption. */
  isRange: boolean;
  /** At least one row matches the active tab. */
  matches: boolean;
  tile?: string;
  cmIds: number[];
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');

const MONTH = '(?:\\p{L}{3,}\\.?)';
const RANGE_RE = new RegExp(`^\\s*(?:\\d{1,2}\\.?\\s+${MONTH}(?:\\s+\\d{4})?|${MONTH}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)\\s*[-–—]\\s*(?:\\d{1,2}\\.?\\s+${MONTH}|${MONTH}\\s+\\d{1,2})(?:,?\\s+\\d{4})?\\s*$`, 'u');

/** "12 October - 18 October" and "Oct 12 – Oct 18": the weeks format's default section names. */
export const isDateRange = (title: string): boolean => RANGE_RE.test(title);

const DUE_LABEL_RE = /due|close|closes|deadline|tähtaeg|sulgub|esita/i;

/** "Due Thu 15 Oct" from an event, formatted by the caller-provided formatter. */
export function dueTextFromEvent(e: CmEvent, fmt: (ts: number) => string): string {
  if (e.overdue) return 'Overdue';
  return `${e.modulename === 'quiz' ? 'Closes' : 'Due'} ${fmt(e.due)}`;
}

const SHORT_DATE_RE = /(\p{L}{2,})\.?,?\s+(\d{1,2})\.?\s+(\p{L}{3,})/u;
const cap3 = (w: string): string => w.slice(0, 3).replace(/^./u, (c) => c.toUpperCase());

/** "Due Thu 10 Sep" from Moodle's own date text ("Due: Thursday, 10 September 2026, 5:38 PM"); the raw text when it has another shape. */
export function dueTextFromDates(dates: CmDetails['dates'] | undefined): string | undefined {
  const d = dates?.find((x) => DUE_LABEL_RE.test(x.label));
  if (!d) return undefined;
  const m = SHORT_DATE_RE.exec(d.text);
  if (!m) return d.text;
  const word = /close|sulgub/i.test(d.label) ? 'Closes' : 'Due';
  return `${word} ${cap3(m[1] ?? '')} ${m[2] ?? ''} ${cap3(m[3] ?? '')}`;
}

export function buildRows(
  state: CourseState,
  section: Section,
  details: ReadonlyMap<number, CmDetails>,
  events: ReadonlyMap<number, CmEvent>,
  tab: TabKey,
  fmtDue: (ts: number) => string,
): RowModel[] {
  const rows: RowModel[] = [];
  for (const cm of cmsOfSection(state, section)) {
    const d = details.get(cm.id);
    const input = { modname: cm.modname, name: cm.name, iconKey: d?.iconKey, sectionTitle: section.title };
    const kind = classifyKind(input);
    const format = d?.format ?? classifyFormat(input, kind);
    const ev = events.get(cm.id);
    const { title, prefix } = splitName(cm.name);
    const dueText = ev ? dueTextFromEvent(ev, fmtDue) : dueTextFromDates(d?.dates);
    const isDeadline = kind === 'assignment' || kind === 'quiz';
    // The server state (get_state, revalidated on every load) wins over a cached rendering of the toggle.
    const manual = d?.manual ? { done: cm.completion === undefined ? d.manual.done : cm.completion !== 0 } : undefined;
    const incomplete = cm.tracked && (manual ? !manual.done : cm.completion === 0);
    rows.push({
      cm,
      kind,
      format,
      title: kind === 'note' ? cm.name : title,
      subtitle: kind === 'note' ? undefined : subtitleFor({
        prefix,
        dueText: isDeadline ? dueText : undefined,
        resourceDetails: d?.resourceDetails,
        descriptionText: d?.descriptionHtml ? htmlToText(d.descriptionHtml) : undefined,
      }),
      label: monoLabel(kind, format, isDeadline ? dueText : undefined),
      verb: verbFor(kind, { assignOpen: !!ev && !ev.overdue && ev.actionable !== false }),
      locked: cm.restricted && !cm.uservisible,
      availability: d?.availability,
      noteHtml: kind === 'note' ? d?.descriptionHtml : undefined,
      manual,
      incomplete,
      inTab: inTab(kind, tab),
      dueText,
      overdue: ev?.overdue,
      due: ev?.due,
      group: cm.group,
      provisional: !d,
    });
  }
  return rows;
}

/** Notes never count; they are not shown in the Lectures/Labs tabs either. */
export function visibleRows(rows: readonly RowModel[], tab: TabKey): RowModel[] {
  return rows.filter((r) => (tab === 'all' ? true : r.kind !== 'note' && r.inTab));
}

export function buildTopics(
  state: CourseState,
  details: ReadonlyMap<number, CmDetails>,
  tab: TabKey,
  tiles: ReadonlyMap<number, string>,
): TopicModel[] {
  return topicSections(state).map((section) => {
    const cms = cmsOfSection(state, section);
    const matches = tab === 'all' || cms.some((cm) => {
      const d = details.get(cm.id);
      const kind = classifyKind({ modname: cm.modname, name: cm.name, iconKey: d?.iconKey, sectionTitle: section.title });
      return kind !== 'note' && inTab(kind, tab);
    });
    return {
      section,
      number: pad2(section.number),
      title: section.title || `Topic ${section.number}`,
      restricted: section.restricted && cms.length === 0,
      isRange: isDateRange(section.title),
      matches,
      tile: tiles.get(section.id) ?? section.tileImage,
      cmIds: cms.map((c) => c.id),
    };
  });
}

export function resourceCount(rows: readonly RowModel[]): number {
  return rows.filter((r) => countsAsResource(r.kind)).length;
}

export function subtitleForRows(rows: readonly RowModel[], words: Partial<Record<Kind, string>>, and: string): string {
  return topicSubtitle(rows.map((r) => r.kind), words, and);
}

/** The primary (filled) button: first tracked-and-incomplete row, else the first row (§6.7). */
export function primaryIndex(rows: readonly RowModel[]): number {
  const i = rows.findIndex((r) => r.incomplete && r.kind !== 'note');
  if (i >= 0) return i;
  return rows.findIndex((r) => r.kind !== 'note');
}

/** `#topic-6` -> 6. */
export function parseTopicHash(hash: string): number | undefined {
  const m = /^#topic-(\d+)$/.exec(hash);
  return m ? Number(m[1]) : undefined;
}

export interface InitialInput {
  topics: readonly Pick<TopicModel, 'section'>[];
  /** (a) `#topic-N`, `section.php?id=` or Moodle's `#section-N`. */
  fromUrl?: number;
  /** (b) the saved UI memory. */
  ui?: CourseUi;
  /** (d) the topic number holding the nearest open deadline. */
  deadlineTopic?: number;
  /** (e) the first topic with an incomplete tracked activity. */
  incompleteTopic?: number;
  now?: number;
}

/** The first rule that applies (happy-path §3.3); always returns an existing topic number when there are topics. */
export function initialTopic(i: InitialInput): number | undefined {
  const has = (n: number | undefined): n is number => n !== undefined && i.topics.some((t) => t.section.number === n);
  if (has(i.fromUrl)) return i.fromUrl;
  if (isRecentUi(i.ui, i.now) && has(i.ui?.topic)) return i.ui?.topic;
  const current = i.topics.find((t) => t.section.current);
  if (current) return current.section.number;
  if (has(i.deadlineTopic)) return i.deadlineTopic;
  if (has(i.incompleteTopic)) return i.incompleteTopic;
  return i.topics[0]?.section.number;
}

/** (d) the topic of the nearest not-yet-overdue event. */
export function deadlineTopic(state: CourseState, events: readonly CmEvent[], now = Date.now() / 1000): number | undefined {
  const upcoming = events.filter((e) => !e.overdue && e.due >= now).sort((a, b) => a.due - b.due);
  for (const e of upcoming) {
    const cm = state.cms.find((c) => c.id === e.cmid);
    if (cm && cm.sectionNumber > 0) return cm.sectionNumber;
  }
  return undefined;
}

/** (e) first topic with an incomplete tracked cm. */
export function incompleteTopic(state: CourseState): number | undefined {
  for (const s of topicSections(state)) {
    const cms: Cm[] = cmsOfSection(state, s);
    if (cms.some((c) => c.tracked && c.completion === 0)) return s.number;
  }
  return undefined;
}
