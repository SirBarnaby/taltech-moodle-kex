import {
  BookMarked, CalendarDays, ChevronRight, GraduationCap, House, LibraryBig, Mail, MessageSquare, Settings as SettingsIcon, SlidersHorizontal,
  SquareArrowOutUpRight, type LucideIcon,
} from 'lucide-preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { setCourseAlias } from '../../actions/settings';
import { go, homeUrl, PAGES } from '../../actions/navigate';
import { stripBase } from '../../content/router';
import { countsStore } from '../../data/repo/counts';
import type { Course } from '../../data/model';
import { seasonLabel } from '../../data/names';
import { currentSemester, displayName } from '../../data/repo/courses';
import { t } from '../../i18n';
import {
  activeCourseId, coursesLoading, hash, logoSrc, pageInfo, quickSettingsOpen, route, sidebarCourses, sidebarInstant, sidebarMode, sidebarOverlay,
  ttLinks, user, userMenuOpen,
} from '../../state';
import { pressedCourseId } from '../../state/navigation';
import { QuickSettings } from './QuickSettings';
import { RailTip } from './RailTip';
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
    <a class="kex-sb__brand" href={homeUrl(PAGES.mycourses)} data-kex-test="sb-brand">
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

/** Press feedback: the highlight leaves for the pressed course straight away; the route confirms it (or a timeout puts it back). */
let pressTimer: number | undefined;
function pressCourse(id: number): void {
  if (pressedCourseId.peek() === id) return;
  pressedCourseId.value = id;
  window.clearTimeout(pressTimer);
  pressTimer = window.setTimeout(() => (pressedCourseId.value = null), 4000);
}

/**
 * The active-course highlight is one element that slides from course to course (transform and height only), so a course
 * switch reads as one movement instead of one item going dark and another lighting up.
 */
function Glide({ list, activeId, deps }: { list: HTMLUListElement | null; activeId: number | null; deps: unknown[] }) {
  const ref = useRef<HTMLLIElement>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !list) return;
    const place = (): void => {
      const target = activeId === null ? null : list.querySelector<HTMLElement>(`.kex-sb__course[data-course-id="${activeId}"]`);
      if (!target) {
        el.style.opacity = '0';
        placed.current = false;
        return;
      }
      const first = !placed.current;
      if (first) el.style.transition = 'none';
      el.style.opacity = '1';
      // Measured against the list (its items are positioned, so offsetTop would be relative to the item).
      const top = target.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
      el.style.transform = `translateY(${Math.round(top)}px)`;
      el.style.height = `${target.offsetHeight}px`;
      if (first) {
        void el.offsetHeight;
        el.style.transition = '';
      }
      placed.current = true;
    };
    place();
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place);
    ro?.observe(list);
    return () => ro?.disconnect();
  }, [list, activeId, ...deps]);
  return <li class="kex-sb__glide" ref={ref} aria-hidden="true" role="presentation" />;
}

function CourseItem({ course, active, index, editing, onEdit }: CourseItemProps) {
  const name = displayName(course);
  const [c1, c2] = splitCode(course.code);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus({ preventScroll: true });
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
        <div class={`kex-sb__course kex-sb__course--editing${active ? ' kex-sb__course--active' : ''}`} data-course-id={course.id}>
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
        onPointerDown={(e) => {
          if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) pressCourse(course.id);
        }}
        onClick={(e) => {
          if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) pressCourse(course.id);
        }}
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

type NavKey = 'mycourses' | 'calendar' | 'messages' | 'grades' | 'preferences';

