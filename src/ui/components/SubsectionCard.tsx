import type { ComponentChildren } from 'preact';
import { ChevronRight } from 'lucide-preact';
import type { LabTrackItem } from '../../data/labtrack';
import type { GroupModel } from '../../data/topics';
import { t } from '../../i18n';
import { STATE_LABEL } from './LabTrack';

interface SubsectionCardProps {
  group: GroupModel;
  index: number;
  /** In a lab track: the lab's state, and whether it is open or folded to one line. */
  lab?: LabTrackItem;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ComponentChildren;
}

function Progress({ group, index, titleId }: { group: GroupModel; index: number; titleId: string }) {
  const { done, total } = group;
  if (total <= 0) return null;
  return (
    <span class="kex-groupcard__progress kex-mono" data-kex-test={`group-${index}-progress`} title={t('track.progress', { done, total })}>
      <span>{done}/{total}</span>
      <span class="kex-groupcard__bar" role="progressbar" aria-labelledby={titleId} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </span>
    </span>
  );
}

/** In the wide lab board (track.css sets `--kex-board`) a lab is chosen from the list beside it; its own header does not fold it. */
const inLabBoard = (el: Element): boolean => {
  const board = el.closest('.kex-labs');
  return !!board && getComputedStyle(board).getPropertyValue('--kex-board').trim() === '1';
};

/** A subsection (Moodle 4.5 `mod_subsection`): a titled card inside its parent topic, with its own summary and progress. */
export function SubsectionCard({ group, index, lab, open = true, onToggle, children }: SubsectionCardProps) {
  const titleId = `kex-group-${group.section.id}`;
  const bodyId = `kex-group-body-${group.section.id}`;
  const body = (
    <>
      {group.summaryHtml && <div class="kex-detail__summary kex-groupcard__summary" dangerouslySetInnerHTML={{ __html: group.summaryHtml }} />}
      {group.rows.length > 0 && <ul class="kex-groupcard__rows">{children}</ul>}
    </>
  );
  if (!lab) {
    return (
      <li class="kex-group" data-kex-group={group.section.id} data-kex-test={`group-${index}`}>
        <section class="kex-groupcard" aria-labelledby={titleId}>
          <header class="kex-groupcard__head">
            <h4 class="kex-groupcard__title" id={titleId}>{group.title}</h4>
            <Progress group={group} index={index} titleId={titleId} />
          </header>
          {body}
        </section>
      </li>
    );
  }
  return (
    <li class={`kex-group kex-group--lab kex-group--${lab.state}${open ? ' kex-group--open' : ''}`} data-kex-group={group.section.id} data-kex-test={`group-${index}`}>
      <section class="kex-groupcard" aria-labelledby={titleId}>
        <header class="kex-groupcard__head">
          <button type="button" class="kex-groupcard__toggle" aria-expanded={open} aria-controls={bodyId} onClick={(e) => {
            if (open && inLabBoard(e.currentTarget)) return;
            onToggle?.(!open);
          }}>
            <ChevronRight class="kex-groupcard__chev" size={18} strokeWidth={1.75} aria-hidden="true" />
            <h4 class="kex-groupcard__title" id={titleId}>{group.title}</h4>
          </button>
          <span class={`kex-groupcard__state kex-mono kex-groupcard__state--${lab.state}`}>{t(STATE_LABEL[lab.state])}</span>
          {lab.dueText && <span class={`kex-groupcard__due${lab.state === 'overdue' ? ' kex-groupcard__due--late' : ''}`}>{lab.dueText}</span>}
          <Progress group={group} index={index} titleId={titleId} />
        </header>
        {/* Folding animates the row track from 0fr to 1fr; a folded lab's rows are inert, so Tab and the row keys skip them. */}
        <div class="kex-groupcard__fold" id={bodyId} inert={!open}>
          <div class="kex-groupcard__foldin">{body}</div>
        </div>
      </section>
    </li>
  );
}
