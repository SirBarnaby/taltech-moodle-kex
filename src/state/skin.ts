import { computed, signal } from '@preact/signals';
import type { SkinPage } from '../content/skinpage';
import { courseStateStore } from '../data/repo/coursestate';
import { neighboursOf, type Neighbours } from '../data/neighbours';
import { pageInfo, route } from './index';

/** State of the Skin+ chrome (PageChrome / ActivityChrome): what the band shows, read from Moodle's own page. */

export const skinPage = signal<SkinPage | undefined>(undefined);

/** Routes that get a band. Quiz attempts get none (focus mode: header only). */
export const chromeKeys: ReadonlySet<string> = new Set(['activity', 'grade-user', 'generic']);

export const hasChrome = computed(() => {
  const r = route.value;
  return r?.effective === 'skin' && chromeKeys.has(r.key) && skinPage.value?.error === undefined;
});

export const isActivity = computed(() => route.value?.key === 'activity' && !!pageInfo.value?.cmId);
export const isFocus = computed(() => route.value?.key === 'quiz-focus' && route.value.effective === 'skin');

/** Previous and next activity in reading order, from the cached course state (fetched once when missing). */
export const neighbours = computed<Neighbours | undefined>(() => {
  const info = pageInfo.value;
  if (!isActivity.value || !info?.cmId || info.courseId <= 1) return undefined;
  const st = courseStateStore(info.courseId).value.value;
  return st ? neighboursOf(st, info.cmId) : undefined;
});
