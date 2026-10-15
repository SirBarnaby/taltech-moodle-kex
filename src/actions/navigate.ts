import { hash, pageInfo } from '../state';

/** Same-tab navigation, or a new tab with noopener. Relative URLs resolve against the Moodle root. */
export function go(url: string, newTab = false): void {
  const abs = new URL(url, pageInfo.value?.wwwroot ? pageInfo.value.wwwroot + '/' : location.href).href;
  if (newTab) {
    window.open(abs, '_blank', 'noopener');
    return;
  }
  // Same page, hash dropped (`/my/#pinned` -> `/my/`): switch in place, a plain assign would reload.
  const target = new URL(abs);
  if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search && target.hash === '' && location.hash !== '') {
    history.pushState(null, '', target.href);
    hash.value = '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.assign(abs);
}

export function homeUrl(path: string): string {
  const root = pageInfo.value?.wwwroot ?? '';
  return root + path;
}

export const PAGES = {
  workspace: '/my/',
  pinned: '/my/#pinned',
  deadlines: '/my/#deadlines',
  updates: '/my/#updates',
  mycourses: '/my/courses.php',
  calendar: '/calendar/view.php?view=month',
  grades: '/grade/report/overview/index.php',
  notifications: '/message/output/popup/notifications.php',
  messages: '/message/index.php',
  profile: '/user/profile.php',
  preferences: '/user/preferences.php',
  files: '/user/files.php',
} as const;
