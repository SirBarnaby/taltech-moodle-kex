import type { MessageKey } from '../i18n';
import type { Binding } from '../lib/keys';
import { COURSE_TABS } from '../data/repo/mycourses';
import { storeOf, stepMcTab, toggleHide, toggleStar } from './mycourses';
import { go } from './navigate';
import { pinEdit } from './pins';
import { markEverythingRead, markNotifRead, manualOf, openFeedItem, pinFeedItem, rowFromRecent, selectFeed, setFeedTab, toggleDoneById } from './workspace';
import { undoLast } from './undo';
import { feed, feedSel, wsPreview } from '../state/workspace';
import { mcFilter, mcSel, mcSort, mcTab, matchesFilter, sortCourses, shownAccess } from '../state/mycourses';
import { readPins } from '../data/repo/pins';
import { unpinItem } from './pins';

/** Key bindings of the Workspace, the Pinned page and My courses (happy-path §1). All use the `workspace` scope. */

const d = (k: MessageKey): MessageKey => k;
const interactive = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('a[href], button, summary, iframe, select, input, textarea, [role="tab"]');
const idle = (): boolean => wsPreview.value === undefined;

function mk(group: Binding['group']) {
  return (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, when: Binding['when'] = idle): Binding => ({
    keys, scope: 'workspace', group, description, run, when,
  });
}

