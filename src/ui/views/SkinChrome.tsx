import { ArrowLeft, ArrowRight, CircleCheck, Download, ExternalLink, Pin as PinIcon } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { downloadUrl, gotoNeighbour, loadNeighbourState, pinFromPage, pinPage, toggleDonePage, openNewTab } from '../../actions/skin';
import { go, homeUrl } from '../../actions/navigate';
import { classifyFormat, classifyKind, monoLabel } from '../../data/classify';
import { cmDetails } from '../../data/repo/cmdetails';
import { isPinned, pinsStore } from '../../data/repo/pins';
import { placedLabel } from '../../data/neighbours';
import { t } from '../../i18n';
import { pageInfo, route, sidebarCourses } from '../../state';
import { isActivity, neighbours, skinPage } from '../../state/skin';
import { Band } from '../components/Band';
import { useEffectsConfig } from '../components/hooks';
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

/** `CODE / TOPIC 05 / LECTURE · PDF` for activities; the page area for the rest. */
export function chromeLabel(): string {
  const info = pageInfo.value;
  const sp = skinPage.value;
  const r = route.value;
  const code = courseCode();
  if (isActivity.value && info?.cmId) {
    const modname = r?.mod ?? '';
    const kind = classifyKind({ modname, name: sp?.title ?? '' });
    const format = cmDetails.value.get(info.cmId)?.format ?? classifyFormat({ modname, name: sp?.title ?? '' }, kind);
    const n = neighbours.value?.current.section.number;
    return [code, n ? `${t('course.topic')} ${pad2(n)}` : '', monoLabel(kind, format).replace(' / ', ' · ')].filter(Boolean).join(' / ');
  }
  return pageLabel(code);
}

/** Page chrome label by area (page-designs §8-§16). */
export function pageLabel(code: string): string {
  const path = location.pathname;
  const area = (k: Parameters<typeof t>[0]): string => t(k);
  if (/\/grade\/report\/user\/|\/course\/user\.php/.test(path)) return [area('area.grades'), code].filter(Boolean).join(' / ');
  if (/\/user\/index\.php/.test(path)) return [area('area.participants'), code].filter(Boolean).join(' / ');
  if (/\/calendar\//.test(path)) return area('area.calendar');
  if (/\/message\//.test(path)) return area('area.messages');
  if (/\/user\/(profile|view)\.php/.test(path)) return area('area.profile');
  if (/\/user\/(preferences|editadvanced|edit)\.php|\/message\/notificationpreferences|\/user\/.*preferences/.test(path)) return area('area.preferences');
  if (/\/badges\//.test(path)) return area('area.badges');
  if (/\/course\/(index|management)\.php|^\/$/.test(path)) return area('area.catalogue');
  if (/\/(course|search)\/search\.php|\/search\/index\.php/.test(path)) return area('area.search');
  if (/\/user\/files\.php/.test(path)) return area('area.files');
  const crumbs = pageInfo.value?.breadcrumb ?? [];
  const tail = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (tail?.text ?? code ?? '').toUpperCase().slice(0, 48);
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
  const label = err ? `${t('area.error')} / ${err.code.toUpperCase()}` : chromeLabel();
  return (
    <>
      <div class="kex-chrome" data-kex-test="chrome" data-activity={activity ? 'true' : 'false'}>
        <Band
          label={label}
          title={sp?.title ?? pageInfo.value?.heading ?? ''}
          size={activity ? 'activity' : 'page'}
          actions={err ? <ErrorActions /> : activity ? <ChromeActions /> : undefined}
          meta={activity ? <ChromeMeta /> : undefined}
          seed={pageInfo.value?.cmId ?? pageInfo.value?.courseId ?? 3}
          testId="band"
        />
      </div>
      {activity && <PrevNextBar />}
    </>
  );
}
