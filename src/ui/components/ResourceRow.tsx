import { Check, ChevronRight, CircleCheck, ExternalLink, Eye, Lock, Pin } from 'lucide-preact';
import { cmDetailsMissed } from '../../data/repo/cmdetails';
import type { RowModel } from '../../data/topics';
import type { GradeStat } from '../../data/scrape/grades';
import { t } from '../../i18n';
import { sanitizeHtml } from '../../lib/sanitize';
import { Button } from './Button';
import { PinGlyph } from './Glyphs';
import { Thumb, thumbVariant } from './Thumb';
import { GradeMeter } from './GradeMeter';
import { KindIcon } from './KindIcon';

interface ResourceRowProps {
  row: RowModel;
  /** Position in the visible list (1-based): drives the `data-kex-test` ids. */
  index: number;
  /** Zero-padded topic number for doc thumbnails. */
  topicNumber?: string;
  pinned: boolean;
  primary: boolean;
  selected: boolean;
  /** Open in the side reader right now. */
  reading?: boolean;
  /** Stagger index for the entry animation (rows past 8 appear instantly). */
  enter?: number;
  /** Grade from Moodle's user report, keyed by this activity's cmid. */
  grade?: GradeStat;
  /** The quiet list row of a topic card (compact density): icon tile, title over its meta, done, pin and open on the right. */
  list?: boolean;
  /** A plain click leaves for a new tab (the open mark is an arrow out instead of a chevron). */
  external?: boolean;
  onSelect: (cmid: number) => void;
  onOpen: (row: RowModel, newTab: boolean) => void;
  onPreview: (row: RowModel) => void;
  onPin: (row: RowModel) => void;
  onDone: (row: RowModel) => void;
}

const isModified = (e: MouseEvent): boolean => e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;

