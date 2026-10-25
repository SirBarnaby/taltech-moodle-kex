import { Megaphone, X } from 'lucide-preact';
import { useEffect, useMemo } from 'preact/hooks';
import { updateSettings } from '../../actions/settings';
import { pushToast } from '../../actions/toasts';
import { liveNotices, noticeFromHtml, sameNotice, scanNotices, type SiteNotice } from '../../content/sitenotice';
import { dashboardStore } from '../../data/repo/dashboard';
import { t } from '../../i18n';
import { pageDoc, settings } from '../../state';

/**
 * Moodle and TalTech notices (page alerts, body-level banners and the dashboard announcement block) as one quiet card each: a
 * small icon, Moodle's own words and links, and Hide (until the text changes). `live` (skinned Moodle pages): only the banners
 * found on this page, which would otherwise show unstyled (TalTech's comes with a giant thumbs-up).
 */
export function SiteNotices({ live = false }: { live?: boolean } = {}) {
  const doc = pageDoc.value;
  // A page opened in place brings its own Moodle document: its top-of-page alerts count too.
  const fromDoc = useMemo<SiteNotice[]>(() => (!live && doc && doc !== document ? scanNotices(doc).map((f) => f.notice) : []), [doc, live]);
  // The dashboard's own announcement block (block_advnotifications), read from /my/ when this page does not have it.
  const dash = dashboardStore();
  useEffect(() => { if (!live) void dash.refresh(); }, [live]);
  const blocks = live ? undefined : dash.value.value?.blocks;
  const fromDash = useMemo<SiteNotice[]>(() => (blocks ?? []).filter((b) => b.notice).flatMap((b) => noticeFromHtml(b.html) ?? []), [blocks]);
  const hidden = new Set(settings.value.hiddenNotices);
  // One message placed in two slots (top of body and footer, a longer and a shorter wording) is one notice, hidden together.
  const all = [...liveNotices.value, ...fromDoc, ...fromDash];
  const hiddenOnes = all.filter((n) => hidden.has(n.key));
  const list: SiteNotice[] = [];
  for (const n of all) if (!hiddenOnes.some((h) => sameNotice(h, n)) && !list.some((x) => sameNotice(x, n))) list.push(n);
  if (!list.length) return null;
  const hide = (n: SiteNotice): void => {
    const keys = all.filter((x) => sameNotice(x, n)).map((x) => x.key);
    updateSettings({ hiddenNotices: [...new Set([...settings.value.hiddenNotices, ...keys])] });
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
