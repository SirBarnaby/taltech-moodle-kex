import { t } from '../../i18n';
import { RowSkeleton } from './States';

export function NavigationSkeleton() {
  return (
    <main class="kex-main kex-navigation-skeleton" id="kex-main" data-kex-ready="false" aria-busy="true" aria-label={t('preview.loading')}>
      <div class="kex-content">
        <span class="kex-skel kex-skel--title" aria-hidden="true" />
        <RowSkeleton n={5} />
      </div>
    </main>
  );
}