/** Which first-class row the page we are on belongs to (by route, else by Moodle path). */
export function activeNav(routeKey: string | undefined, path: string): NavKey | undefined {
  if (routeKey === 'mycourses') return 'mycourses';
  if (routeKey === 'grades') return 'grades';
  if (/^\/calendar\//.test(path)) return 'calendar';
  if (/^\/message\/(index|edit)\.php/.test(path)) return 'messages';
  if (/^\/user\/(preferences|edit|editadvanced|language|forum|calendar|notification|message)/.test(path) || /^\/message\/notificationpreferences\.php/.test(path)) return 'preferences';
  return undefined;
}

interface NavRowProps {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
  testId: string;
  onClick?: (e: MouseEvent) => void;
  badge?: number;
  badgeLabel?: string;
}

/** A secondary first-class row: Moodle's own label (src/i18n/moodle.ts), compact height. */
function NavRow({ href, label, icon: Icon, current, testId, onClick, badge = 0, badgeLabel }: NavRowProps) {
  return (
    <li>
      <a class="kex-sb__row kex-sb__row--sub" href={href} aria-current={current ? 'page' : undefined} data-tip={label} data-kex-test={testId} onClick={onClick}>
        <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
        <span class="kex-sb__rowlabel">{label}</span>
        {badge > 0 && (
          <span class="kex-sb__pill kex-mono" data-kex-test={`${testId}-badge`} aria-label={badgeLabel}>{badge > 99 ? '99+' : badge}</span>
        )}
      </a>
    </li>
  );
}

export function Sidebar() {
  const mode = sidebarMode.value;
  const overlayOpen = sidebarOverlay.value;
  const courses = sidebarCourses.value;
  const routeActive = activeCourseId.value;
  const pressed = pressedCourseId.value;
  const activeId = pressed ?? routeActive;
  const [list, setList] = useState<HTMLUListElement | null>(null);
  useEffect(() => {
    // The route caught up (or went elsewhere): the press has done its job.
    pressedCourseId.value = null;
  }, [routeActive]);
  const r = route.value;
  const u = user.value;
  const [editing, setEditing] = useState<number | null>(null);
  const settingsBtn = useRef<HTMLButtonElement>(null);
  const userBtn = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (overlayOpen && sidebarInstant.peek()) navRef.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true });
  }, [overlayOpen]);

  const sem = currentSemester(courses);
  const label = `${t('sidebar.courses')} / ${seasonLabel(sem.season)} ${sem.year}`;
  const links = ttLinks.value;
  const key = r?.key;
  const isHome = key === 'workspace' && hash.value !== '#pinned';
  const isPinned = key === 'workspace' && hash.value === '#pinned';
  const counts = countsStore().value.value;
  const unread = counts?.notifs ?? 0;
  const messages = counts?.messages ?? 0;
  const anyUnread = unread + messages > 0;
  const nav = activeNav(key, pageInfo.value ? stripBase(location.pathname, pageInfo.value.wwwroot) : location.pathname);
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
      {mode !== 'full' && overlayOpen && <div class="kex-sb-backdrop" onClick={() => {
        sidebarInstant.value = false;
        quickSettingsOpen.value = false;
        userMenuOpen.value = false;
        sidebarOverlay.value = false;
      }} />}
      <nav
        ref={navRef}
        class="kex-sidebar"
        aria-label={t('palette.group.courses')}
        data-kex-test="sidebar"
        data-mode={mode}
        data-open={overlayOpen ? 'true' : 'false'}
        data-instant={sidebarInstant.value ? 'true' : 'false'}
        inert={inert}
        aria-hidden={inert ? 'true' : undefined}
      >
        <Wordmark />
        <div class="kex-sb__divider" />
        <ul class="kex-sb__nav">
          <NavRow href={homeUrl(PAGES.mycourses)} label={t('nav.mycourses')} icon={House} current={nav === 'mycourses'} testId="sb-mycourses" />
          <li>
            <a class="kex-sb__row kex-sb__row--sub" href={homeUrl(PAGES.workspace)} aria-current={isHome ? 'page' : undefined} data-tip={t('nav.workspace')} data-kex-test="sb-workspace" onClick={(e) => here(e, PAGES.workspace)}>
              <LibraryBig size={22} strokeWidth={1.5} aria-hidden="true" />
              <span class="kex-sb__rowlabel">{t('nav.workspace')}</span>
              {unread > 0 && (
                <span class="kex-sb__pill kex-mono" data-kex-test="sb-unread" aria-label={t('sidebar.unread', { n: unread })}>{unread > 99 ? '99+' : unread}</span>
              )}
            </a>
          </li>
          <li>
            <a class="kex-sb__row kex-sb__row--sub" href={homeUrl(PAGES.pinned)} aria-current={isPinned ? 'page' : undefined} data-tip={t('nav.pinned')} onClick={(e) => here(e, PAGES.pinned)}>
              <BookMarked size={22} strokeWidth={1.5} aria-hidden="true" />
              <span class="kex-sb__rowlabel">{t('nav.pinned')}</span>
            </a>
          </li>
          <NavRow href={homeUrl(PAGES.calendar)} label={t('nav.calendar')} icon={CalendarDays} current={nav === 'calendar'} testId="sb-calendar" />
          <NavRow
            href={homeUrl(PAGES.messages)} label={t('nav.messages')} icon={MessageSquare} current={nav === 'messages'} testId="sb-messages"
            badge={messages} badgeLabel={`${t('nav.messages')}: ${messages}`}
          />
          <NavRow href={homeUrl(PAGES.grades)} label={t('nav.grades')} icon={GraduationCap} current={nav === 'grades'} testId="sb-grades" />
          <NavRow href={homeUrl(PAGES.preferences)} label={t('nav.preferences')} icon={SlidersHorizontal} current={nav === 'preferences'} testId="sb-preferences" />
        </ul>
        <div class="kex-sb__divider kex-sb__divider--2" />
        <div class="kex-sb__label" aria-hidden={expanded ? undefined : 'true'}>{label}</div>
        <ul class="kex-sb__courses" aria-busy={coursesLoading.value} ref={setList}>
          {courses.length > 0 && <Glide list={list} activeId={activeId} deps={[courses, editing, expanded, mode]} />}
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
                <SquareArrowOutUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
                <span class="kex-sb__rowlabel">{t('sidebar.ois')}</span>
              </a>
            </li>
            <li>
              <a class="kex-sb__row kex-sb__row--foot" href={links.mail ?? MAIL_FALLBACK} target="_blank" rel="noopener noreferrer" data-tip={t('sidebar.email')}>
                <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
                <span class="kex-sb__rowlabel">{t('sidebar.email')}</span>
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
                <SettingsIcon size={18} strokeWidth={1.5} aria-hidden="true" />
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
      {mode === 'rail' && !overlayOpen && <RailTip container={navRef} />}
      {quickSettingsOpen.value && <QuickSettings anchor={settingsBtn.current} />}
      {userMenuOpen.value && <UserMenu anchor={userBtn.current} />}
    </>
  );
}
