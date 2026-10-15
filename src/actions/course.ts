import { effect } from '@preact/signals';
import { cache } from '../data/cache';
import type { TabKey } from '../data/classify';
import type { Pin } from '../data/model';
import { hydrateDetails, loadDetails, setManualDone, staleIds } from '../data/repo/cmdetails';
import { courseEventsStore } from '../data/repo/courseevents';
import { courseStateStore, type CourseState } from '../data/repo/coursestate';
import { addPin, isPinned, readPins, removePin, restorePin } from '../data/repo/pins';
import { isRecentUi, readCourseUi, writeCourseUi } from '../data/repo/ui';
import type { Tile } from '../data/scrape/tiles';
import { deadlineTopic, incompleteTopic, initialTopic, parseTopicHash, type RowModel } from '../data/topics';
import { ws } from '../data/ws';
import { t } from '../i18n';
import { log } from '../lib/log';
import {
  hooks, pageInfo, settings, sidebarCourses,
} from '../state';
import {
  courseError, courseEvents, courseState, courseStatus, focusZone, infoOpen, previewCmId, rows, selectedCmId, tab, tileImages, topicNumber, topics,
} from '../state/course';
import { go } from './navigate';
import { pushToast } from './toasts';

/** Course-page actions (architecture §11.4): plain functions over the signals in src/state/course.ts. */

let courseId = 0;
let stops: (() => void)[] = [];
let lastPush = 0;
let prefetchTimer: number | undefined;

const PUSH_COALESCE_MS = 700;

// -------------------------------------------------------------------- init

export function topicHash(n: number): string {
  return `#topic-${n}`;
}

function urlTopicRequest(state: CourseState): number | undefined {
  const fromHash = parseTopicHash(location.hash);
  if (fromHash !== undefined) return fromHash;
  const anchor = /^#section-(\d+)$/.exec(location.hash)?.[1];
  if (anchor) return Number(anchor);
  const q = new URLSearchParams(location.search);
  const sectionParam = q.get('section');
  if (sectionParam && /^\d+$/.test(sectionParam)) return Number(sectionParam);
  if (location.pathname.endsWith('/course/section.php')) {
    const sid = Number(q.get('id'));
    return state.sections.find((s) => s.id === sid)?.number;
  }
  return undefined;
}

/** Choose the starting topic (once per page load) with the rules of happy-path §3.3. */
function pickStart(state: CourseState): void {
  if (topicNumber.value !== undefined || infoOpen.value) return;
  const tps = topics.value;
  const ui = readCourseUi(courseId);
  const fromUrl = urlTopicRequest(state);
  if (fromUrl === 0) {
    infoOpen.value = true;
    return;
  }
  const n = initialTopic({
    topics: tps,
    fromUrl,
    ui,
    deadlineTopic: deadlineTopic(state, [...courseEvents.value.values()]),
    incompleteTopic: incompleteTopic(state),
  });
  if (isRecentUi(ui) && ui?.tab) tab.value = ui.tab;
  if (n !== undefined) topicNumber.value = n;
}

