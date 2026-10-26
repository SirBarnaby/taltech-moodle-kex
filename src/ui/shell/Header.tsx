import { Menu, Moon, Search, Sun } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { stripBase } from '../../content/router';
import { toggleSidebar, toggleTheme } from '../../actions/theme';
import { t } from '../../i18n';
import {
  hash, headerCompact, headerTitle, pageInfo, paletteOpen, resolvedTheme, sidebarCourses, sidebarMode, sidebarOverlay, sidebarOverlays,
} from '../../state';
import { IconButton } from '../components/IconButton';
import { buildBreadcrumb, collapseBreadcrumb, type ShellCrumb } from './breadcrumb';

export const isMac = (): boolean => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Filled house glyph from the mock: a solid body with a door cut-out. */
function HomeGlyph() {
  return (
    <svg class="kex-crumbs__homeicon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M3 10.2a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10.2V19a2 2 0 0 1-2 2h-4.5v-7.2a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V21H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function Crumbs({ crumbs }: { crumbs: ShellCrumb[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);
  const { visible, hidden, at } = collapseBreadcrumb(crumbs);
  useEffect(() => {
    if (!moreOpen) return;
    const off = (e: Event): void => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('pointerdown', off, true);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', off, true);
      document.removeEventListener('keydown', esc, true);
    };
  }, [moreOpen]);

  const items: preact.ComponentChildren[] = [];
  visible.forEach((c, i) => {
    if (i === at && hidden.length) {
      items.push(
        <li key="more" ref={moreRef} class="kex-crumbs__item kex-crumbs__more">
          <button type="button" class="kex-crumbs__morebtn" aria-label={t('crumb.more')} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>…</button>
          {moreOpen && (
            <ul class="kex-crumbs__menu">
              {hidden.map((h) => (
                <li key={h.text + (h.href ?? '')}>{h.href ? <a href={h.href}>{h.text}</a> : <span>{h.text}</span>}</li>
              ))}
            </ul>
          )}
        </li>,
      );
    }
    const last = i === visible.length - 1;
    items.push(
      <li key={c.text + i} class={`kex-crumbs__item${last ? ' kex-crumbs__item--current' : ''}${c.home ? ' kex-crumbs__item--home' : ''}`}>
        {c.href && !last ? (
          <a href={c.href} aria-label={c.home ? t('nav.mycourses') : undefined}>{c.home ? <HomeGlyph /> : c.text}</a>
        ) : (
          <span aria-current={last ? 'page' : undefined}>{c.home ? <HomeGlyph /> : c.text}</span>
        )}
      </li>,
    );
  });
  return (
    <nav class="kex-crumbs" aria-label={t('crumb.nav')} data-kex-test="breadcrumb">
      <ol>{items}</ol>
    </nav>
  );
}

export function Header() {
  const compact = headerCompact.value;
  const info = pageInfo.value;
  const mode = sidebarMode.value;
  // Below 1100 px (and on a quiz attempt) the rail does not widen in place: the menu button opens the menu over the page.
  const overlays = sidebarOverlays.value;
  const theme = resolvedTheme.value;
  const title = headerTitle.value;
  const crumbs = info
    ? buildBreadcrumb(
        { courseId: info.courseId, breadcrumb: info.breadcrumb, heading: info.heading, path: stripBase(location.pathname, info.wwwroot), wwwroot: info.wwwroot },
        sidebarCourses.value,
        { home: t('crumb.home'), workspace: t('crumb.workspace'), mycourses: t('crumb.mycourses'), grades: t('nav.grades'), notifications: t('nav.notifications') },
      )
    : [];
  if (hash.value === '#pinned' && crumbs.length === 2 && /\/my\/?$/.test(info?.wwwroot ? stripBase(location.pathname, info.wwwroot) : '')) crumbs[1] = { text: t('pinned.title'), href: null };
  const mac = isMac();

  return (
    <header class="kex-header" role="banner" data-kex-test="header" data-compact={compact ? 'true' : 'false'}>
      <IconButton
        label={overlays ? (sidebarOverlay.value ? t('sidebar.close') : t('sidebar.open')) : t('sidebar.toggle')}
        testId="sidebar-toggle"
        class="kex-header__menu"
        expanded={overlays ? sidebarOverlay.value : mode === 'full'}
        onClick={(e) => toggleSidebar(e.detail === 0)}
      >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
      <Crumbs crumbs={crumbs} />
      <div class="kex-header__title" data-kex-test="header-title" aria-live="polite">
        {title && (
          <>
            <span class="kex-header__titlerule" aria-hidden="true" />
            {title.chip && <span class="kex-chip">{title.chip}</span>}
            <span class="kex-header__titletext">{title.text}</span>
          </>
        )}
      </div>
      <button type="button" class="kex-search" data-kex-test="search" aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'} aria-label={t('header.search')} title={`${t('header.search')} (${mac ? '⌘' : 'Ctrl'} K)`} aria-haspopup="dialog" onClick={() => (paletteOpen.value = true)}>
        <Search class="kex-search__icon" size={24} strokeWidth={1.6} aria-hidden="true" />
        <span class="kex-search__text">{t('header.search')}</span>
        <span class="kex-search__kbd" aria-hidden="true">
          <kbd>{mac ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </span>
      </button>
      <IconButton
        label={theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
        testId="theme-toggle"
        class="kex-header__theme"
        onClick={() => toggleTheme()}
      >
        {theme === 'dark' ? <Moon size={24} strokeWidth={1.6} fill="currentColor" aria-hidden="true" /> : <Sun size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />}
      </IconButton>
    </header>
  );
}
