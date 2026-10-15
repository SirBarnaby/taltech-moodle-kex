import { go, PAGES } from '../actions/navigate';
import { toggleEffects, toggleMotion, toggleTheme } from '../actions/theme';
import { displayName } from '../data/repo/courses';
import { readPins } from '../data/repo/pins';
import { findLogoutHref } from '../data/scrape/usermenu';
import { t } from '../i18n';
import { helpOpen, hooks, pageInfo, quickSettingsOpen, route, sidebarCourses } from '../state';
import type { Entry } from './index';

const logout = (): void => {
  const href = findLogoutHref(document);
  const info = pageInfo.value;
  // The link is read from the live DOM at click time; the sesskey is never stored.
  go(href ?? (info ? `${info.wwwroot}/login/logout.php?sesskey=${encodeURIComponent(info.sesskey)}` : '/login/logout.php'));
};

function pageEntries(): Entry[] {
  const pages: [string, string, string][] = [
    ['workspace', t('nav.workspace'), PAGES.workspace],
    ['pinned', t('nav.pinned'), PAGES.pinned],
    ['mycourses', t('nav.mycourses'), PAGES.mycourses],
    ['calendar', t('nav.calendar'), PAGES.calendar],
    ['grades', t('nav.grades'), PAGES.grades],
    ['notifications', t('nav.notifications'), PAGES.notifications],
    ['messages', t('nav.messages'), PAGES.messages],
    ['profile', t('nav.profile'), PAGES.profile],
    ['preferences', t('nav.preferences'), PAGES.preferences],
    ['files', t('nav.files'), PAGES.files],
  ];
  const root = pageInfo.value?.wwwroot ?? '';
  return pages.map(([id, title, path]) => ({
    id: `page:${id}`,
    type: 'page',
    title,
    url: root + path,
    keywords: [],
    meta: t('palette.kind.page'),
  }));
}

function actionEntries(): Entry[] {
  const list: Entry[] = [
    { id: 'action:theme', type: 'action', title: t('action.toggleTheme'), keywords: ['dark', 'light', 'tume', 'hele'], run: toggleTheme },
    { id: 'action:effects', type: 'action', title: t('action.toggleEffects'), keywords: ['shader', 'animation', 'ribbons'], run: toggleEffects },
    { id: 'action:motion', type: 'action', title: t('action.toggleMotion'), keywords: ['animation', 'reduced'], run: toggleMotion },
    { id: 'action:original', type: 'action', title: t('action.originalPage'), keywords: ['off', 'disable', 'moodle'], run: () => hooks.toggleOriginal() },
  ];
  if (hooks.isAppRoute() || route.value?.mode === 'app') {
    list.push({ id: 'action:layout', type: 'action', title: t('action.moodleLayout'), keywords: ['skin', 'classic'], run: () => hooks.moodleLayout() });
  }
  list.push(
    { id: 'action:help', type: 'action', title: t('action.shortcuts'), keywords: ['keys', 'help', '?'], run: () => (helpOpen.value = true) },
    { id: 'action:settings', type: 'action', title: t('action.settings'), keywords: ['preferences', 'options'], run: () => (quickSettingsOpen.value = true) },
    { id: 'action:logout', type: 'action', title: t('action.logout'), keywords: ['sign out', 'logi välja'], run: logout },
  );
  return list.map((a) => ({ ...a, meta: t('palette.kind.action') }));
}

/** The palette index, rebuilt each time the palette opens (courses, pins, language and route can all have changed). */
export function buildPaletteEntries(): Entry[] {
  const courses = sidebarCourses.value;
  const out: Entry[] = [];
  for (const p of readPins()) {
    out.push({
      id: `pin:${p.cmid}`, type: 'pin', title: p.title, subtitle: p.courseCode, courseCode: p.courseCode, courseId: p.courseId,
      url: p.url, kind: p.kind, format: p.format, keywords: [], pinned: true, cmId: p.cmid, meta: p.courseCode,
    });
  }
  for (const c of courses) {
    out.push({
      id: `course:${c.id}`,
      type: 'course',
      title: displayName(c),
      subtitle: c.alias ? c.name : undefined,
      courseCode: c.code,
      courseId: c.id,
      url: c.url,
      keywords: [c.fullname, c.shortname],
      meta: c.code,
    });
  }
  out.push(...pageEntries(), ...actionEntries());
  return out;
}
