import { ArrowUpRight, BookMarked, ChevronRight, House, Settings as SettingsIcon, SquareArrowOutUpRight } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { setCourseAlias } from '../../actions/settings';
import { go, homeUrl, PAGES } from '../../actions/navigate';
import { countsStore } from '../../data/repo/counts';
import type { Course } from '../../data/model';
import { seasonLabel } from '../../data/names';
import { currentSemester, displayName } from '../../data/repo/courses';
import { t } from '../../i18n';
import {
  activeCourseId, coursesLoading, hash, logoSrc, pageInfo, quickSettingsOpen, route, sidebarCourses, sidebarMode, sidebarOverlay,
  ttLinks, user, userMenuOpen,
} from '../../state';
import { QuickSettings } from './QuickSettings';
import { UserMenu } from './UserMenu';

const OIS_FALLBACK = 'https://ois2.ttu.ee';
const MAIL_FALLBACK = 'https://mail.ttu.ee';

/** "ITI8801" -> ["ITI", "8801"] for the rail's two-line code. */
export function splitCode(code: string): [string, string] {
  const m = /^([A-Za-z]+)(\d.*)$/.exec(code);
  return m ? [m[1] ?? code, m[2] ?? ''] : [code.slice(0, 3), code.slice(3)];
}

function Wordmark() {
  const src = logoSrc.value;
  return (
    <a class="kex-sb__brand" href={homeUrl('/my/')} data-kex-test="sb-brand">
      {src ? (
        <img class="kex-sb__logo" src={src} alt="" />
      ) : (
        <span class="kex-sb__wordmark" aria-hidden="true">
          <span>TAL</span>
          <span>TECH</span>
        </span>
      )}
      <span class="kex-sb__brand-divider" aria-hidden="true" />
      <span class="kex-sb__moodle">{t('sidebar.moodle')}</span>
    </a>
  );
}

interface CourseItemProps {
  course: Course;
  active: boolean;
  index: number;
  editing: boolean;
  onEdit: (id: number | null) => void;
}

function CourseItem({ course, active, index, editing, onEdit }: CourseItemProps) {
  const name = displayName(course);
  const [c1, c2] = splitCode(course.code);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    const commit = (): void => {
      const v = inputRef.current?.value ?? '';
      setCourseAlias(course.id, v === course.name ? '' : v);
      onEdit(null);
    };
    return (
      <li>
        <div class={`kex-sb__course kex-sb__course--editing${active ? ' kex-sb__course--active' : ''}`}>
          <span class="kex-sb__code">{course.code}</span>
          <input
            ref={inputRef}
            class="kex-sb__rename"
            type="text"
            value={name}
            aria-label={t('sidebar.renameLabel')}
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onEdit(null);
              }
            }}
            onBlur={commit}
          />
        </div>
      </li>
    );
  }
  return (
    <li>
      <a
        class={`kex-sb__course${active ? ' kex-sb__course--active' : ''}`}
        href={course.url}
        aria-current={active ? 'page' : undefined}
        data-course-id={course.id}
        data-index={index}
        data-tip={`${course.code} · ${name}`}
        data-kex-test={active ? 'sb-active-course' : undefined}
        title={t('sidebar.rename')}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();
            onEdit(course.id);
          }
        }}
      >
        <span class="kex-sb__code">{course.code}</span>
        <span class="kex-sb__code kex-sb__code--rail" aria-hidden="true">
          <span>{c1}</span>
          <span>{c2}</span>
        </span>
        <span class="kex-sb__name">{name}</span>
      </a>
    </li>
  );
}

