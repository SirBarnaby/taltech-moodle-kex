import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { go } from '../../actions/navigate';
import { displayOrder, pinEdit, pinRenaming, reorderPin, retitlePin, unpinItem } from '../../actions/pins';
import type { Pin } from '../../data/model';
import { t } from '../../i18n';
import { unavailablePins } from '../../state/pins';
import { ArrowEast, DocGlyph, PinGlyph } from './Glyphs';

interface PinnedRowProps {
  pins: Pin[];
  /** Course the page belongs to: pins of this course get the highlighted first cell. */
  courseId: number | null;
}

export function RenameInput({ pin }: { pin: Pin }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const done = (save: boolean): void => {
    const v = ref.current?.value ?? '';
    pinRenaming.value = undefined;
    if (save) void retitlePin(pin.cmid, v);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-pin="${pin.cmid}"]`)?.focus());
  };
  return (
    <input
      ref={ref}
      class="kex-pin__rename"
      type="text"
      value={pin.title}
      maxLength={120}
      aria-label={t('pinned.renameLabel')}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          done(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          done(false);
        }
      }}
      onBlur={() => pinRenaming.value !== undefined && done(true)}
    />
  );
}

/** Edit-mode key handling shared by the row cells and the Pinned page rows. */
export function editKeys(e: KeyboardEvent, pin: Pin, order: readonly Pin[], horizontal: boolean): void {
  const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
  const next = horizontal ? 'ArrowRight' : 'ArrowDown';
  if (e.altKey && (e.key === prev || e.key === next)) {
    e.preventDefault();
    e.stopPropagation();
    void reorderPin(pin.cmid, e.key === next ? 1 : -1, order).then(() =>
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-pin="${pin.cmid}"]`)?.focus()),
    );
  } else if (e.key === 'F2') {
    e.preventDefault();
    e.stopPropagation();
    pinRenaming.value = pin.cmid;
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    e.stopPropagation();
    void unpinItem(pin.cmid);
  }
}

/** Three cells: pins of the current course first. Empty cells invite pinning. Edit mode reorders, renames and removes (design-spec §4.4). */
export function PinnedRow({ pins, courseId }: PinnedRowProps) {
  const cells: (Pin | undefined)[] = [pins[0], pins[1], pins[2]];
  const edit = pinEdit.value;
  const renaming = pinRenaming.value;
  const gone = unavailablePins.value;
  const order = displayOrder();
  return (
    <section class="kex-pinned" aria-label={t('course.pinned')}>
      <h2 class="kex-pinned__label kex-mono">{t('course.pinned')}</h2>
      <div class={`kex-pinned__box${edit ? ' kex-pinned__box--edit' : ''}`} data-kex-test="pinned">
        {cells.map((pin, i) => {
          if (!pin) {
            return (
              <div key={`empty-${i}`} class="kex-pin kex-pin--empty">
                <span class="kex-pin__emptybox">{t('course.pinned.empty')}</span>
              </div>
            );
          }
          const hot = i === 0 && pin.courseId === courseId;
          const unavailable = gone.has(pin.cmid);
          const body = (
            <>
              <span class="kex-pin__doc"><DocGlyph /></span>
              <span class="kex-pin__tack"><PinGlyph /></span>
              <span class="kex-pin__text">
                {renaming === pin.cmid ? <RenameInput pin={pin} /> : <span class="kex-pin__title">{pin.title}</span>}
                <span class="kex-pin__code">{unavailable ? t('pinned.unavailable') : pin.courseCode}</span>
              </span>
            </>
          );
          if (edit) {
            return (
              <div
                key={pin.cmid}
                class={`kex-pin kex-pin--editing${hot ? ' kex-pin--hot' : ''}`}
                role="group"
                aria-label={pin.title}
                tabIndex={i === 0 ? 0 : -1}
                data-kex-pin={pin.cmid}
                data-kex-test={`pin-${i + 1}`}
                onKeyDown={(e) => editKeys(e, pin, order, true)}
              >
                {body}
                <span class="kex-pin__tools">
                  <button type="button" class="kex-pin__tool" aria-label={t('pinned.moveEarlier')} title={`${t('pinned.moveEarlier')} (Alt+←)`} onClick={() => void reorderPin(pin.cmid, -1, order)}>
                    <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" class="kex-pin__tool" aria-label={t('pinned.moveLater')} title={`${t('pinned.moveLater')} (Alt+→)`} onClick={() => void reorderPin(pin.cmid, 1, order)}>
                    <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" class="kex-pin__tool" aria-label={t('pinned.rename')} title={t('pinned.rename')} onClick={() => (pinRenaming.value = pin.cmid)}>
                    <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" class="kex-pin__tool kex-pin__tool--remove" aria-label={t('pinned.remove', { title: pin.title })} title={t('pinned.remove', { title: pin.title })} onClick={() => void unpinItem(pin.cmid)}>
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </span>
              </div>
            );
          }
          return (
            <a
              key={pin.cmid}
              class={`kex-pin${hot ? ' kex-pin--hot' : ''}${unavailable ? ' kex-pin--gone' : ''}`}
              href={pin.url}
              data-kex-pin={pin.cmid}
              data-kex-test={`pin-${i + 1}`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                go(pin.url);
              }}
            >
              {body}
              <ArrowEast class="kex-pin__arrow" size={18} strokeWidth={1.7} />
            </a>
          );
        })}
      </div>
      <button type="button" class="kex-pinned__edit" data-kex-test="pinned-edit" aria-pressed={edit} onClick={() => {
        pinEdit.value = !pinEdit.value;
        if (pinEdit.value) requestAnimationFrame(() => document.querySelector<HTMLElement>('.kex-pin--editing')?.focus());
      }}>
        <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
        <span>{edit ? t('pinned.done') : t('course.pinned.edit')}</span>
      </button>
    </section>
  );
}
