import { Pencil } from 'lucide-preact';
import type { Pin } from '../../data/model';
import { t } from '../../i18n';
import { go } from '../../actions/navigate';
import { ArrowEast, DocGlyph, PinGlyph } from './Glyphs';

interface PinnedRowProps {
  pins: Pin[];
  /** Course the page belongs to: pins of this course get the highlighted first cell. */
  courseId: number | null;
  onEdit?: () => void;
}

/** Three cells: pins of the current course first. Empty cells invite pinning (design-spec §4.4). */
export function PinnedRow({ pins, courseId, onEdit }: PinnedRowProps) {
  const cells: (Pin | undefined)[] = [pins[0], pins[1], pins[2]];
  return (
    <section class="kex-pinned" aria-label={t('course.pinned')}>
      <h2 class="kex-pinned__label kex-mono">{t('course.pinned')}</h2>
      <div class="kex-pinned__box" data-kex-test="pinned">
        {cells.map((pin, i) =>
          pin ? (
            <a
              key={pin.cmid}
              class={`kex-pin${i === 0 && pin.courseId === courseId ? ' kex-pin--hot' : ''}`}
              href={pin.url}
              data-kex-test={`pin-${i + 1}`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                go(pin.url);
              }}
            >
              <span class="kex-pin__doc"><DocGlyph /></span>
              <span class="kex-pin__tack"><PinGlyph /></span>
              <span class="kex-pin__text">
                <span class="kex-pin__title">{pin.title}</span>
                <span class="kex-pin__code">{pin.courseCode}</span>
              </span>
              <ArrowEast class="kex-pin__arrow" size={18} strokeWidth={1.7} />
            </a>
          ) : (
            <div key={`empty-${i}`} class="kex-pin kex-pin--empty">
              <span class="kex-pin__emptybox">{t('course.pinned.empty')}</span>
            </div>
          ),
        )}
      </div>
      <button type="button" class="kex-pinned__edit" data-kex-test="pinned-edit" onClick={onEdit}>
        <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
        <span>{t('course.pinned.edit')}</span>
      </button>
    </section>
  );
}
