import { computed, signal } from '@preact/signals';
import { moreNotifs } from '../data/repo/notifs';
import { notifList } from './workspace';

/** Notifications page state (page-designs §10). */

export const nfSel = signal<number | undefined>(undefined);

/** The cached first page plus whatever "Load older" added. */
export const allNotifs = computed(() => {
  const first = notifList.value;
  const seen = new Set(first.map((n) => n.id));
  return [...first, ...moreNotifs.value.filter((n) => !seen.has(n.id))];
});
