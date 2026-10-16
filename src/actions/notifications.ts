import { effect } from '@preact/signals';
import { countsStore } from '../data/repo/counts';
import { loadMoreNotifs, moreDone, moreNotifs, notifsStore, resetMoreNotifs } from '../data/repo/notifs';
import { log } from '../lib/log';
import type { MessageKey } from '../i18n';
import type { Binding } from '../lib/keys';
import { allNotifs, nfSel } from '../state/notifications';
import { go } from './navigate';
import { markEverythingRead, markNotifRead } from './workspace';

/** Notifications page actions and keys (page-designs §10, happy-path §3). */

const d = (k: MessageKey): MessageKey => k;
const interactive = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('a[href], button, summary, select, input, textarea, [role="tab"]');

export function initNotifications(): () => void {
  nfSel.value = undefined;
  resetMoreNotifs();
  void Promise.all([notifsStore().refresh(true), countsStore().refresh(true)]);
  // Keep the selection valid: it follows the first row until the reader picks one.
  const stop = effect(() => {
    const list = allNotifs.value;
    const cur = nfSel.peek();
    if (!list.length) nfSel.value = undefined;
    else if (cur === undefined || !list.some((n) => n.id === cur)) nfSel.value = list[0]?.id;
  });
  return stop;
}

export function selectNotif(id: number): void {
  nfSel.value = id;
}

function move(delta: 1 | -1): void {
  const list = allNotifs.value;
  if (!list.length) return;
  const i = list.findIndex((n) => n.id === nfSel.value);
  const next = list[Math.max(0, Math.min(list.length - 1, i < 0 ? 0 : i + delta))];
  if (!next) return;
  nfSel.value = next.id;
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-nf="${next.id}"]`)?.focus());
  // Reaching the end of the loaded page pulls the next one.
  if (next === list[list.length - 1] && !moreDone.value) void loadMore();
}

export async function loadMore(): Promise<void> {
  try {
    await loadMoreNotifs();
  } catch (e) {
    log.warn('load older notifications failed', e);
  }
}

export function openNotif(id: number, newTab = false): void {
  const n = allNotifs.value.find((x) => x.id === id);
  if (!n) return;
  if (!n.read) void markNotifRead(n.id);
  if (n.contextUrl) go(n.contextUrl, newTab);
}

export function notificationsBindings(): Binding[] {
  const b = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, when: Binding['when'] = () => true): Binding => ({
    keys, scope: 'workspace', group: 'Workspace', description, run, when,
  });
  const onRow = (e: KeyboardEvent): boolean => !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-nfrow');
  return [
    b('j', d('help.nf.move'), () => move(1)),
    b('k', d('help.nf.move'), () => move(-1)),
    b('arrowdown', d('help.nf.move'), () => move(1), onRow),
    b('arrowup', d('help.nf.move'), () => move(-1), onRow),
    b('enter', d('help.ws.open'), () => {
      if (nfSel.value !== undefined) openNotif(nfSel.value);
    }, (e) => !interactive(e.target) || !!(e.target as Element | null)?.closest?.('.kex-nfrow')),
    b('ctrl+enter', d('help.course.newtab'), () => {
      if (nfSel.value !== undefined) openNotif(nfSel.value, true);
    }, (e) => nfSel.value !== undefined && !(e.target instanceof HTMLInputElement)),
    b('m', d('help.nf.read'), () => {
      if (nfSel.value !== undefined) void markNotifRead(nfSel.value);
    }),
    b('shift+m', d('help.nf.readAll'), () => void markEverythingRead()),
  ];
}

export { moreNotifs };