export function initCourse(id: number, tiles: readonly Tile[] = []): () => void {
  disposeCourse();
  courseId = id;
  courseState.value = undefined;
  courseStatus.value = 'loading';
  courseError.value = undefined;
  topicNumber.value = undefined;
  infoOpen.value = false;
  tab.value = 'all';
  focusZone.value = 'topics';
  selectedCmId.value = undefined;
  previewCmId.value = undefined;
  hydrateDetails(id);

  const cachedTiles = cache.peek<{ id: number; img: string }[]>(`tiles:${id}`)?.data ?? [];
  setTiles(cachedTiles.map((c) => [c.id, c.img]));
  if (tiles.length) setTileList(tiles);

  const store = courseStateStore(id);
  const events = courseEventsStore(id);
  stops = [
    effect(() => {
      const v = store.value.value;
      if (v) {
        courseState.value = v;
        courseStatus.value = 'ready';
      }
    }),
    effect(() => {
      if (store.status.value === 'error' && !store.value.value) {
        courseStatus.value = 'error';
        courseError.value = store.error.value?.message;
        // Page-designs §5: when the state cannot be loaded, show Moodle's own page inside the shell.
        hooks.moodleLayout();
        pushToast(t('toast.layout'));
      }
    }),
    effect(() => {
      const list = events.value.value ?? [];
      courseEvents.value = new Map(list.map((e) => [e.cmid, e]));
    }),
    effect(() => {
      const st = courseState.value;
      if (st) pickStart(st);
    }),
    // Details of the selected topic now, its neighbours next, the rest when idle.
    effect(() => {
      const st = courseState.value;
      const n = infoOpen.value ? 0 : topicNumber.value;
      if (!st || n === undefined) return;
      prefetchAround(st, n);
    }),
    effect(() => {
      // Keep the selected row valid.
      const list = rows.value;
      const cur = selectedCmId.value;
      if (!list.length) selectedCmId.value = undefined;
      else if (cur === undefined || !list.some((r) => r.cm.id === cur)) selectedCmId.value = list[0]?.cm.id;
    }),
  ];
  void store.refresh(true);
  void events.refresh();
  window.addEventListener('popstate', onPop);
  window.addEventListener('hashchange', onPop);
  return disposeCourse;
}

export function disposeCourse(): void {
  stops.forEach((s) => s());
  stops = [];
  window.removeEventListener('popstate', onPop);
  window.removeEventListener('hashchange', onPop);
  window.clearTimeout(prefetchTimer);
}

export function retryCourse(): void {
  courseStatus.value = courseState.value ? 'ready' : 'loading';
  void courseStateStore(courseId).refresh(true);
}

function onPop(): void {
  const st = courseState.value;
  if (!st) return;
  const n = parseTopicHash(location.hash);
  if (n !== undefined && topics.value.some((x) => x.section.number === n)) {
    infoOpen.value = false;
    topicNumber.value = n;
  }
}

function setTiles(entries: [number, string][]): void {
  tileImages.value = new Map(entries);
}

/** Tiles scraped from the page DOM (tiles format). Cached 7 days. */
export function setTileList(list: readonly Tile[]): void {
  const m = new Map<number, string>();
  for (const x of list) if (x.image) m.set(x.sectionId, x.image);
  tileImages.value = m;
  if (courseId && m.size) void cache.write(`tiles:${courseId}`, [...m].map(([id, img]) => ({ id, img })));
}

// -------------------------------------------------------------------- prefetch

function sectionOfCm(st: CourseState): (cmid: number) => number | undefined {
  const byCm = new Map(st.cms.map((c) => [c.id, c.sectionId]));
  return (id) => byCm.get(id);
}

function idsOfNumber(st: CourseState, n: number): number[] {
  const sec = st.sections.find((s) => s.number === n);
  if (!sec) return [];
  const ids: number[] = [];
  const byId = new Map(st.cms.map((c) => [c.id, c]));
  for (const id of sec.cmIds) {
    const cm = byId.get(id);
    if (!cm?.uservisible) continue;
    if (cm.modname === 'subsection') {
      const sub = st.sections.find((s) => s.itemid === cm.id);
      sub?.cmIds.forEach((x) => ids.push(x));
    } else {
      ids.push(id);
    }
  }
  return ids;
}

