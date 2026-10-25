import { Megaphone, X } from 'lucide-preact';
import { useEffect, useMemo } from 'preact/hooks';
import { updateSettings } from '../../actions/settings';
import { pushToast } from '../../actions/toasts';
import { liveNotices, noticeFromHtml, scanNotices, type SiteNotice } from '../../content/sitenotice';
import { dashboardStore } from '../../data/repo/dashboard';
import { t } from '../../i18n';
import { pageDoc, settings } from '../../state';

/** Moodle and TalTech notices (page alerts, body-level banners and the dashboard announcement block) as one quiet card each: a small icon, Moodle's own words and links, and Hide (until the text changes). */
export function SiteNotices() {
  const doc = pageDoc.value;
  // A page opened in place brings its own Moodle document: its top-of-page alerts count too.
  const fromDoc = useMemo<SiteNotice[]>(() => (doc && doc !== document ? scanNotices(doc).map((f) => f.notice) : []), [doc]);
  // The dashboard's own announcement block (block_advnotifications), read from /my/ when this page does not have it.
  const dash = dashboardStore();
  useEffect(() => { void dash.refresh(); }, []);
  const blocks = dash.value.value?.blocks;
  const fromDash = useMemo<SiteNotice[]>(() => (blocks ?? []).filter((b) => b.notice).flatMap((b) => noticeFromHtml(b.html) ?? []), [blocks]);
  const hidden = new Set(settings.value.hiddenNotices);
  const seen = new Set<string>();
  const list = [...liveNotices.value, ...fromDoc, ...fromDash].filter((n) => !hidden.has(n.key) && !seen.has(n.key) && seen.add(n.key));
  if (!list.length) return null;
  const hide = (n: SiteNotice): void => {
    updateSettings({ hiddenNotices: [...settings.value.hiddenNotices, n.key] });
    pushToast(t('notice.hidden'));
  };
  return (
    <section class="kex-notices" aria-label={t('notice.kicker')} data-kex-test="site-notices">
      {list.map((n) => (
        <article key={n.key} class="kex-notice" data-kex-notice={n.key}>
          <span class="kex-notice__icon" aria-hidden="true">
            {n.icon ? <img src={n.icon} alt="" width={40} height={40} decoding="async" /> : <Megaphone size={20} strokeWidth={1.6} />}
          </span>
          <div class="kex-notice__body">
            <p class="kex-notice__kicker kex-mono">{t('notice.kicker')}</p>
            <div class="kex-notice__text" dangerouslySetInnerHTML={{ __html: n.html }} />
          </div>
          <button type="button" class="kex-act kex-notice__hide" onClick={() => hide(n)} data-kex-test="notice-hide">
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('notice.hide')}</span>
          </button>
        </article>
      ))}
    </section>
  );
}
