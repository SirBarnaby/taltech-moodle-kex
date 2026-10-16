import { effect } from '@preact/signals';
import { classifyFormat, classifyKind } from '../data/classify';
import { cmDetails, setManualDone } from '../data/repo/cmdetails';
import { countsStore } from '../data/repo/counts';
import { eventsStore } from '../data/repo/events';
import { typeNameFor } from '../data/repo/modnames';
import { markAllRead, markRead, notifsStore } from '../data/repo/notifs';
import { isPinned, readPins } from '../data/repo/pins';
import { recentStore, type RecentItem } from '../data/repo/recent';
import type { DueItem, Pin } from '../data/model';
import type { FeedItem } from '../data/feed';
import { verbFor } from '../data/classify';
import { eyebrow, type RowModel } from '../data/topics';
import { ws } from '../data/ws';
import { t } from '../i18n';
import { hash, search, settings } from '../state';
import { feed, feedSel, feedTab, nowSec, wsPreview } from '../state/workspace';
import { go } from './navigate';
import { pinItem } from './pins';
import { pushToast } from './toasts';
import { setUndo } from './undo';
import { log } from '../lib/log';

/** Workspace actions (page-designs §2, happy-path §2). Plain functions over src/state/workspace.ts. */

/** Until the user selects a row, the selection follows the first row of the feed (the order can change as data arrives). */
let touched = false;
export function selectFeed(key: string): void {
  touched = true;
  feedSel.value = key;
}

export function initWorkspace(): () => void {
  touched = false;
  feedSel.value = undefined;
  wsPreview.value = undefined;
  nowSec.value = Math.floor(Date.now() / 1000);
  const timer = window.setInterval(() => (nowSec.value = Math.floor(Date.now() / 1000)), 60_000);
  // One batched POST: deadlines, recent, notifications and counts (forced: returning from an assignment must show it as done).
  void Promise.all([eventsStore().refresh(true), recentStore().refresh(true), notifsStore().refresh(true), countsStore().refresh(true)]);
  let lastTab = feedTab.peek();
  const stop = effect(() => {
    // Keep the selected row valid; focus nothing automatically. A new tab (also through the URL hash) starts at its first row.
    if (feedTab.value !== lastTab) {
      lastTab = feedTab.value;
      touched = false;
    }
    const list = feed.value;
    const cur = feedSel.value;
    if (!list.length) feedSel.value = undefined;
    else if (!touched || cur === undefined || !list.some((i) => i.key === cur)) feedSel.value = list[0]?.key;
  });
  return () => {
    window.clearInterval(timer);
    stop();
  };
}

export function setFeedTab(tab: 'all' | 'deadlines' | 'updates'): void {
  const url = new URL(location.href);
  url.hash = tab === 'all' ? '' : `#${tab}`;
  history.replaceState(null, '', url);
  hash.value = location.hash;
  touched = false;
  feedSel.value = undefined;
}

/** Filter the Workspace to one course (or all of them) in place: the URL carries `?course=ID`, nothing is loaded. */
export function setWsCourse(id: number | undefined): void {
  const url = new URL(location.href);
  if (id === undefined) url.searchParams.delete('course');
  else url.searchParams.set('course', String(id));
  if (url.href === location.href) return;
  history.pushState({ kex: 1 }, '', url);
  search.value = location.search;
  touched = false;
  feedSel.value = undefined;
}

// ------------------------------------------------------------------ deriving rows and pins

export function dueKind(d: DueItem) {
  return classifyKind({ modname: d.modname, name: d.title });
}

export function pinFromDue(d: DueItem): Pin | undefined {
  if (!d.cmid) return undefined;
  const kind = dueKind(d);
  return {
    cmid: d.cmid, courseId: d.courseId, courseCode: d.courseCode, title: d.title, modname: d.modname, kind,
    format: classifyFormat({ modname: d.modname, name: d.title }, kind), url: d.url.split('&action=')[0] ?? d.url, addedAt: Date.now(),
  };
}

export function recentKind(r: RecentItem) {
  return classifyKind({ modname: r.modname, name: r.title, iconKey: r.iconKey });
}

