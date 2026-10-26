import { go, PAGES } from '../actions/navigate';
import { toggleEffects, toggleMotion, toggleTheme } from '../actions/theme';
import { displayName } from '../data/repo/courses';
import { classifyFormat, classifyKind } from '../data/classify';
import { isPinned, readPins } from '../data/repo/pins';
import { cachedStates } from '../data/repo/prefetch';
import { topicSections } from '../data/repo/coursestate';
import { pad2 } from '../data/topics';
import { decodeEntities } from '../lib/sanitize';
import { findLogoutHref } from '../data/scrape/usermenu';
import { t } from '../i18n';
import { helpOpen, hooks, pageInfo, quickSettingsOpen, route, sidebarCourses } from '../state';
import type { Course } from '../data/model';
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
    ['achievements', t('nav.achievements'), PAGES.achievements],
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
  out.push(...topicAndMaterialEntries(courses), ...pageEntries(), ...actionEntries());
  return out;
}

/** Topics and materials of every sidebar course whose state is cached (the hourly idle prefetch fills them). */
function topicAndMaterialEntries(courses: readonly Course[]): Entry[] {
  const out: Entry[] = [];
  const pins = readPins();
  for (const st of cachedStates(courses.map((c) => c.id))) {
    const course = courses.find((c) => c.id === st.courseId);
    if (!course) continue;
    const titles = new Map(st.sections.map((sec) => [sec.id, decodeEntities(sec.title)]));
    for (const sec of topicSections(st)) {
      const title = decodeEntities(sec.title) || t('course.weekN', { n: sec.number });
      out.push({
        id: `topic:${course.id}:${sec.number}`, type: 'topic', title, courseCode: course.code, courseId: course.id,
        url: `${course.url}#topic-${sec.number}`, keywords: [], meta: t('palette.topicMeta', { code: course.code, n: pad2(sec.number) }),
      });
    }
    for (const cm of st.cms) {
      if (!cm.uservisible || cm.modname === 'label' || cm.modname === 'subsection' || !cm.name) continue;
      const name = decodeEntities(cm.name);
      const kind = classifyKind({ modname: cm.modname, name });
      out.push({
        id: `cm:${cm.id}`, type: 'cm', title: name, subtitle: titles.get(cm.sectionId) || undefined, courseCode: course.code, courseId: course.id,
        url: cm.url, kind, format: classifyFormat({ modname: cm.modname, name }, kind), modname: cm.modname, cmId: cm.id, keywords: [],
        pinned: isPinned(cm.id, pins), meta: course.code,
      });
    }
  }
  return out;
}
