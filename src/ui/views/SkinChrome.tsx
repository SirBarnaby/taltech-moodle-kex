import { ArrowLeft, ArrowRight, CircleCheck, Copy, Download, ExternalLink, FileText, Globe, Pin as PinIcon } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { copyUrlTarget, downloadUrl, loadNeighbourState, pinFromPage, pinPage, toggleDonePage, openNewTab } from '../../actions/skin';
import { go, homeUrl } from '../../actions/navigate';
import { eyebrow } from '../../data/topics';
import { typeNameFor } from '../../data/repo/modnames';
import { cmDetails } from '../../data/repo/cmdetails';
import { isPinned, pinsStore } from '../../data/repo/pins';
import { placedLabel } from '../../data/neighbours';
import { displayName } from '../../data/repo/courses';
import { t, type MessageKey } from '../../i18n';
import { pageInfo, route, sidebarCourses, user } from '../../state';
import { isActivity, neighbours, skinPage } from '../../state/skin';
import { Band } from '../components/Band';
import { SiteNotices } from '../components/SiteNotices';
import { useEffectsConfig } from '../components/hooks';
import { Tabs, type TabDef } from '../components/Tabs';
import { pad2 } from '../../data/topics';

/** Course code of the page's course, from the sidebar list or the breadcrumb. */
function courseCode(): string {
  const info = pageInfo.value;
  if (!info || info.courseId <= 1) return '';
  const c = sidebarCourses.value.find((x) => x.id === info.courseId);
  if (c) return c.code;
  const crumb = info.breadcrumb.find((b) => /\b[A-Z]{3}\d{4}\b/.test(b.text));
  return /\b[A-Z]{3}\d{4}\b/.exec(crumb?.text ?? '')?.[0] ?? '';
}

/** `CODE / TOPIC 05 / FILE` (Moodle's module name) for activities; the page area for the rest. */
export function chromeLabel(): string {
  const info = pageInfo.value;
  const r = route.value;
  const code = courseCode();
  if (isActivity.value && info?.cmId) {
    const modname = r?.mod ?? '';
    const n = neighbours.value?.current.section.number;
    const word = eyebrow(typeNameFor(modname, cmDetails.value.get(info.cmId)));
    return [code, n ? `${t('course.topic')} ${pad2(n)}` : '', word].filter(Boolean).join(' / ');
  }
  return pageLabel(code);
}

