import { computed, signal } from '@preact/signals';
import type { EffectiveRoute } from '../content/router';
import type { PageInfo } from '../content/pageinfo';
import type { Course, UserInfo } from '../data/model';
import { applyAliases, orderCourses } from '../data/repo/courses';
import type { UserMenuItem } from '../data/scrape/usermenu';
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings';
import { prefersDark, resolveMotion, resolveTheme, sidebarModeFor } from '../lib/theme';

/** Central signal stores (architecture §11.4). Views read signals; actions are plain functions in src/actions. */

export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const pageInfo = signal<PageInfo | null>(null);
export const route = signal<EffectiveRoute | null>(null);
export const user = signal<UserInfo | undefined>(undefined);
export const userMenuItems = signal<UserMenuItem[]>([]);
export const ttLinks = signal<{ ois?: string; mail?: string }>({});
export const logoSrc = signal<string | undefined>(undefined);

/** Courses exactly as the data layer returned them. */
export const coursesRaw = signal<Course[]>([]);
export const coursesLoading = signal(true);

export const systemDark = signal(prefersDark());
/** `location.hash`, kept in a signal so views (tabs, Pinned) follow hash changes. */
export const hash = signal(typeof location === 'undefined' ? '' : location.hash);
export const viewportWidth = signal(typeof window === 'undefined' ? 1585 : window.innerWidth);

export const resolvedTheme = computed(() => {
  void systemDark.value; // re-evaluate when the OS preference flips
  return resolveTheme(settings.value.theme);
});
export const resolvedMotion = computed(() => resolveMotion(settings.value.motion));
export const sidebarMode = computed(() => sidebarModeFor(viewportWidth.value, settings.value.sidebarCollapsed));

export const sidebarCourses = computed<Course[]>(() =>
  applyAliases(orderCourses(coursesRaw.value, settings.value.courseOrder), settings.value.courseAliases),
);

/** The course whose page we are on (1 is the site front page). */
export const activeCourseId = computed<number | null>(() => {
  const id = pageInfo.value?.courseId ?? 0;
  return id > 1 ? id : null;
});

// Overlay and popover state.
export const paletteOpen = signal(false);
export const helpOpen = signal(false);
export const quickSettingsOpen = signal(false);
export const userMenuOpen = signal(false);
/** Rail sidebar expanded as an overlay, or the drawer opened (narrow viewports). */
export const sidebarOverlay = signal(false);

/** Header is in its compact (scrolled) state. */
export const headerCompact = signal(false);
/** Compact-title slot of the header; filled by the course view in M2. */
export const headerTitle = signal<{ chip?: string; text: string } | null>(null);

export interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  ms: number;
}
export const toasts = signal<ToastItem[]>([]);

/** Callbacks wired by the content controller so UI code never imports the controller. */
export interface ControllerHooks {
  toggleOriginal: () => void;
  openOptions: () => void;
  /** False for routes that cannot toggle (the shell is only mounted for skin/app routes). */
  isAppRoute: () => boolean;
  moodleLayout: () => void;
}
export const hooks: ControllerHooks = {
  toggleOriginal: () => undefined,
  openOptions: () => undefined,
  isAppRoute: () => false,
  moodleLayout: () => undefined,
};