function prefetchAround(st: CourseState, n: number): void {
  const of = sectionOfCm(st);
  const here = idsOfNumber(st, n);
  if (staleIds(here).length) void loadDetails(courseId, here, of).catch((e: unknown) => log.warn('details', e));
  window.clearTimeout(prefetchTimer);
  prefetchTimer = window.setTimeout(() => {
    const order = topics.value.map((x) => x.section.number);
    const i = order.indexOf(n);
    const near = [order[i + 1], order[i - 1], order[i + 2], order[i - 2]].filter((x): x is number => x !== undefined);
    const rest = order.filter((x) => x !== n && !near.includes(x));
    const chunks = [...near, ...rest].map((x) => idsOfNumber(st, x));
    const run = (): void => {
      const next = chunks.shift();
      if (!next) return;
      const need = staleIds(next);
      const go2 = (): void => {
        if (!need.length) return run();
        void loadDetails(courseId, need, of).catch(() => undefined).finally(() => idle(run));
      };
      go2();
    };
    idle(run);
  }, 150);
}

function idle(fn: () => void): void {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 });
  else window.setTimeout(fn, 60);
}

// -------------------------------------------------------------------- topics and tabs

/** Switch topic. `user` navigations add a history entry (coalesced while the user keeps pressing j/k). */
export function setTopic(n: number, opts: { push?: boolean; focus?: boolean } = {}): void {
  if (!topics.value.some((x) => x.section.number === n)) return;
  performance.mark('kex:topic-switch');
  infoOpen.value = false;
  topicNumber.value = n;
  selectedCmId.value = undefined;
  writeCourseUi(courseId, { topic: n });
  const url = new URL(location.href);
  url.hash = topicHash(n);
  const now = Date.now();
  if (opts.push !== false && now - lastPush > PUSH_COALESCE_MS) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  lastPush = now;
  if (opts.focus) focusTopic(n);
}

export function showInfo(): void {
  infoOpen.value = true;
  selectedCmId.value = undefined;
  const url = new URL(location.href);
  url.hash = '';
  history.replaceState(null, '', url);
}

export function setTab(next: TabKey): void {
  tab.value = next;
  writeCourseUi(courseId, { tab: next });
}

export function moveTopic(delta: 1 | -1): void {
  const list = topics.value;
  if (!list.length) return;
  const i = list.findIndex((x) => x.section.number === topicNumber.value && !infoOpen.value);
  const next = i < 0 ? (delta === 1 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + delta));
  const target = list[next];
  if (target) setTopic(target.section.number, { focus: true });
}

export function moveRow(delta: 1 | -1): void {
  const list = rows.value.filter((r) => r.kind !== 'note');
  if (!list.length) return;
  const i = list.findIndex((r) => r.cm.id === selectedCmId.value);
  const next = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + delta));
  const target = list[next];
  if (target) {
    selectedCmId.value = target.cm.id;
    focusRow(target.cm.id);
  }
}

export function focusTopic(n: number): void {
  focusZone.value = 'topics';
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-topic="${n}"]`)?.focus({ preventScroll: false }));
}

export function focusRow(cmid: number): void {
  focusZone.value = 'rows';
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-row="${cmid}"]`)?.focus());
}

export function enterRows(): void {
  const list = rows.value.filter((r) => r.kind !== 'note');
  const target = list.find((r) => r.cm.id === selectedCmId.value) ?? list[0];
  if (target) {
    selectedCmId.value = target.cm.id;
    focusRow(target.cm.id);
  }
}

export function enterTopics(): void {
  const n = infoOpen.value ? topics.value[0]?.section.number : topicNumber.value;
  if (n !== undefined) focusTopic(n);
}

export function currentRow(): RowModel | undefined {
  return rows.value.find((r) => r.cm.id === selectedCmId.value);
}

// -------------------------------------------------------------------- row actions

/** URL modules open in a new tab by default (settings.openInNewTab). */
export function openCm(row: RowModel, newTab = false): void {
  const external = row.cm.modname === 'url';
  const pref = settings.value.openInNewTab;
  const tabbed = newTab || pref === 'always' || (pref === 'external' && external);
  go(row.cm.url, tabbed);
}

export function previewCm(row: RowModel): void {
  if (row.locked || row.kind === 'note') return;
  previewCmId.value = row.cm.id;
}

