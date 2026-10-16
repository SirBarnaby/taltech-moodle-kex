import { ArrowUpRight, Bell, CircleCheck, Eye, Megaphone, MessagesSquare, Pin as PinIcon, X } from 'lucide-preact';
import { Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import {
  feedPinned, initWorkspace, manualOf, markEverythingRead, markNotifRead, openCourse, openFeedItem, pinFeedItem, recentKind, rowFromRecent, selectFeed, setFeedTab,
  setWsCourse, toggleDoneById,
} from '../../actions/workspace';
import { go, homeUrl, PAGES } from '../../actions/navigate';
import { classifyFormat, monoLabel } from '../../data/classify';
import type { DueItem } from '../../data/model';
import { type FeedItem, nearestCourse, nextByCourse, weekSummary, type FeedTab } from '../../data/feed';
import { countsStore } from '../../data/repo/counts';
import { displayName } from '../../data/repo/courses';
import { eventsStore } from '../../data/repo/events';
import { isPinned, pinsStore, rowPins } from '../../data/repo/pins';
import type { RecentItem } from '../../data/repo/recent';
import { formatDate, lang, t, type MessageKey } from '../../i18n';
import { clock, greeting, heroDay, relTime, shortDay, studyWeek } from '../../lib/time';
import { sidebarCourses, user } from '../../state';
import { startsCourseGroup } from '../../lib/feedgroups';
import { dueList, feed, feedError, feedLoading, feedSel, feedTab, nowSec, notifList, recentList, unreadCount, wsCourse, wsPreview } from '../../state/workspace';
import { Button } from '../components/Button';
import { Hero, type HeroLink } from '../components/Hero';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { ItemRow, type RowAction } from '../components/ItemRow';
import { PinnedRow } from '../components/PinnedRow';
import { PreviewSheet } from '../components/PreviewSheet';
import { SlideUpText } from '../components/SlideUpText';
import { EmptyState, RowSkeleton } from '../components/States';
import { DateTile, GlyphTile, Thumb, thumbVariant } from '../components/Thumb';
import { Tabs, type TabDef } from '../components/Tabs';

const FEED_TABS: readonly TabDef<FeedTab>[] = [
  { key: 'all', label: 'feed.tab.all', digit: '1' },
  { key: 'deadlines', label: 'feed.tab.deadlines', digit: '2' },
  { key: 'updates', label: 'feed.tab.updates', digit: '3' },
];

const DAY = 86400;

export const firstName = (full: string | undefined): string => (full ?? '').trim().split(/\s+/)[0] ?? '';

/** The mono word in front of a deadline row's course code. */
function dueWord(d: DueItem): string {
  const known: Record<string, MessageKey> = { assign: 'label.assignment', quiz: 'label.quiz', forum: 'label.forum' };
  const k = known[d.modname];
  return k ? t(k) : (d.modname || t('label.material')).toUpperCase();
}

function dueSubtitle(d: DueItem, now: number): string {
  const ms = d.due * 1000;
  const when = `${shortDay(ms)}, ${clock(ms)}`;
  const line = t(d.modname === 'quiz' ? 'row.closesLine' : 'row.dueLine', { when });
  const rel = relTime(d.due - now);
  return d.overdue ? `${line} · ${t('row.overdueBy', { rel })}` : `${line} · ${rel}`;
}

function submitVerb(d: DueItem, first: boolean): { label: string; variant: 'filled' | 'outlined'; href: string } {
  const actionable = !!d.actionUrl;
  return {
    label: actionable ? t(d.modname === 'assign' ? 'verb.submit' : 'verb.open') : t('verb.open'),
    variant: actionable && first ? 'filled' : 'outlined',
    href: d.actionUrl ?? d.url,
  };
}

const isModified = (e: MouseEvent): boolean => e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;

function DeadlineRow({ item, index, now, selected, first }: { item: Extract<FeedItem, { type: 'deadline' }>; index: number; now: number; selected: boolean; first: boolean }) {
  const d = item.item;
  const ms = d.due * 1000;
  const soon = !d.overdue && d.due - now < 2 * DAY;
  const pinned = feedPinned(item);
  const manual = manualOf(d.cmid);
  const btn = submitVerb(d, first);
  const actions: RowAction[] = [];
  if (d.cmid) {
    actions.push({
      key: 'pin', label: pinned ? t('row.unpin') : t('row.pin'), on: pinned, testId: 'act-pin',
      icon: <PinIcon size={17} strokeWidth={1.75} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />,
      onClick: () => pinFeedItem(item),
    });
  }
  if (manual && d.cmid) {
    actions.push({
      key: 'done', label: manual.done ? t('row.doneOn') : t('row.done'), on: manual.done, testId: 'act-done',
      icon: <CircleCheck size={17} strokeWidth={1.75} aria-hidden="true" />,
      onClick: () => void toggleDoneById(d.cmid as number),
    });
  }
  actions.push({
    key: 'course', label: t('row.openCourse'), testId: 'act-course',
    icon: <ArrowUpRight size={17} strokeWidth={1.75} aria-hidden="true" />,
    onClick: () => openCourse(d.courseId),
  });
  const mon = formatDate(ms, { month: 'short' }).replace('.', '').toUpperCase();
  const wd = formatDate(ms, { weekday: 'short' }).replace('.', '').toUpperCase();
  return (
    <ItemRow
      id={item.key}
      testId={`feed-${index + 1}`}
      class={`kex-row--deadline${d.overdue ? ' kex-row--overdue' : ''}`}
      selected={selected}
      enter={index}
      onSelect={selectFeed}
      ariaLabel={`${d.title}, ${dueSubtitle(d, now)}`}
      thumb={<DateTile mon={mon} day={String(new Date(ms).getDate()).padStart(2, '0')} sub={d.overdue ? t('label.overdue') : wd} overdue={d.overdue} soon={soon} testId="date-tile" />}
      tone={d.overdue ? 'overdue' : 'normal'}
      label={`${d.overdue ? `${t('label.overdue')} · ` : ''}${dueWord(d)} / ${d.courseCode}`}
      title={d.title}
      titleHref={btn.href}
      onTitle={() => openFeedItem(item)}
      subtitle={dueSubtitle(d, now)}
      actions={actions}
      button={{
        label: btn.label, variant: btn.variant, href: btn.href, testId: 'feed-open', onClick: (e) => {
          if (isModified(e)) return;
          e.preventDefault();
          openFeedItem(item);
        },
      }}
    />
  );
}

function ContinueRow({ item, index, now, selected }: { item: Extract<FeedItem, { type: 'continue' }>; index: number; now: number; selected: boolean }) {
  const r: RecentItem = item.item;
  const kind = recentKind(r);
  const format = classifyFormat({ modname: r.modname, name: r.title, iconKey: r.iconKey }, kind);
  const pinned = feedPinned(item);
  return (
    <ItemRow
      id={item.key}
      testId={`feed-${index + 1}`}
      class="kex-row--continue"
      selected={selected}
      enter={index}
      onSelect={selectFeed}
      ariaLabel={r.title}
      thumb={<Thumb variant={thumbVariant(kind, format)} format={format} seed={r.cmid} />}
      label={`${monoLabel(kind, format)} · ${r.courseCode}`}
      title={r.title}
      titleHref={r.url}
      onTitle={() => openFeedItem(item)}
      subtitle={t('row.opened', { rel: relTime(r.accessedAt - now) })}
      actions={[
        {
          key: 'preview', label: t('row.preview'), testId: 'act-preview', icon: <Eye class="kex-ico-eye" size={20} strokeWidth={1.5} aria-hidden="true" />,
          onClick: () => (wsPreview.value = rowFromRecent(r)),
        },
        {
          key: 'pin', label: pinned ? t('row.unpin') : t('row.pin'), on: pinned, testId: 'act-pin',
          icon: <PinIcon size={17} strokeWidth={1.75} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />,
          onClick: () => pinFeedItem(item),
        },
      ]}
      button={{
        label: t('verb.open'), variant: 'outlined', href: r.url, testId: 'feed-open', onClick: (e) => {
          if (isModified(e)) return;
          e.preventDefault();
          openFeedItem(item);
        },
      }}
    />
  );
}

function UpdateRow({ item, index, selected }: { item: Extract<FeedItem, { type: 'update' }>; index: number; selected: boolean }) {
  const n = item.item;
  const glyph = n.kind === 'announcement' ? <Megaphone size={28} strokeWidth={1.5} /> : n.kind === 'forum' || n.kind === 'message' ? <MessagesSquare size={28} strokeWidth={1.5} /> : <Bell size={28} strokeWidth={1.5} />;
  const word = n.kind === 'announcement' ? t('label.announcement') : n.kind === 'forum' ? t('label.forum') : n.kind === 'message' ? t('label.message') : n.kind === 'assign' ? t('label.assignment') : n.kind === 'quiz' ? t('label.quiz') : t('label.notification');
  const actions: RowAction[] = n.read
    ? []
    : [{
        key: 'read', label: t('row.markRead'), testId: 'act-read',
        icon: <CircleCheck size={17} strokeWidth={1.75} aria-hidden="true" />,
        onClick: () => void markNotifRead(n.id),
      }];
  return (
    <ItemRow
      id={item.key}
      testId={`feed-${index + 1}`}
      class={`kex-row--update${n.read ? '' : ' kex-row--unread'}`}
      selected={selected}
      unread={!n.read}
      enter={index}
      onSelect={selectFeed}
      ariaLabel={`${n.subject}${n.read ? '' : `, ${t('ws.unread')}`}`}
      thumb={<GlyphTile testId="glyph-tile">{glyph}</GlyphTile>}
      label={n.courseCode ? `${word} / ${n.courseCode}` : word}
      title={n.subject}
      titleHref={n.contextUrl || undefined}
      onTitle={() => openFeedItem(item)}
      subtitle={n.small}
      actions={actions}
      button={n.contextUrl ? {
        label: t('verb.read'), variant: 'outlined', href: n.contextUrl, testId: 'feed-open', onClick: (e) => {
          if (isModified(e)) return;
          e.preventDefault();
          openFeedItem(item);
        },
      } : undefined}
    />
  );
}

/** The COURSES column: the heading opens My courses, a course card filters the feed to it in place (URL `?course=`), "All" clears it. */
function CourseColumn() {
  const courses = sidebarCourses.value;
  const due = dueList.value;
  const next = nextByCourse(due);
  const nearest = nearestCourse(due);
  const picked = wsCourse.value;
  const filtered = picked !== undefined;
  const pick = (e: MouseEvent, id: number | undefined): void => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setWsCourse(id);
  };
  return (
    <aside class="kex-topics kex-wscourses" aria-label={t('ws.courses')} data-kex-test="ws-courses">
      <h3 class="kex-topics__label kex-mono">
        <a class="kex-wscourses__all" href={homeUrl(PAGES.mycourses)} data-kex-test="ws-courses-link">{t('ws.courses')}<ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /></a>
      </h3>
      <ul class="kex-wscourses__list">
        <li>
          <a
            class={`kex-wc kex-wc--reset${!filtered ? ' kex-wc--picked' : ''}`}
            href={homeUrl(PAGES.workspace)}
            aria-current={!filtered ? 'true' : undefined}
            data-kex-test="ws-course-all"
            onClick={(e) => pick(e, undefined)}
          >
            <span class="kex-wc__name">{t('common.all')}</span>
          </a>
        </li>
        {courses.map((c) => {
          const nx = next.get(c.id);
          const pct = c.progress === null ? undefined : Math.max(0, Math.min(100, Math.round(c.progress)));
          const on = picked === c.id;
          const active = filtered ? on : c.id === nearest;
          return (
            <li key={c.id}>
              <a
                class={`kex-wc${active ? ' kex-wc--active' : ''}`}
                href={`${homeUrl(PAGES.workspace)}?course=${c.id}`}
                data-kex-wc={c.id}
                data-kex-test="ws-course"
                aria-current={active ? 'true' : undefined}
                title={t('ws.filterCourse', { name: `${c.code} ${displayName(c)}` })}
                onClick={(e) => pick(e, on ? undefined : c.id)}
              >
                <span class="kex-wc__top">
                  <span class="kex-wc__code kex-mono">{c.code}</span>
                  {pct !== undefined && <span class="kex-wc__pct kex-mono">{pct}%</span>}
                </span>
                <span class="kex-wc__name">{displayName(c)}</span>
                <span class="kex-wc__next">{nx ? t('ws.next', { title: nx.title, day: formatDate(nx.due * 1000, { weekday: 'short' }) }) : t('ws.noDeadlines')}</span>
                {pct !== undefined && <span class="kex-wc__bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** Course heading above a run of deadlines of one course. */
function CourseHeading({ courseId, code }: { courseId: number; code: string }) {
  const c = sidebarCourses.value.find((x) => x.id === courseId);
  return (
    <li class="kex-feedgroup" data-kex-test="feed-group" data-course-id={courseId}>
      <a class="kex-feedgroup__link" href={c?.url ?? homeUrl(`/course/view.php?id=${courseId}`)}>
        <span class="kex-feedgroup__code kex-mono">{c?.code ?? code}</span>
        {c && <span class="kex-feedgroup__name">{displayName(c)}</span>}
        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </a>
    </li>
  );
}

function Stamp() {
  const ev = eventsStore();
  const at = ev.at.value;
  const failed = ev.status.value === 'error';
  if (!at) return null;
  const offline = failed || (typeof navigator !== 'undefined' && navigator.onLine === false);
  return (
    <span class={`kex-feedhead__stamp kex-mono${offline ? ' kex-feedhead__stamp--offline' : ''}`} data-kex-test="ws-stamp" aria-live="polite">
      {offline ? t('ws.offline', { time: clock(at) }) : t('ws.updated', { rel: relTime(Math.floor(at / 1000) - nowSec.value).toUpperCase() })}
    </span>
  );
}

export function WorkspaceView() {
  useEffectsConfig();
  useQuietFocus();
  useEffect(() => initWorkspace(), []);

  const courses = sidebarCourses.value;
  const tab = feedTab.value;
  const list = feed.value;
  const now = nowSec.value;
  const sel = feedSel.value;
  const pins = pinsStore().value.value ?? [];
  const due = dueList.value;
  const loading = feedLoading.value;
  const failed = feedError.value && eventsStore().value.value === undefined;
  const unread = unreadCount.value;
  const preview = wsPreview.value;
  const u = user.value;
  const pickedId = wsCourse.value;
  const pickedCourse = pickedId === undefined ? undefined : courses.find((c) => c.id === pickedId);
  const pickedName = pickedCourse ? `${pickedCourse.code} ${displayName(pickedCourse)}` : '';

  const sum = weekSummary(due, now);
  const week = studyWeek(courses.map((c) => c.startdate), now);
  const label = [t('ws.label'), `${heroDay(now * 1000)}${week ? ` · ${t('ws.week', { n: week })}` : ''}`].join(' / ');
  const name = firstName(u?.fullname);
  const hello = t(`ws.greeting.${greeting(new Date(now * 1000).getHours())}` as MessageKey, { name }).replace(/,\s*$/, '');
  const summary = (() => {
    if (!sum.overdue && !sum.dueWeek) return t('ws.summary.none');
    const parts: string[] = [];
    if (sum.overdue) parts.push(t('ws.summary.overdue', { n: sum.overdue }));
    if (sum.dueWeek) parts.push(t('ws.summary.due', { n: sum.dueWeek }));
    return parts.join(' · ');
  })();
  void lang.value;

  const links: HeroLink[] = [
    { key: 'cal', label: t('ws.link.calendar'), href: homeUrl(PAGES.calendar) },
    { key: 'grades', label: t('ws.link.grades'), href: homeUrl(PAGES.grades) },
    { key: 'notifs', label: unread ? `${t('ws.link.notifications')} ${unread}` : t('ws.link.notifications'), href: homeUrl(PAGES.notifications) },
  ];

  const headLabel = tab === 'deadlines' ? t('ws.deadlines') : tab === 'updates' ? t('ws.updates') : t('ws.upNext');
  const count = list.length === 1 ? t('ws.item') : t('ws.items', { n: list.length });
  const unreadInFeed = notifList.value.some((n) => !n.read);

  const onlyEmpty = !loading && !failed && list.length === 0;

  return (
    <main class="kex-main kex-workspace" id="kex-main" data-kex-test="workspace" data-tab={tab}>
      <Hero class="kex-hero--ws" key="ws" label={label} lines={[hello, summary]} links={links} seed={7} />
      <div class="kex-content">
        <PinnedRow pins={rowPins(pins, null, 3)} courseId={null} />
        <div class="kex-matheader">
          <SlideUpText as="h2" class="kex-matheader__title" text={t('ws.thisWeek')} split="words" stagger={0.08} duration={0.6} inView />
          <Tabs<FeedTab> value={tab} onChange={setFeedTab} items={FEED_TABS} label={t('ws.tabs')} idPrefix="kex-ws-tab" panelId="kex-ws-panel" />
        </div>
        <div class="kex-body">
          <CourseColumn />
          <section class="kex-detail kex-feed" id="kex-ws-panel" role="tabpanel" aria-labelledby={`kex-ws-tab-${tab}`} data-kex-test="feed">
            <div class="kex-detail__top kex-feedhead">
              <p class="kex-detail__kicker kex-mono" data-kex-test="feed-label">{headLabel}</p>
              <p class="kex-detail__count kex-mono" data-kex-test="feed-count">{loading ? '' : count}</p>
            </div>
            <div class="kex-feedhead__row">
              {pickedCourse ? (
                <button type="button" class="kex-filterchip kex-mono" data-kex-test="ws-filter" onClick={() => setWsCourse(undefined)} aria-label={`${t('ws.filterOn', { name: pickedName })}, ${t('common.all')}`}>
                  <span>{pickedCourse.code}</span>
                  <X size={13} strokeWidth={1.9} aria-hidden="true" />
                </button>
              ) : <Stamp />}
              {tab === 'updates' && unreadInFeed && (
                <button type="button" class="kex-link kex-feedhead__all" data-kex-test="mark-all-read" onClick={() => void markEverythingRead()}>{t('ws.markAll')}</button>
              )}
            </div>
            {failed ? (
              <EmptyState tone="error" kicker={t('course.errorKicker')} title={t('ws.error')}>
                <Button variant="outlined" arrow={false} onClick={() => void Promise.all([eventsStore().refresh(true), countsStore().refresh(true)])}>{t('course.retry')}</Button>
              </EmptyState>
            ) : loading ? (
              <RowSkeleton n={3} />
            ) : onlyEmpty ? (
              <EmptyState
                kicker={t('ws.emptyKicker')}
                title={pickedCourse && tab !== 'updates' ? t('ws.noneForCourse') : tab === 'updates' ? t('ws.empty.updates') : t('ws.empty.deadlines')}
                text={tab === 'all' && !recentList.value.length ? t('ws.empty.recent') : undefined}
              >
                {tab !== 'updates' && <Button variant="outlined" arrow={false} href={homeUrl(PAGES.calendar)} onClick={(e) => { e.preventDefault(); go(PAGES.calendar); }}>{t('ws.link.calendar')}</Button>}
              </EmptyState>
            ) : (
              <ul class="kex-rows" key={tab} data-kex-test="feed-rows">
                {list.map((item, i) => {
                  const selected = item.key === sel;
                  if (item.type === 'deadline') {
                    return (
                      <Fragment key={item.key}>
                        {startsCourseGroup(list, i) && <CourseHeading courseId={item.item.courseId} code={item.item.courseCode} />}
                        <DeadlineRow item={item} index={i} now={now} selected={selected} first={i === 0} />
                      </Fragment>
                    );
                  }
                  if (item.type === 'continue') return <ContinueRow key={item.key} item={item} index={i} now={now} selected={selected} />;
                  return <UpdateRow key={item.key} item={item} index={i} selected={selected} />;
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
      {preview && (
        <PreviewSheet
          row={preview}
          pinned={isPinned(preview.cm.id, pins)}
          onClose={() => (wsPreview.value = undefined)}
          onOpen={(r, newTab) => go(r.cm.url, newTab)}
          onPin={(r) => {
            const rec = recentList.value.find((x) => x.cmid === r.cm.id);
            if (rec) pinFeedItem({ type: 'continue', key: `c${rec.cmid}`, item: rec });
          }}
        />
      )}
    </main>
  );
}
