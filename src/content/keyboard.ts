import { go, homeUrl, PAGES } from '../actions/navigate';
import { toggleSidebar, toggleTheme } from '../actions/theme';
import type { MessageKey } from '../i18n';
import { KeyManager, type Binding } from '../lib/keys';
import { helpOpen, hooks, paletteOpen, quickSettingsOpen, sidebarCourses, sidebarOverlay, userMenuOpen } from '../state';

/** The one keydown listener for the whole page (architecture §11.5). */
export const keyManager = new KeyManager(window);

/** Overlays that the global Esc closes. Popovers handle their own Esc (they also restore focus). */
function topOverlay(): 'palette' | 'help' | 'sidebar' | null {
  if (paletteOpen.value) return 'palette';
  if (helpOpen.value) return 'help';
  if (sidebarOverlay.value && !quickSettingsOpen.value && !userMenuOpen.value) return 'sidebar';
  return null;
}

function closeTopOverlay(): void {
  const top = topOverlay();
  if (top === 'palette') paletteOpen.value = false;
  else if (top === 'help') helpOpen.value = false;
  else if (top === 'sidebar') toggleSidebar(true);
}

function nthCourse(n: number): void {
  const c = sidebarCourses.value[n];
  if (c) go(c.url);
}

function stepCourse(delta: 1 | -1): void {
  const courses = sidebarCourses.value;
  if (!courses.length) return;
  const here = courses.findIndex((c) => location.search.includes(`id=${c.id}`) && location.pathname.includes('/course/'));
  const next = here < 0 ? (delta === 1 ? 0 : courses.length - 1) : (here + delta + courses.length) % courses.length;
  const c = courses[next];
  if (c) go(c.url);
}

export { toggleSidebar } from '../actions/theme';

const openPalette = (e: KeyboardEvent): void => {
  e.preventDefault();
  quickSettingsOpen.value = false;
  userMenuOpen.value = false;
  helpOpen.value = false;
  paletteOpen.value = true;
};

function d(key: MessageKey): MessageKey {
  return key;
}

export function globalBindings(): Binding[] {
  const nav = (keys: string, desc: MessageKey, path: string): Binding => ({
    keys, scope: 'global', group: 'Navigate', description: desc, run: () => go(homeUrl(path)),
  });
  const bindings: Binding[] = [
    { keys: 'ctrl+k', scope: 'global', group: 'General', description: d('help.palette'), allowInInput: true, run: openPalette },
    { keys: 'meta+k', scope: 'global', group: 'General', description: d('help.palette'), allowInInput: true, run: openPalette },
    { keys: '/', scope: 'global', group: 'General', description: d('help.palette'), run: openPalette },
    { keys: '?', scope: 'global', group: 'General', description: d('help.help'), run: () => {
      paletteOpen.value = false;
      helpOpen.value = !helpOpen.value;
    } },
    { keys: 't', scope: 'global', group: 'General', description: d('help.theme'), run: toggleTheme },
    { keys: 'ctrl+b', scope: 'global', group: 'General', description: d('help.sidebar'), allowInInput: true, run: (e) => {
      e.preventDefault();
      toggleSidebar(true);
    } },
    { keys: 'escape', scope: 'global', group: 'General', description: d('help.escape'), allowInInput: true, when: () => topOverlay() !== null,
      run: closeTopOverlay },
    nav('g w', 'help.go.workspace', PAGES.workspace),
    nav('g p', 'help.go.pinned', PAGES.pinned),
    nav('g m', 'help.go.mycourses', PAGES.mycourses),
    nav('g d', 'help.go.deadlines', PAGES.deadlines),
    nav('g u', 'help.go.updates', PAGES.updates),
    nav('g c', 'help.go.calendar', PAGES.calendar),
    nav('g r', 'help.go.grades', PAGES.grades),
    nav('g n', 'help.go.notifications', PAGES.notifications),
    nav('g s', 'help.go.messages', PAGES.messages),
    { keys: 'alt+1', scope: 'global', group: 'Course', description: d('help.course.nth'), allowInInput: true, run: () => nthCourse(0) },
    { keys: 'alt+arrowup', scope: 'global', group: 'Course', description: d('help.course.prevnext'), run: () => stepCourse(-1) },
    { keys: 'alt+arrowdown', scope: 'global', group: 'Course', description: d('help.course.prevnext'), run: () => stepCourse(1) },
  ];
  // Alt+2..9 are registered but listed once in the help ("Alt+1…9").
  for (let n = 2; n <= 9; n++) {
    bindings.push({ keys: `alt+${n}`, scope: 'global', group: 'Course', description: d('help.course.nth'), allowInInput: true, run: () => nthCourse(n - 1) });
  }
  return bindings;
}

/** Alt+Shift+O works in both KEX and off states, so it is registered outside the manager by the controller. */
export function isOriginalToggle(e: KeyboardEvent): boolean {
  return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key.toLowerCase() === 'o' || e.code === 'KeyO');
}

export function toggleOriginalFromKey(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopPropagation();
  hooks.toggleOriginal();
}
