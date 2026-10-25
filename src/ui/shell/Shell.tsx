import { Component, type ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { MOTION } from '../../fx/navigation';
import { motionTier } from '../../fx/motion';
import { t } from '../../i18n';
import { activeCourseId, hash, headerCompact, helpOpen, paletteOpen, route, settings, sidebarMode, sidebarOverlay, viewportWidth } from '../../state';
import { CourseView } from '../views/Course';
import { GradesOverviewView } from '../views/GradesOverview';
import { MyCoursesView } from '../views/MyCourses';
import { NotificationsView } from '../views/Notifications';
import { SkinChrome } from '../views/SkinChrome';
import { chromeKeys } from '../../state/skin';
import { PinnedView } from '../views/Pinned';
import { WorkspaceView } from '../views/Workspace';
import { Header } from './Header';
import { KeyboardHelp } from './KeyboardHelp';
import { Palette } from './Palette';
import { SessionBanner } from './SessionBanner';
import { Sidebar } from './Sidebar';
import { Toasts } from './Toasts';
import { hardNavigating, navigationLoading } from '../../state/navigation';
import { NavigationSkeleton } from '../components/NavigationSkeleton';

/** Scroll thresholds with hysteresis (design-spec §8.2): compact above 24px, expanded again at 8px or less. */
export const COMPACT_ON = 24;
export const COMPACT_OFF = 8;

export function nextCompact(current: boolean, scrollY: number): boolean {
  if (!current && scrollY > COMPACT_ON) return true;
  if (current && scrollY <= COMPACT_OFF) return false;
  return current;
}

function useShellEffects(): void {
  useEffect(() => {
    headerCompact.value = nextCompact(false, window.scrollY);
    let raf = 0;
    const onScroll = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const next = nextCompact(headerCompact.value, window.scrollY);
        if (next !== headerCompact.value) headerCompact.value = next;
      });
    };
    const onResize = (): void => {
      viewportWidth.value = window.innerWidth;
      if (sidebarMode.value === 'full') sidebarOverlay.value = false;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

/**
 * Sidebar full <-> rail (Ctrl+B): the page and the header land in their new place at once (no layout transition) and slide there
 * with a transform, so both move together. Not on window resizes, and not with reduced motion.
 */
function useSidebarSlide(): void {
  const mode = sidebarMode.value;
  const width = viewportWidth.value;
  const pinned = !settings.value.sidebarAutoHide;
  const prev = useRef<{ width: number; main: number; header: number } | null>(null);
  useLayoutEffect(() => {
    const main = document.getElementById('kex-main');
    const header = document.querySelector<HTMLElement>('.kex-header');
    const now = { width, main: main?.getBoundingClientRect().left ?? 0, header: header?.getBoundingClientRect().left ?? 0 };
    const before = prev.current;
    prev.current = now;
    if (!before || before.width !== width || motionTier() === 'none') return;
    for (const [el, from, to] of [[main, before.main, now.main], [header, before.header, now.header]] as const) {
      if (!el || typeof el.animate !== 'function' || Math.abs(from - to) < 1) continue;
      el.animate([{ transform: `translateX(${from - to}px)` }, { transform: 'translateX(0)' }], { duration: 220, easing: MOTION.ease });
    }
  }, [mode, width, pinned]);
}

/** Debug-only hook for the fail-open test: `?kex-test-throw=shell` makes the shell throw while rendering. */
function ThrowProbe(): null {
  if (__DEBUG__ && new URLSearchParams(location.search).get('kex-test-throw') === 'shell') {
    throw new Error('kex-test-throw=shell');
  }
  return null;
}

interface BoundaryProps {
  onError: (e: unknown) => void;
  children: ComponentChildren;
}

export class ErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };
  override componentDidCatch(error: unknown): void {
    this.setState({ failed: true });
    this.props.onError(error);
  }
  override render(): ComponentChildren {
    return this.state.failed ? null : this.props.children;
  }
}

function skipToContent(e: MouseEvent): void {
  e.preventDefault();
  const target = document.querySelector<HTMLElement>('#kex-main, #maincontent, [role="main"], #page-content');
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/** The page content for the current route; skin routes have none (Moodle's own content stays in place). */
function View() {
  const r = route.value;
  if (r?.effective === 'skin' && chromeKeys.has(r.key)) return <SkinChrome />;
  if (r?.effective !== 'app') return null;
  if (hardNavigating.value || (r.key === 'grades' && navigationLoading.value)) return <NavigationSkeleton />;
  // Keyed by course: a soft navigation from one course to another mounts a fresh view (state, hero, effects).
  if (r.key === 'course' || r.key === 'section') return <CourseView key={activeCourseId.value ?? 0} />;
  if (r.key === 'workspace') return hash.value === '#pinned' ? <PinnedView /> : <WorkspaceView />;
  if (r.key === 'mycourses') return <MyCoursesView />;
  if (r.key === 'grades') return <GradesOverviewView />;
  if (r.key === 'notifications') return <NotificationsView />;
  return null;
}

export function Shell() {
  useShellEffects();
  useSidebarSlide();
  return (
    <>
      <ThrowProbe />
      <a class="kex-skip" href="#maincontent" onClick={skipToContent}>{t('skip.content')}</a>
      <Sidebar />
      <Header />
      <SessionBanner />
      <View />
      <div class="kex-layer">
        {paletteOpen.value && <Palette />}
        {helpOpen.value && <KeyboardHelp />}
        <Toasts />
      </div>
    </>
  );
}
