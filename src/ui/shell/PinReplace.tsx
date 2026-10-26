import { effect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { cancelPinReplace, notePinOpened, pinReplace, replacePinAt } from '../../actions/pins';
import { pinsStore, rowPins } from '../../data/repo/pins';
import { t } from '../../i18n';
import { pageInfo, route } from '../../state';
import { previewCmId } from '../../state/course';
import { PinMark } from '../components/PinnedRow';

/**
 * Shell-wide pin effects: the replace question ends when the page changes (its keys, 1 to 3 and Esc, are global bindings), and
 * pinned materials note when they were opened (their page, or the side reader) for the Dossier's recent pins.
 */
export function usePinEffects(): void {
  useEffect(() => {
    // Leaving the page (another course, another view) drops the question.
    let first = true;
    const stopRoute = effect(() => {
      void route.value;
      if (first) first = false;
      else cancelPinReplace();
    });
    const stopOpened = effect(() => {
      const cmid = previewCmId.value ?? pageInfo.value?.cmId;
      if (pinsStore().value.value) notePinOpened(cmid);
    });
    return () => {
      stopRoute();
      stopOpened();
    };
  }, []);
}

/** The question card above the toasts: which of the course's three pins the new one replaces. */
export function PinReplaceCard() {
  const pin = pinReplace.value;
  if (!pin) return null;
  const row = rowPins(pinsStore().value.value ?? [], pin.courseId);
  return (
    <div class="kex-replace" role="group" aria-label={t('pinned.replaceAsk', { title: pin.title })} data-kex-test="pin-replace">
      <p class="kex-replace__ask">{t('pinned.replaceAsk', { title: pin.title })}</p>
      <ol class="kex-replace__list">
        {row.map((p, i) => (
          <li key={p.cmid}>
            <button type="button" class="kex-replace__slot" title={p.title} onClick={() => void replacePinAt(i)}>
              <span class="kex-replace__num kex-mono">{i + 1}</span>
              <span class="kex-replace__mark"><PinMark pin={p} /></span>
              <span class="kex-replace__title">{p.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <p class="kex-replace__keys">
        <span>{t('pinned.replaceKeys')}</span>
        <button type="button" class="kex-replace__cancel" onClick={cancelPinReplace}>{t('pinned.replaceCancel')}</button>
      </p>
    </div>
  );
}
