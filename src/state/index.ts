import { computed, signal } from '@preact/signals';
import type { EffectiveRoute } from '../content/router';
import type { PageInfo } from '../content/pageinfo';
import type { Course, UserInfo } from '../data/model';
import { applyAliases, orderCourses } from '../data/repo/courses';
import { lang } from '../i18n';
import { schoolFor, type SchoolId } from '../lib/school';
import type { UserMenuItem } from '../data/scrape/usermenu';
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings';
import { prefersDark, prefersReducedMotion, resolveMotion, resolveTheme, sidebarModeFor } from '../lib/theme';

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
export const systemReducedMotion = signal(prefersReducedMotion());
/** `location.hash`, kept in a signal so views (tabs, Pinned) follow hash changes. */
export const hash = signal(typeof location === 'undefined' ? '' : location.hash);
export const viewportWidth = signal(typeof window === 'undefined' ? 1585 : window.innerWidth);

export const resolvedTheme = computed(() => {
  void systemDark.value; // re-evaluate when the OS preference flips
  return resolveTheme(settings.value.theme);
});
export const resolvedMotion = computed(() => {
  void systemReducedMotion.value;
  return resolveMotion(settings.value.motion);
});
export const sidebarMode = computed(() =>
  sidebarModeFor(viewportWidth.value, settings.value.sidebarCollapsed || (route.value?.key === 'quiz-focus' && route.value.effective === 'skin')),
);

/**
 * Courses as the sidebar shows them. The user's own aliases always apply; the shipped English short names (for the author's six courses)
 * only on an English UI, so Estonian course names stay exactly as Moodle delivers them.
 */
export const sidebarCourses = computed<Course[]>(() => {
  const ordered = orderCourses(coursesRaw.value, settings.value.courseOrder);
  const aliases = settings.value.courseAliases;
  if (lang.value === 'en') return applyAliases(ordered, aliases);
  return ordered.map((c) => (aliases[String(c.id)] ? { ...c, alias: aliases[String(c.id)] } : c));
});

/** The course whose page we are on (1 is the site front page). */
export const activeCourseId = computed<number | null>(() => {
  const id = pageInfo.value?.courseId ?? 0;
  return id > 1 ? id : null;
});

/** Code of the course whose page we are on: the course list first, then the page's own breadcrumb or heading. */
export const activeCourseCode = computed<string | undefined>(() => {
  const id = activeCourseId.value;
  if (!id) return undefined;
  const known = coursesRaw.value.find((c) => c.id === id);
  if (known) return known.code;
  const info = pageInfo.value;
  const texts = [...(info?.breadcrumb.map((c) => c.text) ?? []), info?.heading ?? ''];
  for (const t of texts) {
    const m = /\b[A-Za-z]{3}\d{4}\b/.exec(t);
    if (m) return m[0].toUpperCase();
  }
  return undefined;
});

/** The faculty theme of the course page (default look when the option is off or the code has no known school letter). */
export const activeSchool = computed<SchoolId>(() => schoolFor(activeCourseCode.value, settings.value.colourBySchool));

/**
 * The fetched page behind a soft-navigated view (null on a normal page load: the live document). Anything that reads Moodle's
 * own markup for the current view (tiles, summaries, secondary navigation, activity cards) reads `livePageDoc()`, not `document`.
 */
export const pageDoc = signal<Document | null>(null);
export const livePageDoc = (): Document => pageDoc.peek() ?? document;

/** `location.search`, kept in a signal so views can follow query parameters that change without a reload (the Workspace course filter). */
export const search = signal(typeof location === 'undefined' ? '' : location.search);

/** Languages Moodle offers (from its own language menu): label as Moodle writes it, code, and the URL that switches to it. */
export interface MoodleLanguage {
  code: string;
  label: string;
  href: string;
  current: boolean;
}
export const languages = signal<MoodleLanguage[]>([]);

// Overlay and popover state.
export const paletteOpen = signal(false);
export const helpOpen = signal(false);
export const quickSettingsOpen = signal(false);
export const userMenuOpen = signal(false);
/** Rail sidebar expanded as an overlay, or the drawer opened (narrow viewports). */
export const sidebarOverlay = signal(false);
/** Keyboard-triggered sidebar changes are immediate. Pointer changes use the drawer transition. */
export const sidebarInstant = signal(false);

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
  /** Open `url` in place when it is an app view (soft navigation); false when the caller must load it normally. */
  navigate: (url: URL) => boolean;
}
export const hooks: ControllerHooks = {
  toggleOriginal: () => undefined,
  openOptions: () => undefined,
  isAppRoute: () => false,
  moodleLayout: () => undefined,
  navigate: () => false,
};