/** One material (design-spec §4.9): thumb, mono label, title, subtitle, actions, primary button. */
export function ResourceRow(props: ResourceRowProps) {
  const { row, index, topicNumber, pinned, primary, selected, reading, enter, grade, onSelect, onOpen, onPreview, onPin, onDone } = props;
  if (row.kind === 'note') {
    return (
      <li class="kex-row kex-row--note" data-kex-note={row.cm.id}>
        {/* A label's text comes with the course page, a moment after the row: one line is held for it so the rows below stay put. */}
        {/* If its text cannot be read at all, the label's name (Moodle's shortened text) stands in. */}
        {row.noteHtml || !row.provisional ? (
          <div class="kex-row__note" dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.noteHtml ?? '') }} />
        ) : cmDetailsMissed.value.has(row.cm.id) ? (
          <div class="kex-row__note"><p>{row.title}</p></div>
        ) : (
          <div class="kex-row__note" aria-hidden="true"><span class="kex-skel kex-skel--note" /></div>
        )}
      </li>
    );
  }
  if (props.list) return <ListRow {...props} />;
  const verb = t(`verb.${row.verb}`);
  const label = row.locked ? t('course.locked') : row.label;
  const subtitle = row.locked ? row.availability ?? row.subtitle : row.subtitle;
  const style = enter !== undefined && enter < 8 ? { '--kex-enter': String(enter) } : undefined;
  return (
    <li
      class={`kex-row${row.locked ? ' kex-row--locked' : ''}${selected ? ' kex-row--selected' : ''}${reading ? ' kex-row--reading' : ''}${enter !== undefined && enter < 8 ? ' kex-row--enter' : ''}${row.provisional ? ' kex-row--provisional' : ''}${subtitle ? ' kex-row--sub' : ''}`}
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
        {!row.locked && grade && <GradeMeter grade={grade} />}
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

/** "Forum · Teachers and participants", "Assignment · Thu 15 Oct": Moodle's module name, then the due date and the row's own subtitle. */
function metaOf(row: RowModel): { text: string; late: boolean } {
  if (row.locked) return { text: [t('course.locked'), row.availability ?? row.subtitle].filter(Boolean).join(' · '), late: false };
  const deadline = row.kind === 'assignment' || row.kind === 'quiz';
  const parts = [row.typeName];
  if (deadline && row.dueText) parts.push(row.dueText);
  if (row.subtitle && !parts.includes(row.subtitle)) parts.push(row.subtitle);
  return { text: parts.join(' · '), late: deadline && !!row.overdue };
}

/** Moodle's own completion, on the row: a box to tick where the student marks it, a check where Moodle marked it. */
function Completion({ row, onDone }: { row: RowModel; onDone: (row: RowModel) => void }) {
  if (row.locked) return null;
  if (row.manual) {
    const done = row.manual.done;
    return (
      <button
        type="button"
        class={`kex-done${done ? ' kex-done--on' : ''}`}
        data-act="done"
        aria-pressed={done}
        onClick={() => onDone(row)}
      >
        <span class="kex-done__box" aria-hidden="true">{done && <Check size={13} strokeWidth={3} />}</span>
        <span class="kex-done__text">{done ? t('row.isDone') : t('row.markDone')}</span>
      </button>
    );
  }
  if (row.cm.tracked && !row.incomplete) {
    return (
      <span class="kex-done kex-done--auto" role="img" aria-label={t('row.isDone')} title={t('row.isDone')}>
        <CircleCheck size={18} strokeWidth={1.9} aria-hidden="true" />
      </span>
    );
  }
  return null;
}

function ListRow({ row, index, pinned, selected, reading, enter, external, onSelect, onOpen, onPin, onDone }: ResourceRowProps) {
  const meta = metaOf(row);
  const verb = t(`verb.${row.verb}`);
  const style = enter !== undefined && enter < 8 ? { '--kex-enter': String(enter) } : undefined;
  const open = (e: MouseEvent): void => {
    if (isModified(e)) return;
    e.preventDefault();
    onOpen(row, false);
  };
  return (
    <li
      class={`kex-row kex-lrow${row.locked ? ' kex-row--locked' : ''}${selected ? ' kex-row--selected' : ''}${reading ? ' kex-row--reading' : ''}${enter !== undefined && enter < 8 ? ' kex-row--enter' : ''}${row.provisional ? ' kex-row--provisional' : ''}`}
      style={style}
      tabIndex={selected ? 0 : -1}
      data-kex-row={row.cm.id}
      data-kex-test={`row-${index}`}
      data-kind={row.kind}
      data-mod={row.cm.modname}
      aria-label={`${row.title}, ${meta.text}`}
      onFocus={() => onSelect(row.cm.id)}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('a, button')) return;
        onSelect(row.cm.id);
        // The whole row opens the material, like a list row on a phone; selecting text in it does not.
        if (row.locked || isModified(e) || (window.getSelection()?.toString() ?? '') !== '') return;
        onOpen(row, false);
      }}
    >
      <KindIcon modname={row.cm.modname} kind={row.kind} format={row.format} />
      <div class="kex-lrow__text">
        <h4 class="kex-row__title kex-lrow__title" data-kex-test={`row-${index}-title`}>
          {row.locked ? <span>{row.title}</span> : <a href={row.cm.url} tabIndex={-1} onClick={open}>{row.title}</a>}
        </h4>
        <p class={`kex-lrow__meta${meta.late ? ' kex-lrow__meta--late' : ''}`}>{meta.text}</p>
      </div>
      <Completion row={row} onDone={onDone} />
      {!row.locked && (
        <button
          type="button"
          class={`kex-lrow__icon kex-lrow__pin${pinned ? ' kex-lrow__icon--on' : ''}`}
          data-act="pin"
          aria-pressed={pinned}
          aria-label={pinned ? t('row.unpin') : t('row.pin')}
          title={`${pinned ? t('row.unpin') : t('row.pin')} (P)`}
          onClick={() => onPin(row)}
        >
          <Pin size={18} strokeWidth={1.7} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}
      {row.locked ? (
        <span class="kex-lrow__icon kex-lrow__go" aria-hidden="true"><Lock size={17} strokeWidth={1.7} /></span>
      ) : (
        <a class="kex-lrow__icon kex-lrow__go" href={row.cm.url} tabIndex={-1} data-act="open" data-kex-test={`row-${index}-button`} aria-label={`${verb}: ${row.title}`} onClick={open}>
          {external ? <ExternalLink size={18} strokeWidth={1.7} aria-hidden="true" /> : <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />}
        </a>
      )}
    </li>
  );
}
