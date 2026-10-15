import { classifyFormat, classifyKind } from '../data/classify';
import type { Pin } from '../data/model';
import { cmDetails } from '../data/repo/cmdetails';
import { courseStateStore } from '../data/repo/coursestate';
import { parseSkinPage } from '../content/skinpage';
import { SEL } from '../data/selectors';
import { t } from '../i18n';
import { qs } from '../lib/dom';
import { pageInfo, route, sidebarCourses } from '../state';
import { neighbours, skinPage } from '../state/skin';
import { go } from './navigate';
import { pinItem } from './pins';
import { pushToast } from './toasts';

/** Skin+ chrome actions (page-designs §0): pin, done, open in a new tab, download, previous and next activity. */

/** Re-read the chrome data from the live page. Call after DOMContentLoaded and whenever Moodle's JS changes the content. */
export function refreshSkinPage(): void {
  skinPage.value = parseSkinPage(document);
}

/** Watch the main region for changes (completion toggles, validation errors) and keep the band current. */
export function watchSkinPage(): () => void {
  refreshSkinPage();
  const target = document.querySelector('#page-content, #region-main, #page') ?? document.body;
  let timer = 0;
  const mo = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refreshSkinPage, 150);
  });
  mo.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-toggletype', 'aria-pressed'] });
  return () => {
    window.clearTimeout(timer);
    mo.disconnect();
  };
}

/** Kick off the course state fetch the bottom bar and the label need (cached for hours; usually already prefetched). */
export function loadNeighbourState(): void {
  const info = pageInfo.value;
  if (info && info.courseId > 1 && info.cmId) void courseStateStore(info.courseId).refresh();
}

export function pageUrl(): string {
  const info = pageInfo.value;
  const mod = route.value?.mod ?? 'resource';
  return info?.cmId ? `${info.wwwroot}/mod/${mod}/view.php?id=${info.cmId}` : location.href;
}

export function pinFromPage(): Pin | undefined {
  const info = pageInfo.value;
  const sp = skinPage.value;
  if (!info?.cmId || !sp) return undefined;
  const modname = route.value?.mod ?? 'resource';
  const kind = classifyKind({ modname, name: sp.title });
  const course = sidebarCourses.value.find((c) => c.id === info.courseId);
  return {
    cmid: info.cmId, courseId: info.courseId, courseCode: course?.code ?? '', title: sp.title, modname, kind,
    format: cmDetails.value.get(info.cmId)?.format ?? classifyFormat({ modname, name: sp.title }, kind), url: pageUrl(), addedAt: Date.now(),
  };
}

export function pinPage(): void {
  const p = pinFromPage();
  if (p) void pinItem(p);
}

/** Moodle's own completion button does the work (its JS then updates the page, and the band follows). */
export function toggleDonePage(): void {
  const btn = qs<HTMLElement>(document, SEL.cmManualDone);
  btn?.click();
}

export function openNewTab(): void {
  window.open(location.href, '_blank', 'noopener');
}

export function downloadUrl(): string | undefined {
  const f = skinPage.value?.fileUrl;
  if (!f) return undefined;
  try {
    const u = new URL(f, location.href);
    u.searchParams.set('forcedownload', '1');
    return u.href;
  } catch {
    return undefined;
  }
}

export function gotoNeighbour(dir: 1 | -1): void {
  const n = neighbours.value;
  const target = dir === 1 ? n?.next : n?.prev;
  if (target) go(target.cm.url);
  else pushToast(t(dir === 1 ? 'pn.noNext' : 'pn.noPrev'));
}