/** Page chrome label by area (page-designs §8-§16). */
export function pageLabel(code: string): string {
  const path = location.pathname;
  const area = (k: Parameters<typeof t>[0]): string => t(k);
  if (/\/grade\/report\/user\/|\/course\/user\.php/.test(path)) return [area('area.grades'), code].filter(Boolean).join(' / ');
  if (/\/user\/index\.php/.test(path)) return [area('area.participants'), code].filter(Boolean).join(' / ');
  if (/\/calendar\//.test(path)) {
    const heading = skinPage.value?.calendar?.heading;
    return heading ? `${area('area.calendar')} / ${heading.toUpperCase()}` : area('area.calendar');
  }
  if (/\/message\//.test(path)) return area('area.messages');
  if (/\/user\/(profile|view)\.php/.test(path)) return area('area.profile');
  if (/\/user\/(preferences|editadvanced|edit)\.php|\/message\/notificationpreferences|\/user\/.*preferences/.test(path)) return area('area.preferences');
  if (/\/badges\//.test(path)) return area('area.badges');
  if (/\/course\/(index|management)\.php|^\/$/.test(path)) return area('area.catalogue');
  if (/\/(course|search)\/search\.php|\/search\/index\.php/.test(path)) {
    const q = searchQuery();
    return q ? `${area('area.search')} / "${q.toUpperCase()}"` : area('area.search');
  }
  if (/\/user\/files\.php/.test(path)) return area('area.files');
  const crumbs = pageInfo.value?.breadcrumb ?? [];
  const tail = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (tail?.text ?? code ?? '').toUpperCase().slice(0, 48);
}

function searchQuery(): string {
  const p = new URLSearchParams(location.search);
  return (p.get('search') ?? p.get('q') ?? '').trim().slice(0, 40);
}

const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

/** Band title: the course's short name on course-scoped reports, the area for pages Moodle titles with the user's own name. */
export function chromeTitle(heading: string): string {
  const path = location.pathname;
  const info = pageInfo.value;
  const course = info && info.courseId > 1 ? sidebarCourses.value.find((c) => c.id === info.courseId) : undefined;
  if (course && /\/grade\/report\/user\/|\/course\/user\.php|\/user\/index\.php/.test(path)) return displayName(course);
  if (/\/calendar\//.test(path)) return titleCase(t('area.calendar'));
  if (/\/(course|search)\/search\.php|\/search\/index\.php/.test(path)) return titleCase(t('area.search'));
  const own = user.value?.fullname;
  if (own && heading === own) {
    const key: MessageKey | undefined = /\/badges\//.test(path) ? 'area.badges' : /preferences|\/user\/(edit|editadvanced|language|forum|editor|calendar|contentbank)\.php|\/login\/change_password/.test(path) ? 'area.preferences' : /\/user\/files\.php/.test(path) ? 'area.files' : undefined;
    if (key) return titleCase(t(key));
  }
  return heading;
}

/** Moodle's calendar view switch (Month / Day / Upcoming) as our tabs; a click presses Moodle's own dropdown item so its JS runs. */
function CalendarTabs() {
  const cal = skinPage.value?.calendar;
  if (!cal || cal.views.length < 2) return null;
  const items: TabDef<string>[] = cal.views.map((v) => ({ key: v.view, label: 'nav.calendar' as MessageKey, text: v.label, digit: '' }));
  const active = cal.views.find((v) => v.active)?.view ?? cal.views[0]?.view ?? '';
  const press = (view: string): void => {
    const item = document.querySelector<HTMLElement>(`[data-region="view-selector"] .dropdown-item[data-view="${view}"]`);
    if (!item) return;
    // Moodle's handler calls preventDefault. If it has not attached yet (early click), load the view's own URL instead.
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    item.dispatchEvent(ev);
    if (!ev.defaultPrevented) {
      const d = item.dataset;
      const u = new URL('/calendar/view.php', location.origin);
      u.searchParams.set('view', view);
      if (d.courseid && d.courseid !== '1') u.searchParams.set('course', d.courseid);
      if (view !== 'upcoming' && d.year && d.month && d.day) u.searchParams.set('time', String(Math.floor(new Date(+d.year, +d.month - 1, +d.day).getTime() / 1000)));
      location.assign(u.href);
    }
  };
  return (
    <div class="kex-content kex-chrome-tabs" data-kex-test="cal-tabs">
      <div class="kex-matheader">
        <Tabs<string> value={active} onChange={press} items={items} label={t('nav.calendar')} idPrefix="kex-cal-tab" panelId="region-main" />
      </div>
    </div>
  );
}

function ChromeActions() {
  const sp = skinPage.value;
  const pin = pinFromPage();
  const pinned = pin ? isPinned(pin.cmid, pinsStore().value.value ?? []) : false;
  const dl = downloadUrl();
  return (
    <>
      {pin && (
        <button type="button" class="kex-bandbtn" aria-pressed={pinned} data-kex-test="chrome-pin" onClick={pinPage}>
          <PinIcon size={16} strokeWidth={1.75} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
          {pinned ? t('chrome.unpin') : t('chrome.pin')}
        </button>
      )}
      {sp?.manual && (
        <button type="button" class="kex-bandbtn" aria-pressed={sp.manual.done} data-kex-test="chrome-done" onClick={toggleDonePage}>
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
          {sp.manual.done ? t('chrome.done') : t('chrome.markDone')}
        </button>
      )}
      {isActivity.value && (
        <button type="button" class="kex-bandbtn" data-kex-test="chrome-newtab" onClick={openNewTab}>
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('chrome.newTab')}
        </button>
      )}
      {dl && (
        <a class="kex-bandbtn" href={dl} data-kex-test="chrome-download">
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('chrome.download')}
        </a>
      )}
    </>
  );
}

function ErrorActions() {
  const cont = document.querySelector<HTMLAnchorElement>('.continuebutton a, .continuebutton button, #notice .btn-primary')?.getAttribute('href');
  return (
    <>
      <button type="button" class="kex-bandbtn" data-kex-test="chrome-back" onClick={() => history.back()}>{t('chrome.back')}</button>
      <a class="kex-bandbtn" href={homeUrl('/my/')} data-kex-test="chrome-home">{t('nav.workspace')}</a>
      {cont && <a class="kex-bandbtn" href={cont} data-kex-test="chrome-continue">{t('chrome.continue')}</a>}
    </>
  );
}

function ChromeMeta() {
  const sp = skinPage.value;
  if (!sp || !isActivity.value) return null;
  const items: string[] = [...sp.dates];
  if (sp.manual) items.push(sp.manual.done ? t('chrome.done') : t('chrome.todo'));
  else if (sp.auto) items.push(sp.auto);
  if (!items.length) return null;
  return (
    <>
      {items.map((x, i) => (
        <span key={i}>{x}</span>
      ))}
    </>
  );
}

const PREVIEWABLE = /\.(pdf|png|jpe?g|gif|webp|svg|txt|mp4|webm|mp3|ogg|wav|html?)(\?|$)/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** URL activity: Moodle's "Click on ... to open the resource" becomes a card (page-designs §7). */
function UrlCard({ href }: { href: string }) {
  return (
    <section class="kex-urlcard" data-kex-test="urlcard">
      <span class="kex-urlcard__glyph" aria-hidden="true"><Globe size={28} strokeWidth={1.5} /></span>
      <div class="kex-urlcard__text">
        <p class="kex-mono kex-urlcard__host" data-kex-test="urlcard-host">{hostOf(href)}</p>
        <p class="kex-urlcard__url" title={href}>{href}</p>
      </div>
      <div class="kex-urlcard__actions">
        <button type="button" class="kex-btn kex-btn--outlined" data-kex-test="urlcard-copy" onClick={copyUrlTarget}>
          <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('url.copy')}<kbd class="kex-kbd">c</kbd>
        </button>
        <a class="kex-btn kex-btn--filled" href={href} target="_blank" rel="noopener" data-kex-test="urlcard-open">
          {t('url.open')}
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

/** Resource page that Moodle shows as "click to open": a full-height preview of the file, or a download card. */
function FileViewer({ url, name, details }: { url: string; name: string; details: string }) {
  if (PREVIEWABLE.test(url)) {
    return <iframe class="kex-viewer" src={url} title={t('file.preview', { name })} data-kex-test="viewer" />;
  }
  return (
    <section class="kex-urlcard" data-kex-test="filecard">
      <span class="kex-urlcard__glyph" aria-hidden="true"><FileText size={28} strokeWidth={1.5} /></span>
      <div class="kex-urlcard__text">
        <p class="kex-mono kex-urlcard__host">{details || name}</p>
        <p class="kex-urlcard__url">{name}</p>
        <p class="kex-urlcard__hint">{t('file.noPreview')}</p>
      </div>
      <div class="kex-urlcard__actions">
        <a class="kex-btn kex-btn--filled" href={downloadUrl() ?? url} data-kex-test="filecard-download">
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('chrome.download')}
        </a>
      </div>
    </section>
  );
}

/** The content cards under the band (URL card, file viewer), which replace Moodle's own "click here" markup. */
function ChromeBody() {
  const sp = skinPage.value;
  const r = route.value;
  if (!sp || r?.key !== 'activity') return null;
  if (r.mod === 'url' && sp.urlTarget) return <UrlCard href={sp.urlTarget} />;
  if (r.mod === 'resource' && sp.fileUrl && sp.file && !sp.file.embedded) return <FileViewer url={sp.fileUrl} name={sp.file.name} details={sp.file.details} />;
  return null;
}

/** The sticky previous / next bar under an activity (page-designs §0). */
export function PrevNextBar() {
  const n = neighbours.value;
  if (!n || (!n.prev && !n.next)) return null;
  return (
    <nav class="kex-pn" aria-label={t('pn.nav')} data-kex-test="prevnext">
      {n.prev ? (
        <a class="kex-pn__link kex-pn__link--prev" href={n.prev.cm.url} rel="prev" data-kex-test="pn-prev" onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          go(n.prev?.cm.url ?? '');
        }}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          <span class="kex-pn__text">{placedLabel(n.prev)}</span>
          <kbd class="kex-kbd">[</kbd>
        </a>
      ) : <span />}
      {n.next ? (
        <a class="kex-pn__link kex-pn__link--next" href={n.next.cm.url} rel="next" data-kex-test="pn-next" onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          go(n.next?.cm.url ?? '');
        }}>
          <kbd class="kex-kbd">]</kbd>
          <span class="kex-pn__text">{t('pn.next')}: {n.next.cm.name}</span>
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
      ) : <span />}
    </nav>
  );
}

