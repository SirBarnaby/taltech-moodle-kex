import { useEffect } from 'preact/hooks';
import { dashboardStore } from '../../data/repo/dashboard';
import { homeUrl } from '../../actions/navigate';
import { t } from '../../i18n';

/** University's own announcements remain visible; reference material uses progressive disclosure. */
export function MoodleInfo() {
  const store = dashboardStore();
  useEffect(() => { void store.refresh(); }, []);
  const blocks = store.value.value?.blocks ?? [];
  const inventory = store.value.value?.inventory ?? [];
  const references = inventory.filter((item) => item.disposition !== 'shown');
  if (!blocks.length && !references.length && store.status.value !== 'error') return null;
  return (
    <section class="kex-moodle-info" aria-label={t('home.info')} data-kex-test="moodle-info">
      {blocks.filter((b) => b.notice).map((b, i) => <div key={i} class="kex-moodle-info__notice" role="note" onErrorCapture={(e) => { if (e.target instanceof HTMLImageElement) e.target.replaceWith(document.createTextNode(e.target.alt)); }} dangerouslySetInnerHTML={{ __html: b.html }} />)}
      {(blocks.some((b) => !b.notice) || references.length > 0) && (
        <details class="kex-moodle-info__details">
          <summary>{t('home.info')}</summary>
          <div class="kex-moodle-info__grid">
            {blocks.filter((b) => !b.notice).map((b, i) => <article key={i}><h2>{b.title}</h2><div dangerouslySetInnerHTML={{ __html: b.html }} /></article>)}
          </div>
          <nav aria-label={t('home.original')} class="kex-moodle-info__sources">
            {references.map((item, i) => <a key={i} href={homeUrl(item.path)}>{item.title}</a>)}
            <a href={homeUrl('/my/?kex=off')}>{t('home.original')}</a>
          </nav>
        </details>
      )}
      {store.status.value === 'error' && <p role="status">{blocks.length > 0 && `${t('data.stale')} `}<a class="kex-link" href={homeUrl(store.source.originalPath)}>{t('home.original')}</a></p>}
    </section>
  );
}
