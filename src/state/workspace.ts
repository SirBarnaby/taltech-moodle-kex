import { computed, signal } from '@preact/signals';
import { buildFeed, type FeedItem, type FeedTab } from '../data/feed';
import { countsStore } from '../data/repo/counts';
import { eventsStore } from '../data/repo/events';
import { notifsStore } from '../data/repo/notifs';
import { recentStore } from '../data/repo/recent';
import type { RowModel } from '../data/topics';
import { filterFeedByCourse, groupDeadlines } from '../lib/feedgroups';
import { hash, search, sidebarCourses } from './index';

/** Workspace state (page-designs §2). The tab lives in the URL hash. */

export const feedTab = computed<FeedTab>(() => (hash.value === '#deadlines' ? 'deadlines' : hash.value === '#updates' ? 'updates' : 'all'));

/** Seconds; refreshed once a minute while the Workspace is open so "in 2 days" and OVERDUE stay true. */
export const nowSec = signal(Math.floor(Date.now() / 1000));

/** Selected feed row key. */
export const feedSel = signal<string | undefined>(undefined);
export const feedFilter = signal('');
export const feedLimit = signal(24);
/** Material shown in the preview sheet (Continue rows and pins). */
export const wsPreview = signal<RowModel | undefined>(undefined);

export const dueList = computed(() => eventsStore().value.value ?? []);
export const recentList = computed(() => recentStore().value.value ?? []);
export const notifList = computed(() => notifsStore().value.value ?? []);
export const unreadCount = computed(() => countsStore().value.value?.notifs ?? notifList.value.filter((n) => !n.read).length);

/** The course the Workspace is filtered to (`/my/?course=ID`), or undefined for all courses. The filter lives in the URL and never navigates. */
export const wsCourse = computed<number | undefined>(() => {
  const v = new URLSearchParams(search.value).get('course');
  return v && /^\d+$/.test(v) ? Number(v) : undefined;
});

export const filteredFeed = computed<FeedItem[]>(() => {
  const all = buildFeed(feedTab.value, { due: dueList.value, recent: recentList.value, notifs: notifList.value, now: nowSec.value });
  const id = wsCourse.value;
  const code = id === undefined ? undefined : sidebarCourses.value.find((c) => c.id === id)?.code;
  const query = feedFilter.value.toLocaleLowerCase().trim();
  return groupDeadlines(filterFeedByCourse(all, id, code)).filter((entry) => {
    const item = entry.item;
    const title = entry.type === 'update' ? entry.item.subject : entry.item.title;
    return !query || `${title} ${item.courseCode ?? ''}`.toLocaleLowerCase().includes(query);
  });
});
export const feed = computed(() => filteredFeed.value.slice(0, feedLimit.value));

export const feedLoading = computed(() => {
  const nothing = eventsStore().value.value === undefined && notifsStore().value.value === undefined;
  return nothing && (eventsStore().status.value === 'loading' || eventsStore().status.value === 'idle');
});
export const feedError = computed(() => eventsStore().status.value === 'error');