function focusRow(attr: 'data-kex-item' | 'data-kex-mc', key: string | number): void {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[${attr}="${key}"]`)?.focus({ preventScroll: true }));
}

// ---------------------------------------------------------------- Workspace feed

function moveFeed(delta: 1 | -1): void {
  const list = feed.value;
  if (!list.length) return;
  const i = list.findIndex((x) => x.key === feedSel.value);
  const next = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i + delta)))];
  if (!next) return;
  selectFeed(next.key);
  focusRow('data-kex-item', next.key);
}

export const currentFeedItem = () => feed.value.find((x) => x.key === feedSel.value);

export function workspaceBindings(): Binding[] {
  const b = mk('Workspace');
  const cur = currentFeedItem;
  return [
    b('j', d('help.ws.move'), () => moveFeed(1)),
    b('k', d('help.ws.move'), () => moveFeed(-1)),
    b('arrowdown', d('help.ws.move'), () => moveFeed(1), (e) => idle() && !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-rows')),
    b('arrowup', d('help.ws.move'), () => moveFeed(-1), (e) => idle() && !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-rows')),
    b('1', d('help.ws.tabs'), () => setFeedTab('all')),
    b('2', d('help.ws.tabs'), () => setFeedTab('deadlines')),
    b('3', d('help.ws.tabs'), () => setFeedTab('updates')),
    b('enter', d('help.ws.open'), () => {
      const it = cur();
      if (it) openFeedItem(it);
    }, (e) => idle() && !interactive(e.target) && !!cur()),
    b('ctrl+enter', d('help.course.newtab'), () => {
      const it = cur();
      if (it) openFeedItem(it, true);
    }, (e) => idle() && !!cur() && !(e.target instanceof HTMLInputElement)),
    b('o', d('help.course.newtab'), () => {
      const it = cur();
      if (it) openFeedItem(it, true);
    }, () => idle() && !!cur()),
    b('space', d('help.course.preview'), () => {
      const it = cur();
      if (it?.type === 'continue') wsPreview.value = rowFromRecent(it.item);
    }, (e) => idle() && !interactive(e.target) && cur()?.type === 'continue'),
    b('p', d('help.course.pin'), () => {
      const it = cur();
      if (it) pinFeedItem(it);
    }, () => idle() && !!cur() && cur()?.type !== 'update'),
    b('x', d('help.course.done'), () => {
      const it = cur();
      if (it?.type === 'deadline' && it.item.cmid && manualOf(it.item.cmid)) void toggleDoneById(it.item.cmid);
    }),
    b('m', d('help.ws.read'), () => {
      const it = cur();
      if (it?.type === 'update' && !it.item.read) {
        void markNotifRead(it.item.id);
        // Keep the selection where it was.
      }
    }),
    b('shift+m', d('help.ws.readAll'), () => void markEverythingRead()),
    b('e', d('help.ws.edit'), () => (pinEdit.value = !pinEdit.value)),
    b('z', d('help.course.undo'), undoLast, () => true),
  ];
}

export function workspacePreviewBindings(): Binding[] {
  const p = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, guard: (e: KeyboardEvent) => boolean = () => true): Binding => ({
    keys, scope: 'preview', group: 'Course', description, run, when: (e) => wsPreview.value !== undefined && guard(e),
  });
  return [
    p('escape', d('help.escape'), () => (wsPreview.value = undefined)),
    p('enter', d('help.course.open'), () => {
      if (wsPreview.value) go(wsPreview.value.cm.url);
    }, (e) => !interactive(e.target)),
    p('p', d('help.course.pin'), () => {
      const v = wsPreview.value;
      const it = v && feed.value.find((x) => x.type === 'continue' && x.item.cmid === v.cm.id);
      if (it) pinFeedItem(it);
    }),
  ];
}

// ---------------------------------------------------------------- Pinned page

function moveRowIn(selector: string, delta: 1 | -1): void {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (!rows.length) return;
  const cur = rows.findIndex((r) => r === document.activeElement || r.contains(document.activeElement));
  const sel = rows.findIndex((r) => r.tabIndex === 0);
  const i = cur >= 0 ? cur : Math.max(0, sel);
  rows[Math.max(0, Math.min(rows.length - 1, cur < 0 ? i : i + delta))]?.focus({ preventScroll: true });
}

export function pinnedBindings(): Binding[] {
  const b = mk('Workspace');
  const rowEl = (): HTMLElement | null => document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-kex-pin]') : null;
  const pinOf = () => {
    const id = Number(rowEl()?.dataset.kexPin);
    return readPins().find((p) => p.cmid === id);
  };
  return [
    b('j', d('help.ws.move'), () => moveRowIn('.kex-prow', 1)),
    b('k', d('help.ws.move'), () => moveRowIn('.kex-prow', -1)),
    b('arrowdown', d('help.ws.move'), () => moveRowIn('.kex-prow', 1), (e) => !interactive(e.target) && !!rowEl()),
    b('arrowup', d('help.ws.move'), () => moveRowIn('.kex-prow', -1), (e) => !interactive(e.target) && !!rowEl()),
    b('enter', d('help.ws.open'), () => {
      const p = pinOf();
      if (p) go(p.url);
    }, (e) => !interactive(e.target) && !!pinOf()),
    b('ctrl+enter', d('help.course.newtab'), () => {
      const p = pinOf();
      if (p) go(p.url, true);
    }, () => !!pinOf()),
    b('o', d('help.course.newtab'), () => {
      const p = pinOf();
      if (p) go(p.url, true);
    }, () => !!pinOf()),
    b('e', d('help.ws.edit'), () => (pinEdit.value = !pinEdit.value)),
    b('x', d('help.pins.remove'), () => {
      const p = pinOf();
      if (p) void unpinItem(p.cmid);
    }, () => !!pinOf()),
    b('z', d('help.course.undo'), undoLast, () => true),
  ];
}

// ---------------------------------------------------------------- My courses

function visibleCourses() {
  const raw = storeOf(mcTab.value).value.value ?? [];
  return sortCourses(raw.filter((c) => matchesFilter(c, mcFilter.value)), mcSort.value, shownAccess.value);
}

/** Cards per row of the course grid (cards on the first row share their top edge). */
export function gridColumns(items: readonly { offsetTop: number }[]): number {
  const first = items[0];
  if (!first) return 1;
  const n = items.findIndex((el) => el.offsetTop !== first.offsetTop);
  return n < 0 ? items.length : Math.max(1, n);
}

function moveCourse(delta: 1 | -1, step = 1): void {
  const list = visibleCourses();
  if (!list.length) return;
  const i = list.findIndex((c) => c.id === mcSel.value);
  const next = list[Math.max(0, Math.min(list.length - 1, i < 0 ? 0 : i + delta * step))];
  if (!next) return;
  mcSel.value = next.id;
  focusRow('data-kex-mc', next.id);
}

export function mycoursesBindings(): Binding[] {
  const b = mk('Workspace');
  const cur = () => visibleCourses().find((c) => c.id === mcSel.value) ?? visibleCourses()[0];
  const out: Binding[] = [
    b('j', d('help.ws.move'), () => moveCourse(1)),
    b('k', d('help.ws.move'), () => moveCourse(-1)),
    // The courses are a grid: up and down move a row, left and right a card.
    b('arrowdown', d('help.ws.move'), () => moveCourse(1, gridColumns(Array.from(document.querySelectorAll<HTMLElement>('[data-kex-mc]')))), (e) => !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-mc')),
    b('arrowup', d('help.ws.move'), () => moveCourse(-1, gridColumns(Array.from(document.querySelectorAll<HTMLElement>('[data-kex-mc]')))), (e) => !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-mc')),
    b('arrowright', d('help.ws.move'), () => moveCourse(1), (e) => !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-mc')),
    b('arrowleft', d('help.ws.move'), () => moveCourse(-1), (e) => !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-mc')),
    b('enter', d('help.ws.open'), () => {
      const c = cur();
      if (c) go(c.url);
    }, (e) => !interactive(e.target) && !!cur()),
    b('ctrl+enter', d('help.course.newtab'), () => {
      const c = cur();
      if (c) go(c.url, true);
    }, (e) => !!cur() && !(e.target instanceof HTMLInputElement)),
    b('o', d('help.course.newtab'), () => {
      const c = cur();
      if (c) go(c.url, true);
    }, () => !!cur()),
    b('f', d('help.mc.filter'), (e) => {
      e.preventDefault();
      document.querySelector<HTMLElement>('[data-kex-test="mc-filter"]')?.focus({ preventScroll: true });
    }),
    b('s', d('help.mc.star'), () => {
      const c = cur();
      if (c) void toggleStar(c);
    }, () => !!cur()),
    b('shift+h', d('help.mc.hide'), () => {
      const c = cur();
      if (c) void toggleHide(c);
    }, () => !!cur()),
    b('z', d('help.course.undo'), undoLast, () => true),
  ];
  COURSE_TABS.forEach((_, i) => out.push(b(String(i + 1), d('help.mc.tabs'), () => stepMcTab(i + 1))));
  return out;
}