export function closePreview(): void {
  const id = previewCmId.value;
  previewCmId.value = undefined;
  if (id !== undefined) focusRow(id);
}

/** Next or previous material in the current list (preview navigation). */
export function stepPreview(delta: 1 | -1): void {
  const list = rows.value.filter((r) => r.kind !== 'note' && !r.locked);
  const i = list.findIndex((r) => r.cm.id === previewCmId.value);
  const target = list[Math.max(0, Math.min(list.length - 1, i + delta))];
  if (target) {
    previewCmId.value = target.cm.id;
    selectedCmId.value = target.cm.id;
  }
}

export function courseCode(): string {
  const c = sidebarCourses.value.find((x) => x.id === courseId);
  return c?.code ?? pageInfo.value?.heading.match(/[A-Z]{3}\d{4}/)?.[0] ?? '';
}

export function pinFromRow(row: RowModel): Pin {
  return {
    cmid: row.cm.id,
    courseId,
    courseCode: courseCode(),
    title: row.cm.name,
    modname: row.cm.modname,
    kind: row.kind,
    format: row.format,
    url: row.cm.url,
    addedAt: Date.now(),
  };
}

let undoFn: { run: () => void; at: number } | undefined;

export function undoLast(): void {
  if (!undoFn || Date.now() - undoFn.at > 5500) return;
  const u = undoFn;
  undoFn = undefined;
  u.run();
}

export async function togglePin(row: RowModel): Promise<void> {
  if (row.kind === 'note') return;
  const pins = readPins();
  if (isPinned(row.cm.id, pins)) {
    const idx = pins.findIndex((p) => p.cmid === row.cm.id);
    const gone = await removePin(row.cm.id);
    if (!gone) return;
    const run = (): void => void restorePin(gone, idx);
    undoFn = { run, at: Date.now() };
    pushToast(`${t('toast.unpinned')} · ${t('toast.undo')} (z)`, { actionLabel: t('toast.undo'), onAction: run });
    return;
  }
  const ok = await addPin(pinFromRow(row));
  if (!ok) {
    pushToast(t('toast.pinsFull'));
    return;
  }
  const run = (): void => void removePin(row.cm.id);
  undoFn = { run, at: Date.now() };
  pushToast(`${t('toast.pinned')} · ${t('toast.undo')} (z)`, { actionLabel: t('toast.undo'), onAction: run });
}

function setCompletion(cmid: number, done: boolean): void {
  setManualDone(cmid, done);
  const st = courseState.value;
  if (!st) return;
  const next: CourseState = { ...st, cms: st.cms.map((c) => (c.id === cmid ? { ...c, completion: done ? 1 : 0 } : c)) };
  courseState.value = next;
  courseStateStore(courseId).value.value = next;
}

export async function toggleDone(row: RowModel): Promise<void> {
  const manual = row.manual;
  if (!manual) return;
  const done = !manual.done;
  setCompletion(row.cm.id, done);
  try {
    await ws.call('core_completion_update_activity_completion_status_manually', { cmid: row.cm.id, completed: done });
    // Persist the optimistic state so a reload before the next revalidation does not flash the old one.
    if (courseState.value) void cache.write(`state:${courseId}`, courseState.value);
  } catch (e) {
    log.warn('toggleDone', e);
    setCompletion(row.cm.id, !done);
    pushToast(t('toast.failed'));
    return;
  }
  const run = (): void => void toggleDone({ ...row, manual: { done } });
  undoFn = { run, at: Date.now() };
  pushToast(`${done ? t('toast.done') : t('toast.undone')} · ${t('toast.undo')} (z)`, { actionLabel: t('toast.undo'), onAction: run });
}

export async function copyLink(row: RowModel): Promise<void> {
  try {
    await navigator.clipboard.writeText(row.cm.url);
    pushToast(t('toast.copied'));
  } catch {
    pushToast(t('toast.failed'));
  }
}

