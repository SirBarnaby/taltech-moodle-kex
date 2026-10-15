import { sessionExpired } from '../../data/ws';
import { t } from '../../i18n';
import { pageInfo } from '../../state';

/** Sticky banner under the header when Moodle reports an expired session. Cached views stay readable. */
export function SessionBanner() {
  if (!sessionExpired.value) return null;
  const root = pageInfo.value?.wwwroot ?? '';
  return (
    <div class="kex-banner" role="alert" data-kex-test="session-banner">
      <span>{t('banner.session')}</span>
      <a href={`${root}/login/index.php`}>{t('banner.login')}</a>
    </div>
  );
}
