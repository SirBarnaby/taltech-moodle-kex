import { Component, type ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '../../i18n';
import { headerCompact, helpOpen, paletteOpen, sidebarMode, sidebarOverlay, viewportWidth } from '../../state';
import { Header } from './Header';
import { KeyboardHelp } from './KeyboardHelp';
import { Palette } from './Palette';
import { SessionBanner } from './SessionBanner';
import { Sidebar } from './Sidebar';
import { Toasts } from './Toasts';

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
  target.focus();
}

export function Shell() {
  useShellEffects();
  return (
    <>
      <ThrowProbe />
      <a class="kex-skip" href="#maincontent" onClick={skipToContent}>{t('skip.content')}</a>
      <Sidebar />
      <Header />
      <SessionBanner />
      <div class="kex-layer">
        {paletteOpen.value && <Palette />}
        {helpOpen.value && <KeyboardHelp />}
        <Toasts />
      </div>
    </>
  );
}
