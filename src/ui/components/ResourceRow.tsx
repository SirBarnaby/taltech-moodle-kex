import { CircleCheck, Eye } from 'lucide-preact';
import type { RowModel } from '../../data/topics';
import { t } from '../../i18n';
import { sanitizeHtml } from '../../lib/sanitize';
import { Button } from './Button';
import { PinGlyph } from './Glyphs';
import { Thumb, thumbVariant } from './Thumb';

interface ResourceRowProps {
  row: RowModel;
  /** Position in the visible list (1-based): drives the `data-kex-test` ids. */
  index: number;
  /** Zero-padded topic number for doc thumbnails. */
  topicNumber?: string;
  pinned: boolean;
  primary: boolean;
  selected: boolean;
  /** Stagger index for the entry animation (rows past 8 appear instantly). */
  enter?: number;
  onSelect: (cmid: number) => void;
  onOpen: (row: RowModel, newTab: boolean) => void;
  onPreview: (row: RowModel) => void;
  onPin: (row: RowModel) => void;
  onDone: (row: RowModel) => void;
}

const isModified = (e: MouseEvent): boolean => e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;

/** One material (design-spec §4.9): thumb, mono label, title, subtitle, actions, primary button. */
export function ResourceRow({ row, index, topicNumber, pinned, primary, selected, enter, onSelect, onOpen, onPreview, onPin, onDone }: ResourceRowProps) {
  if (row.kind === 'note') {
    return (
      <li class="kex-row kex-row--note" data-kex-note={row.cm.id}>
        <div class="kex-row__note" dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.noteHtml ?? '') }} />
      </li>
    );
  }
  const verb = t(`verb.${row.verb}`);
  const label = row.locked ? t('course.locked') : row.label;
  const subtitle = row.locked ? row.availability ?? row.subtitle : row.subtitle;
  const style = enter !== undefined && enter < 8 ? { '--kex-enter': String(enter) } : undefined;
  return (
    <li
      class={`kex-row${row.locked ? ' kex-row--locked' : ''}${selected ? ' kex-row--selected' : ''}${enter !== undefined && enter < 8 ? ' kex-row--enter' : ''}${row.provisional ? ' kex-row--provisional' : ''}${subtitle ? ' kex-row--sub' : ''}`}
      style={style}
      tabIndex={selected ? 0 : -1}
      data-kex-row={row.cm.id}
      data-kex-test={`row-${index}`}
      data-kind={row.kind}
      aria-label={`${row.title}, ${label}`}
      onFocus={() => onSelect(row.cm.id)}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('a, button')) return;
        onSelect(row.cm.id);
      }}
    >
      <Thumb
        variant={thumbVariant(row.kind, row.format)}
        format={row.format}
        number={topicNumber}
        seed={row.cm.id}
        testId={`row-${index}-thumb`}
      />
      <div class="kex-row__text">
        <p class="kex-row__label kex-mono">{label}</p>
        <h4 class="kex-row__title" data-kex-test={`row-${index}-title`}>
          {row.locked ? (
            <span>{row.title}</span>
          ) : (
            <a
              href={row.cm.url}
              tabIndex={-1}
              onClick={(e) => {
                if (isModified(e)) return;
                e.preventDefault();
                onOpen(row, false);
              }}
            >
              {row.title}
            </a>
          )}
        </h4>
        {subtitle && <p class="kex-row__sub">{subtitle}</p>}
        {!row.locked && (
          <div class="kex-row__actions" role="group" aria-label={t('row.actions', { title: row.title })}>
            <button type="button" class="kex-act" data-act="preview" onClick={() => onPreview(row)}>
              <Eye class="kex-ico-eye" size={19} strokeWidth={1.6} aria-hidden="true" />
              <span>{t('row.preview')}</span>
            </button>
            <button type="button" class={`kex-act${pinned ? ' kex-act--on' : ''}`} data-act="pin" aria-pressed={pinned} onClick={() => onPin(row)}>
              <PinGlyph width={12} height={18} />
              <span>{pinned ? t('row.unpin') : t('row.pin')}</span>
            </button>
            {row.manual && (
              <button type="button" class={`kex-act${row.manual.done ? ' kex-act--on kex-act--done' : ''}`} data-act="done" aria-pressed={row.manual.done} onClick={() => onDone(row)}>
                <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{row.manual.done ? t('row.doneOn') : t('row.done')}</span>
              </button>
            )}
          </div>
        )}
      </div>
      <Button
        variant={primary && !row.locked ? 'filled' : 'outlined'}
        href={row.locked ? undefined : row.cm.url}
        disabled={row.locked}
        locked={row.locked}
        testId={`row-${index}-button`}
        onClick={(e) => {
          if (isModified(e)) return;
          e.preventDefault();
          onOpen(row, false);
        }}
      >
        {row.locked ? t('verb.locked') : verb}
      </Button>
    </li>
  );
}
