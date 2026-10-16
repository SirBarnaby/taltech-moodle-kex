import { CircleCheck } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { initNotifications, loadMore, openNotif, selectNotif } from '../../actions/notifications';
import { markEverythingRead, markNotifRead } from '../../actions/workspace';
import { moreBusy, moreDone, notifsStore, type Notif } from '../../data/repo/notifs';
import { t, formatDate, type MessageKey } from '../../i18n';
import { sanitizeHtml } from '../../lib/sanitize';
import { relTime } from '../../lib/time';
import { allNotifs, nfSel } from '../../state/notifications';
import { nowSec, unreadCount } from '../../state/workspace';
import { Band } from '../components/Band';
import { Button } from '../components/Button';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { EmptyState } from '../components/States';

const KIND_WORD: Record<Notif['kind'], MessageKey> = {
  announcement: 'label.announcement',
  forum: 'label.forum',
  message: 'label.message',
  assign: 'label.assignment',
  quiz: 'label.quiz',
  other: 'label.notification',
};

const kindLabel = (n: Notif): string => (n.courseCode ? `${t(KIND_WORD[n.kind])} / ${n.courseCode}` : t(KIND_WORD[n.kind]));

function Row({ n, selected, index, now }: { n: Notif; selected: boolean; index: number; now: number }) {
  return (
    <li
      class={`kex-nfrow${selected ? ' kex-nfrow--selected' : ''}${n.read ? '' : ' kex-nfrow--unread'}`}
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-kex-nf={n.id}
      data-kex-test={`nf-row-${index + 1}`}
      aria-label={`${n.subject}${n.read ? '' : `, ${t('nf.unreadDot')}`}`}
      onClick={() => selectNotif(n.id)}
      onFocus={() => selectNotif(n.id)}
    >
      <span class="kex-nfrow__dot" aria-hidden="true" />
      <span class="kex-nfrow__text">
        <span class="kex-nfrow__subject">{n.subject}</span>
        <span class="kex-nfrow__meta kex-mono">
          {kindLabel(n).toUpperCase()} · {relTime(n.created - now).toUpperCase()}
        </span>
      </span>
    </li>
  );
}

function Detail({ n }: { n: Notif | undefined }) {
  if (!n) return <p class="kex-nfdetail__none kex-mono">{t('nf.select')}</p>;
  return (
    <article class="kex-nfdetail" aria-label={t('nf.detail')} data-kex-test="nf-detail" key={n.id}>
      <p class="kex-nfdetail__kicker kex-mono">{kindLabel(n).toUpperCase()}</p>
      <h2 class="kex-nfdetail__title">{n.subject}</h2>
      <p class="kex-nfdetail__when kex-mono">{formatDate(n.created * 1000, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/,/g, '').toUpperCase()}</p>
      <div class="kex-nfdetail__body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.html) }} />
      <div class="kex-nfdetail__actions">
        {n.contextUrl && (
          <Button variant="filled" href={n.contextUrl} testId="nf-open" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            openNotif(n.id);
          }}>
            {n.contextName && n.contextName.length < 28 ? n.contextName : t('nf.open')}
          </Button>
        )}
        {!n.read && (
          <Button variant="outlined" arrow={false} testId="nf-read" onClick={() => void markNotifRead(n.id)}>
            {t('nf.markRead')}
          </Button>
        )}
      </div>
    </article>
  );
}

export function NotificationsView() {
  useEffectsConfig();
  useQuietFocus();
  useEffect(() => initNotifications(), []);

  const list = allNotifs.value;
  const unread = unreadCount.value;
  const now = nowSec.value;
  const store = notifsStore();
  const loading = store.value.value === undefined && store.status.value !== 'error';
  const failed = store.value.value === undefined && store.status.value === 'error';
  const sel = list.find((n) => n.id === nfSel.value);
  const label = unread > 0 ? t('nf.labelUnread', { n: unread }) : t('nf.labelRead');

  const actions = (
    <button type="button" class="kex-bandbtn" data-kex-test="nf-readall" disabled={unread === 0} onClick={() => void markEverythingRead()}>
      <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
      {t('nf.markAll')}
    </button>
  );

  return (
    <main class="kex-main kex-notifs" id="kex-main" data-kex-test="notifications" data-unread={unread}>
      <Band label={label} title={t('nf.title')} actions={actions} seed={9} testId="band" />
      <div class="kex-content">
        {failed ? (
          <EmptyState tone="error" kicker={t('course.errorKicker')} title={t('nf.error')}>
            <Button variant="outlined" arrow={false} onClick={() => void store.refresh(true)}>{t('course.retry')}</Button>
          </EmptyState>
        ) : loading ? (
          <div class="kex-nf kex-nf--skel" aria-hidden="true">
            <ul class="kex-nflist">
              {Array.from({ length: 6 }, (_, i) => (
                <li class="kex-nfrow" key={i}><span class="kex-skel kex-skel--line kex-skel--w1" /></li>
              ))}
            </ul>
          </div>
        ) : list.length === 0 ? (
          <EmptyState kicker={t('ws.emptyKicker')} title={t('nf.empty')} text={t('nf.emptyText')} />
        ) : (
          <div class="kex-nf">
            <div class="kex-nflist" data-kex-test="nf-list">
              <ul role="listbox" aria-label={t('nf.list')}>
                {list.map((n, i) => (
                  <Row key={n.id} n={n} index={i} selected={n.id === nfSel.value} now={now} />
                ))}
              </ul>
              <div class="kex-nflist__more">
                {moreDone.value || (store.value.value?.length ?? 0) < 20 ? (
                  <span class="kex-mono kex-nflist__end">{t('nf.end')}</span>
                ) : (
                  <Button variant="outlined" arrow={false} testId="nf-more" disabled={moreBusy.value} onClick={() => void loadMore()}>
                    {moreBusy.value ? t('nf.loading') : t('nf.loadMore')}
                  </Button>
                )}
              </div>
            </div>
            <section class="kex-nfpane" aria-live="polite">
              <Detail n={sel} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
