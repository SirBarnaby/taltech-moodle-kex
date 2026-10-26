import { cache } from '../data/cache';
import type { Course } from '../data/model';
import { COURSE_TABS, hydrateLastAccess, invalidateCourseLists, lastAccess, loadLastAccess, setFavourite, setHidden, tabStore, type CoursesCtx, type CoursesTab } from '../data/repo/mycourses';
import type { MyoverviewGrouping } from '../data/scrape/myoverview';
import { lang, t } from '../i18n';
import { hash, pageInfo } from '../state';
import { mcFilter, mcHasArchived, mcSel, shownAccess } from '../state/mycourses';
import { nowSec } from '../state/workspace';
import { pushToast } from './toasts';
import { setUndo } from './undo';
import { changeView, navigation } from '../fx/transactions';

/** My courses actions (page-designs §4, happy-path §1). */

export function coursesCtx(): CoursesCtx {
  return {
    wwwroot: pageInfo.value?.wwwroot ?? '',
    lang: () => lang.value,
    customFieldName: () => cache.peek<MyoverviewGrouping>('myoverview')?.data.customfieldname,
  };
}

/** The order My courses shows while it is open (before its first paint): the last known one. */
export function prepareMyCourses(): void {
  hydrateLastAccess();
  shownAccess.value = lastAccess.peek();
  // Before the first paint too: an Archived tab added a frame later made the tab row wrap and pushed the cards down 68 px.
  mcHasArchived.value = !!coursesCtx().customFieldName();
}

export function initMyCourses(): () => void {
  nowSec.value = Math.floor(Date.now() / 1000);
  mcFilter.value = '';
  mcSel.value = undefined;
  void loadLastAccess(pageInfo.value?.userId ?? 0).then(() => {
    if (!shownAccess.peek().size) shownAccess.value = lastAccess.peek();
  });
  return () => undefined;
}

export function storeOf(tab: CoursesTab) {
  return tabStore(tab, coursesCtx());
}

export function setMcTab(tab: CoursesTab): void {
  const url = new URL(location.href);
  url.hash = tab === 'current' ? '' : `#${tab}`;
  changeView('filter', '.kex-mclist', () => {
    navigation.write(url, 'replace');
    hash.value = location.hash;
    mcSel.value = undefined;
  }, { ready: () => storeOf(tab).value.value !== undefined || storeOf(tab).status.value === 'error' });
}

export function stepMcTab(digit: number): void {
  const tabs = COURSE_TABS.filter((x) => x !== 'archived' || mcHasArchived.value);
  const tab = tabs[digit - 1];
  if (tab) setMcTab(tab);
}

/** Patch a course in every loaded tab list (optimistic update). */
function patch(id: number, fn: (c: Course) => Course | null): void {
  for (const tab of COURSE_TABS) {
    const s = storeOf(tab);
    const cur = s.value.value;
    if (!cur) continue;
    const next = cur.flatMap((c) => (c.id === id ? (fn(c) ? [fn(c) as Course] : []) : [c]));
    s.value.value = next;
  }
}

export async function toggleStar(course: Course): Promise<void> {
  const fav = !course.favourite;
  patch(course.id, (c) => ({ ...c, favourite: fav }));
  // Unstarring on the Starred tab removes the row.
  if (!fav) {
    const starred = storeOf('starred');
    starred.value.value = (starred.value.value ?? []).filter((c) => c.id !== course.id);
  }
  try {
    await setFavourite(course.id, fav);
  } catch {
    patch(course.id, (c) => ({ ...c, favourite: !fav }));
    pushToast(t('mc.starFailed'));
    return;
  }
  invalidateCourseLists();
}

export async function toggleHide(course: Course): Promise<void> {
  const hide = !course.hidden;
  const uid = pageInfo.value?.userId ?? 0;
  // Optimistic: Current, Starred, Upcoming and Past never list hidden courses; the Hidden tab lists only them.
  for (const tab of COURSE_TABS) {
    const s = storeOf(tab);
    const cur = s.value.value;
    if (!cur) continue;
    if (tab === 'hidden') s.value.value = hide ? [...cur, { ...course, hidden: true }] : cur.filter((c) => c.id !== course.id);
    else if (tab === 'all') s.value.value = cur.map((c) => (c.id === course.id ? { ...c, hidden: hide } : c));
    else if (hide) s.value.value = cur.filter((c) => c.id !== course.id);
  }
  try {
    await setHidden(course.id, uid, hide);
  } catch {
    invalidateCourseLists();
    pushToast(t('toast.failed'));
    return;
  }
  invalidateCourseLists();
  const undo = (): void => void toggleHide({ ...course, hidden: hide });
  setUndo(undo);
  pushToast(`${t(hide ? 'mc.hiddenToast' : 'mc.shownToast')} · ${t('toast.undo')} (z)`, { actionLabel: t('toast.undo'), onAction: undo });
}
