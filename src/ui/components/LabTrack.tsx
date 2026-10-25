import { Check } from 'lucide-preact';
import type { LabState, LabTrackItem } from '../../data/labtrack';
import { t, type MessageKey } from '../../i18n';

interface LabTrackProps {
  items: readonly LabTrackItem[];
  open: ReadonlySet<number>;
  onShow: (id: number) => void;
}

export const STATE_LABEL: Record<LabState, MessageKey> = { done: 'track.done', overdue: 'track.overdue', next: 'track.next', todo: 'track.todo' };

/**
 * One entry per lab: done, overdue, next, or still to do. Arrow keys move along it; Enter shows that lab on its own.
 * A narrow column shows it as a strip of short chips over the folded lab cards; a wide one (track.css, `.kex-labs`) as a list
 * beside the open lab, with each lab's full title, deadline and progress. Both come from the same buttons.
 */
export function LabTrack({ items, open, onShow }: LabTrackProps) {
  // The roving stop is the first open lab, so Tab lands where the reader is.
  const stop = Math.max(0, items.findIndex((i) => open.has(i.group.section.id)));
  const onKey = (e: KeyboardEvent): void => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const chips = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.kex-chip-lab'));
    const i = chips.indexOf(document.activeElement as HTMLButtonElement);
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : Math.max(0, Math.min(chips.length - 1, i + (forward ? 1 : -1)));
    e.preventDefault();
    e.stopPropagation();
    chips[next]?.focus();
    chips[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const done = items.filter((i) => i.state === 'done').length;
  return (
    <nav class="kex-track" aria-label={t('track.nav')} data-kex-test="lab-track">
      <p class="kex-track__head kex-mono" aria-hidden="true">
        <span class="kex-track__label">{t('track.nav')}</span>
        <span class="kex-track__count">{done}/{items.length}</span>
      </p>
      <ol class="kex-track__chips" onKeyDown={onKey}>
        {items.map((item, i) => {
          const id = item.group.section.id;
          const isOpen = open.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                class={`kex-chip-lab kex-chip-lab--${item.state}${isOpen ? ' kex-chip-lab--open' : ''}`}
                tabIndex={i === stop ? 0 : -1}
                aria-current={isOpen ? 'true' : undefined}
                aria-label={`${item.group.title}: ${t(STATE_LABEL[item.state])}${item.dueText ? `, ${item.dueText}` : ''}`}
                title={`${item.group.title}${item.dueText ? ` · ${item.dueText}` : ''}`}
                data-kex-test={`lab-chip-${i + 1}`}
                onClick={() => onShow(id)}
              >
                <span class="kex-chip-lab__mark" aria-hidden="true">{item.state === 'done' ? <Check size={11} strokeWidth={3} /> : item.state === 'overdue' ? '!' : null}</span>
                <span class="kex-chip-lab__text">{item.short}</span>
                <span class="kex-chip-lab__title">{item.group.title}</span>
                {item.dueText && <span class={`kex-chip-lab__due${item.state === 'overdue' ? ' kex-chip-lab__due--late' : ''}`}>{item.dueText}</span>}
                <span class="kex-chip-lab__meta kex-mono">
                  <span class="kex-chip-lab__state">{t(STATE_LABEL[item.state])}</span>
                  {item.group.total > 0 && (
                    <>
                      <span>{item.group.done}/{item.group.total}</span>
                      <span class="kex-chip-lab__bar"><span style={{ width: `${Math.round((item.group.done / item.group.total) * 100)}%` }} /></span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