export function Sidebar() {
  const mode = sidebarMode.value;
  const overlayOpen = sidebarOverlay.value;
  const courses = sidebarCourses.value;
  const activeId = activeCourseId.value;
  const r = route.value;
  const u = user.value;
  const [editing, setEditing] = useState<number | null>(null);
  const settingsBtn = useRef<HTMLButtonElement>(null);
  const userBtn = useRef<HTMLButtonElement>(null);

  const sem = currentSemester(courses);
  const label = `${t('sidebar.courses')} / ${seasonLabel(sem.season)} ${sem.year}`;
  const links = ttLinks.value;
  const key = r?.key;
  const isHome = key === 'workspace' && hash.value !== '#pinned';
  const isPinned = key === 'workspace' && hash.value === '#pinned';
  const counts = countsStore().value.value;
  const unread = counts?.notifs ?? 0;
  const anyUnread = unread + (counts?.messages ?? 0) > 0;
  // Links to the page we are on switch views in place (a plain navigation to `/my/` from `/my/#pinned` would reload).
  const here = (e: MouseEvent, path: string): void => {
    if (key !== 'workspace' || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(homeUrl(path));
  };
  const inert = mode === 'drawer' && !overlayOpen;
  const expanded = mode === 'full' || overlayOpen;

  return (
    <>
      {mode !== 'full' && overlayOpen && <div class="kex-sb-backdrop" onClick={() => (sidebarOverlay.value = false)} />}
      <nav
        class="kex-sidebar"
        aria-label={t('palette.group.courses')}
        data-kex-test="sidebar"
        data-mode={mode}
        data-open={overlayOpen ? 'true' : 'false'}
        inert={inert}
        aria-hidden={inert ? 'true' : undefined}
      >
        <Wordmark />
        <div class="kex-sb__divider" />
        <ul class="kex-sb__nav">
          <li>
            <a class="kex-sb__row" href={homeUrl(PAGES.workspace)} aria-current={isHome ? 'page' : undefined} data-tip={t('nav.workspace')} data-kex-test="sb-workspace" onClick={(e) => here(e, PAGES.workspace)}>
              <House size={24} strokeWidth={1.5} aria-hidden="true" />
              <span class="kex-sb__rowlabel">{t('nav.workspace')}</span>
              {unread > 0 && (
                <span class="kex-sb__pill kex-mono" data-kex-test="sb-unread" aria-label={t('sidebar.unread', { n: unread })}>{unread > 99 ? '99+' : unread}</span>
              )}
            </a>
          </li>
          <li>
            <a class="kex-sb__row" href={homeUrl(PAGES.pinned)} aria-current={isPinned ? 'page' : undefined} data-tip={t('nav.pinned')} onClick={(e) => here(e, PAGES.pinned)}>
              <BookMarked size={24} strokeWidth={1.5} aria-hidden="true" />
              <span class="kex-sb__rowlabel">{t('nav.pinned')}</span>
            </a>
          </li>
        </ul>
        <div class="kex-sb__divider kex-sb__divider--2" />
        <div class="kex-sb__label" aria-hidden={expanded ? undefined : 'true'}>{label}</div>
        <ul class="kex-sb__courses" aria-busy={coursesLoading.value}>
          {courses.map((c, i) => (
            <CourseItem key={c.id} course={c} index={i} active={c.id === activeId} editing={editing === c.id} onEdit={setEditing} />
          ))}
          {!courses.length && (
            <li class="kex-sb__empty" aria-live="polite">
              {coursesLoading.value ? <span class="kex-skel kex-skel--sb" role="status" aria-label={t('sidebar.loadingCourses')} /> : t('sidebar.noCourses')}
            </li>
          )}
        </ul>
        <div class="kex-sb__foot">
          <div class="kex-sb__divider kex-sb__divider--3" />
          <ul class="kex-sb__links">
            <li>
              <a class="kex-sb__row kex-sb__row--foot" href={links.ois ?? OIS_FALLBACK} target="_blank" rel="noopener noreferrer" data-tip={t('sidebar.ois')}>
                <SquareArrowOutUpRight size={21} strokeWidth={1.5} aria-hidden="true" />
                <span class="kex-sb__rowlabel">{t('sidebar.ois')}<ArrowUpRight class="kex-sb__ext" size={17} strokeWidth={1.75} aria-hidden="true" /></span>
              </a>
            </li>
            <li>
              <a class="kex-sb__row kex-sb__row--foot" href={links.mail ?? MAIL_FALLBACK} target="_blank" rel="noopener noreferrer" data-tip={t('sidebar.email')}>
                <SquareArrowOutUpRight size={21} strokeWidth={1.5} aria-hidden="true" />
                <span class="kex-sb__rowlabel">{t('sidebar.email')}<ArrowUpRight class="kex-sb__ext" size={17} strokeWidth={1.75} aria-hidden="true" /></span>
              </a>
            </li>
            <li>
              <button
                ref={settingsBtn}
                type="button"
                class="kex-sb__row kex-sb__row--foot"
                aria-haspopup="dialog"
                aria-expanded={quickSettingsOpen.value}
                data-tip={t('sidebar.settings')}
                data-kex-test="sb-settings"
                onClick={() => {
                  userMenuOpen.value = false;
                  quickSettingsOpen.value = !quickSettingsOpen.value;
                }}
              >
                <SettingsIcon size={21} strokeWidth={1.5} aria-hidden="true" />
                <span class="kex-sb__rowlabel">{t('sidebar.settings')}</span>
              </button>
            </li>
          </ul>
          <button
            ref={userBtn}
            type="button"
            class="kex-sb__user"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen.value}
            data-tip={u?.fullname ?? t('sidebar.userMenu')}
            data-kex-test="sb-user"
            onClick={() => {
              quickSettingsOpen.value = false;
              userMenuOpen.value = !userMenuOpen.value;
            }}
          >
            <span class="kex-sb__avwrap">
              <span class="kex-sb__avatar" aria-hidden="true">
                {u?.avatar ? <img src={u.avatar} alt="" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} /> : null}
                <span>{u?.initials ?? '·'}</span>
              </span>
              {anyUnread && <span class="kex-sb__dot" data-kex-test="sb-dot" aria-hidden="true" />}
            </span>

            <span class="kex-sb__username">{u?.fullname ?? pageInfo.value?.heading ?? ''}</span>
            <ChevronRight class="kex-sb__chev" size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </nav>
      {quickSettingsOpen.value && <QuickSettings anchor={settingsBtn.current} />}
      {userMenuOpen.value && <UserMenu anchor={userBtn.current} />}
    </>
  );
}
