import { classifyFormat, classifyKind, countsAsResource, splitName, subtitleFor, topicSubtitle, verbFor, type Verb } from './classify';
import type { Cm, CmDetails, Format, Kind, Section } from './model';
import { cmsOfSection, itemsOfSection, topicNumberOfCm, topicSections, type CourseState, type SectionCm } from './repo/coursestate';
import { humanModname } from './repo/modnames';
import type { CmEvent } from './repo/courseevents';
import { isRecentUi, type CourseUi } from './repo/ui';
import { htmlToText, sanitizeHtml } from '../lib/sanitize';

/** View models for the course page: topics, rows, labels, the initial-topic rule (happy-path §3.3, §6). */

export interface RowModel {
  cm: SectionCm;
  kind: Kind;
  format: Format;
  title: string;
  subtitle?: string;
  /** Eyebrow: Moodle's own module name ("FILE"), plus the due text for assignments and quizzes. */
  label: string;
  /** Moodle's localised module name ("File", "Fail"). */
  typeName: string;
  verb: Verb;
  locked: boolean;
  availability?: string;
  /** Notes (label cms) render their sanitized HTML instead of a row. */
  noteHtml?: string;
  /** Manual completion state, when the cm has a manual toggle. */
  manual?: { done: boolean };
  /** Tracked and not complete. */
  incomplete: boolean;
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
  /** Section 0, shown first under Moodle's own title for it. */
  isIntro: boolean;
  tile?: string;
  cmIds: number[];
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');

const MONTH = '(?:\\p{L}{3,}\\.?)';
const RANGE_RE = new RegExp(`^\\s*(?:\\d{1,2}\\.?\\s+${MONTH}(?:\\s+\\d{4})?|${MONTH}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)\\s*[-–—]\\s*(?:\\d{1,2}\\.?\\s+${MONTH}|${MONTH}\\s+\\d{1,2})(?:,?\\s+\\d{4})?\\s*$`, 'u');

/** "12 October - 18 October" and "Oct 12 – Oct 18": the weeks format's default section names. */
export const isDateRange = (title: string): boolean => RANGE_RE.test(title);

const DUE_LABEL_RE = /due|close|closes|deadline|tähtaeg|sulgub|esita/i;

/** The due date of an event as "Thu 15 Oct", formatted by the caller; Moodle's own date label is preferred when the activity details are known. */
export function dueTextFromEvent(e: CmEvent, fmt: (ts: number) => string): string {
  return fmt(e.due);
}

const SHORT_DATE_RE = /(\p{L}{2,})\.?,?\s+(\d{1,2})\.?\s+(\p{L}{3,})/u;
const cap3 = (w: string): string => w.slice(0, 3).replace(/^./u, (c) => c.toUpperCase());

/** "Due Thu 10 Sep" from Moodle's own date line ("Due: Thursday, 10 September 2026, 5:38 PM"), keeping Moodle's label; the raw text when it has another shape. */
export function dueTextFromDates(dates: CmDetails['dates'] | undefined): string | undefined {
  const d = dates?.find((x) => DUE_LABEL_RE.test(x.label));
  if (!d) return undefined;
  const label = d.label.replace(/:\s*$/, '');
  const m = SHORT_DATE_RE.exec(d.text);
  if (!m) return d.text;
  return [label, `${cap3(m[1] ?? '')} ${m[2] ?? ''} ${cap3(m[3] ?? '')}`].filter(Boolean).join(' ');
}

export interface RowContext {
  state: CourseState;
  details: ReadonlyMap<number, CmDetails>;
  events: ReadonlyMap<number, CmEvent>;
  fmtDue: (ts: number) => string;
  /** Moodle's localised module names by modname (core_get_strings), used when a cm has no scraped type text. */
  typeNames?: ReadonlyMap<string, string>;
}

/** "FILE" or "ASSIGNMENT / TÄHTAEG NE 15 OKT": Moodle's module name, plus the due text for deadlines. Nothing invented. */
export function eyebrow(typeName: string, status?: string): string {
  return (status ? `${typeName} / ${status}` : typeName).toUpperCase();
}

function rowFor(cm: SectionCm, sectionTitle: string, ctx: RowContext): RowModel {
  const d = ctx.details.get(cm.id);
  const input = { modname: cm.modname, name: cm.name, iconKey: d?.iconKey, sectionTitle };
  const kind = classifyKind(input);
  const format = d?.format ?? classifyFormat(input, kind);
  const ev = ctx.events.get(cm.id);
  const { title, prefix } = splitName(cm.name);
  const dueText = dueTextFromDates(d?.dates) ?? (ev ? dueTextFromEvent(ev, ctx.fmtDue) : undefined);
  const isDeadline = kind === 'assignment' || kind === 'quiz';
  // The server state (get_state, revalidated on every load) wins over a cached rendering of the toggle.
  const manual = d?.manual ? { done: cm.completion === undefined ? d.manual.done : cm.completion !== 0 } : undefined;
  const incomplete = cm.tracked && (manual ? !manual.done : cm.completion === 0);
  const typeName = d?.typeName ?? ctx.typeNames?.get(cm.modname) ?? humanModname(cm.modname);
  return {
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
    typeName,
    label: eyebrow(typeName, isDeadline ? dueText : undefined),
    verb: verbFor(kind, { assignOpen: !!ev && !ev.overdue && ev.actionable !== false }),
    locked: cm.restricted && !cm.uservisible,
    availability: d?.availability,
    noteHtml: kind === 'note' ? d?.descriptionHtml : undefined,
    manual,
    incomplete,
    dueText,
    overdue: ev?.overdue,
    due: ev?.due,
    group: cm.group,
    provisional: !d,
  };
}

/** A subsection shown as a titled group card inside its parent topic. */
export interface GroupModel {
  section: Section;
  title: string;
  /** Sanitized Moodle HTML of the subsection's own summary. */
  summaryHtml?: string;
  tile?: string;
  rows: RowModel[];
  /** Tracked activities, and how many of them are complete. */
  total: number;
  done: number;
}

export type BlockModel = { type: 'row'; row: RowModel } | { type: 'group'; group: GroupModel };

export interface SectionView {
  /** What the detail pane renders, in order. */
  blocks: BlockModel[];
  /** Every row (subsection rows included) in display order, for keyboard navigation and prefetching. */
  rows: RowModel[];
}

export interface ViewOptions {
  /** Sanitized summary HTML by section id. */
  summaries?: ReadonlyMap<number, string>;
  tiles?: ReadonlyMap<number, string>;
}

export function buildSectionView(section: Section, ctx: RowContext, opts: ViewOptions = {}): SectionView {
  const blocks: BlockModel[] = [];
  const rows: RowModel[] = [];
  for (const item of itemsOfSection(ctx.state, section)) {
    if (item.type === 'cm') {
      const row = rowFor(item.cm, section.title, ctx);
      blocks.push({ type: 'row', row });
      rows.push(row);
      continue;
    }
    const groupRows = item.cms.map((cm) => rowFor(cm, item.section.title || item.cm.name, ctx));
    const tracked = groupRows.filter((r) => r.kind !== 'note' && r.cm.tracked);
    blocks.push({
      type: 'group',
      group: {
        section: item.section,
        title: item.section.title || item.cm.name,
        summaryHtml: opts.summaries?.get(item.section.id) || (item.section.summaryHtml ? sanitizeHtml(item.section.summaryHtml) : undefined),
        tile: opts.tiles?.get(item.section.id) ?? item.section.tileImage,
        rows: groupRows,
        total: tracked.length,
        done: tracked.filter((r) => !r.incomplete).length,
      },
    });
    rows.push(...groupRows);
  }
  return { blocks, rows };
}

/** The flat rows of a section (subsections expanded in place). */
export function buildRows(state: CourseState, section: Section, details: ReadonlyMap<number, CmDetails>, events: ReadonlyMap<number, CmEvent>, fmtDue: (ts: number) => string, typeNames?: ReadonlyMap<string, string>): RowModel[] {
  return buildSectionView(section, { state, details, events, fmtDue, typeNames }).rows;
}

export function buildTopics(state: CourseState, tiles: ReadonlyMap<number, string>): TopicModel[] {
  return topicSections(state).map((section) => {
    const cms = cmsOfSection(state, section);
    return {
      section,
      number: pad2(section.number),
      title: section.title || `Topic ${section.number}`,
      restricted: section.restricted && cms.length === 0,
      isRange: section.number > 0 && isDateRange(section.title),
      isIntro: section.number === 0,
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
  // Section 0 leads the list, but the course opens on its first numbered topic.
  return (i.topics.find((t) => t.section.number > 0) ?? i.topics[0])?.section.number;
}

/** (d) the topic of the nearest not-yet-overdue event. */
export function deadlineTopic(state: CourseState, events: readonly CmEvent[], now = Date.now() / 1000): number | undefined {
  const upcoming = events.filter((e) => !e.overdue && e.due >= now).sort((a, b) => a.due - b.due);
  for (const e of upcoming) {
    const cm = state.cms.find((c) => c.id === e.cmid);
    const n = cm ? topicNumberOfCm(state, cm) : undefined;
    if (n !== undefined) return n;
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