export function pinFromRecent(r: RecentItem): Pin {
  const kind = recentKind(r);
  return {
    cmid: r.cmid, courseId: r.courseId, courseCode: r.courseCode, title: r.title, modname: r.modname, kind,
    format: classifyFormat({ modname: r.modname, name: r.title, iconKey: r.iconKey }, kind), url: r.url, addedAt: Date.now(),
  };
}

/** A RowModel for the preview sheet (it only needs the cm, title, label and kind). */
export function rowFromRecent(r: RecentItem): RowModel {
  const kind = recentKind(r);
  const format = classifyFormat({ modname: r.modname, name: r.title, iconKey: r.iconKey }, kind);
  return rowFrom({ cmid: r.cmid, courseId: r.courseId, title: r.title, modname: r.modname, url: r.url }, kind, format);
}

export function rowFromPin(p: Pin): RowModel {
  return rowFrom({ cmid: p.cmid, courseId: p.courseId, title: p.title, modname: p.modname, url: p.url }, p.kind, p.format);
}

function rowFrom(c: { cmid: number; courseId: number; title: string; modname: string; url: string }, kind: RowModel['kind'], format: RowModel['format']): RowModel {
  const typeName = typeNameFor(c.modname, cmDetails.value.get(c.cmid));
  return {
    cm: {
      id: c.cmid, courseId: c.courseId, sectionId: 0, sectionNumber: 0, name: c.title, modname: c.modname, url: c.url,
      uservisible: true, restricted: false, tracked: false,
    },
    kind, format, title: c.title, label: eyebrow(typeName), verb: verbFor(kind), locked: false, incomplete: false, typeName, provisional: false,
  };
}

// ------------------------------------------------------------------ opening and acting

export function itemUrl(item: FeedItem): string {
  if (item.type === 'deadline') return item.item.actionUrl ?? item.item.url;
  if (item.type === 'continue') return item.item.url;
  return item.item.contextUrl;
}

export function openFeedItem(item: FeedItem, newTab = false): void {
  const url = itemUrl(item);
  if (!url) return;
  if (item.type === 'update' && !item.item.read) void markNotifRead(item.item.id);
  const external = item.type === 'continue' && item.item.modname === 'url';
  go(url, newTab || (external && settings.value.openInNewTab !== 'never'));
}

export function markNotifRead(id: number): Promise<void> {
  return markRead(id).catch((e: unknown) => {
    log.warn('mark read failed', e);
    pushToast(t('toast.failed'));
  });
}

export async function markEverythingRead(): Promise<void> {
  try {
    await markAllRead();
    pushToast(t('toast.allRead'));
  } catch {
    pushToast(t('toast.failed'));
  }
}

export function pinFeedItem(item: FeedItem): void {
  const pin = item.type === 'deadline' ? pinFromDue(item.item) : item.type === 'continue' ? pinFromRecent(item.item) : undefined;
  if (pin) void pinItem(pin);
}

export const feedPinned = (item: FeedItem): boolean => (item.type === 'deadline' ? !!item.item.cmid && isPinned(item.item.cmid, readPins()) : item.type === 'continue' ? isPinned(item.item.cmid, readPins()) : false);

/** Manual completion state of a cm, when its details are known (a course page was opened before). */
export function manualOf(cmid: number | undefined): { done: boolean } | undefined {
  return cmid === undefined ? undefined : cmDetails.value.get(cmid)?.manual;
}

export async function toggleDoneById(cmid: number): Promise<void> {
  const cur = manualOf(cmid);
  if (!cur) return;
  const done = !cur.done;
  setManualDone(cmid, done);
  try {
    await ws.call('core_completion_update_activity_completion_status_manually', { cmid, completed: done });
  } catch (e) {
    log.warn('toggleDone', e);
    setManualDone(cmid, !done);
    pushToast(t('toast.failed'));
    return;
  }
  const run = (): void => void toggleDoneById(cmid);
  setUndo(run);
  pushToast(`${done ? t('toast.done') : t('toast.undone')} · ${t('toast.undo')} (z)`, { actionLabel: t('toast.undo'), onAction: run });
}

export function openCourse(courseId: number, url?: string): void {
  go(url ?? `/course/view.php?id=${courseId}`);
}
