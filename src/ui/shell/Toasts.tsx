import { dismissToast } from '../../actions/toasts';
import { toasts } from '../../state';
import { PinReplaceCard } from './PinReplace';

/** Bottom-centre toasts in an aria-live region. */
export function Toasts() {
  return (
    <div class="kex-toasts" role="status" aria-live="polite">
      <PinReplaceCard />
      {toasts.value.map((t) => (
        <div key={t.id} class="kex-toast">
          <span>{t.message}</span>
          {t.actionLabel && (
            <button
              type="button"
              class="kex-toast__action"
              onClick={() => {
                t.onAction?.();
                dismissToast(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