/** The band above Moodle's own content for Skin+ pages (replaces `#page-header`, which the skin CSS hides). */
export function SkinChrome() {
  useEffectsConfig();
  useEffect(() => loadNeighbourState(), []);
  const sp = skinPage.value;
  const activity = isActivity.value;
  const err = sp?.error;
  const card = !err && activity && ((route.value?.mod === 'url' && !!sp?.urlTarget) || (route.value?.mod === 'resource' && !!sp?.fileUrl && sp.file?.embedded === false));
  useEffect(() => {
    const root = document.documentElement;
    if (card) root.setAttribute('data-kex-card', route.value?.mod ?? '');
    else root.removeAttribute('data-kex-card');
    return () => root.removeAttribute('data-kex-card');
  }, [card, route.value?.mod]);
  const label = err ? `${t('area.error')} / ${err.code.toUpperCase()}` : chromeLabel();
  return (
    <>
      <div class="kex-chrome" data-kex-test="chrome" data-activity={activity ? 'true' : 'false'}>
        <Band
          label={label}
          title={err ? err.message || sp?.title || '' : chromeTitle(sp?.title ?? pageInfo.value?.heading ?? '')}
          size={activity ? 'activity' : 'page'}
          actions={err ? <ErrorActions /> : activity ? <ChromeActions /> : undefined}
          meta={activity ? <ChromeMeta /> : undefined}
          testId="band"
        />
        {!err && !activity && <CalendarTabs />}
        <div class="kex-chrome__notices"><SiteNotices live /></div>
      </div>
      <ChromeBody />
      {activity && <PrevNextBar />}
    </>
  );
}
