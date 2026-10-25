import { hooks, pageInfo } from '../state';

/** Same-tab navigation, or a new tab with noopener. Relative URLs resolve against the Moodle root. */
export function go(url: string, newTab = false): void {
  const abs = new URL(url, pageInfo.value?.wwwroot ? pageInfo.value.wwwroot + '/' : location.href).href;
  if (newTab) {
    window.open(abs, '_blank', 'noopener');
    return;
  }
  const target = new URL(abs);
  // App views open in place (no reload, the shell stays painted); everything else is a normal page load.
  if (hooks.navigate(target)) return;
  window.location.assign(abs);
}

export function homeUrl(path: string): string {
  const root = pageInfo.value?.wwwroot ?? '';
  return root + path;
}

export const PAGES = {
  workspace: '/my/?view=dossier',
  pinned: '/my/?view=dossier#pinned',
  deadlines: '/my/?view=dossier#deadlines',
  updates: '/my/?view=dossier#updates',
  mycourses: '/my/courses.php',
  calendar: '/calendar/view.php?view=month',
  grades: '/grade/report/overview/index.php',
  notifications: '/message/output/popup/notifications.php',
  messages: '/message/index.php',
  profile: '/user/profile.php',
  preferences: '/user/preferences.php',
  files: '/user/files.php',
} as const;
