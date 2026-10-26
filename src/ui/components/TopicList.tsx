import { Lock } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TopicModel } from '../../data/topics';
import { t } from '../../i18n';

interface TopicListProps {
  topics: TopicModel[];
  /** Selected topic number (undefined while Course info is open). */
  active?: number;
  onSelect: (n: number) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export const topicDisplayTitle = (tp: Pick<TopicModel, 'isRange' | 'title' | 'section'>): string =>
  tp.isRange ? t('course.weekN', { n: tp.section.number }) : tp.title;

/** More rows than this and the grid shows CLIPPED_ROWS of them with Moodle's "Show more" (rare: most courses have 3 or 4). */
const MAX_ROWS = 5;
const CLIPPED_ROWS = 4;

/**
 * The TOPICS grid (design-spec §4.7): number, optional tile photo (wide windows), two-line title. It stays where it is and shows
 * every row; the sticky course bar takes over once it scrolls away. Never scrolls inside itself and never changes height on its
 * own, so nothing below it moves.
 */
export function TopicList({ topics, active, onSelect, onKeyDown }: TopicListProps) {
  const strip = useRef<HTMLOListElement>(null);
  const [cols, setCols] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const list = strip.current;
    if (!list) return;
    const measure = (): void => setCols(Math.max(1, getComputedStyle(list).gridTemplateColumns.split(' ').length));
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    ro?.observe(list);
    return () => ro?.disconnect();
  }, []);
  const rows = cols ? Math.ceil(topics.length / cols) : 0;
  const activeIndex = topics.findIndex((tp) => tp.section.number === active);
  // The open topic is never hidden behind "Show more": reaching one of the hidden rows opens the rest for good.
  const clipped = rows > MAX_ROWS && !expanded && activeIndex < CLIPPED_ROWS * cols;
  useEffect(() => {
    if (cols && rows > MAX_ROWS && activeIndex >= CLIPPED_ROWS * cols) setExpanded(true);
  }, [activeIndex, cols, rows]);
  const hidden = clipped ? topics.length - CLIPPED_ROWS * cols : 0;
  const anyTile = topics.some((tp) => tp.tile);
  const tabStop = topics.some((tp) => tp.section.number === active) ? active : topics[0]?.section.number;
  return (
    <nav class={`kex-topics kex-topics--grid${clipped ? ' kex-topics--clipped' : ''}`} aria-label={t('course.topicsNav')} data-kex-test="topics">
      <p class="kex-topics__label kex-mono" id="kex-topics-label">{t('course.topics')}</p>
      <ol class="kex-topics__list" ref={strip} aria-labelledby="kex-topics-label" onKeyDown={(e) => {
        onKeyDown?.(e);
        const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
        if (e.defaultPrevented || (!vertical && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) * (vertical ? cols || 1 : 1);
        const index = topics.findIndex((tp) => tp.section.number === active);
        const next = topics[Math.max(0, Math.min(topics.length - 1, index + step))];
        if (next) onSelect(next.section.number);
      }}>
        {topics.map((tp, i) => {
          const isActive = tp.section.number === active;
          const title = topicDisplayTitle(tp);
          return (
            <li key={tp.section.id} hidden={clipped && i >= CLIPPED_ROWS * cols ? true : undefined}>
              <a
                class={`kex-topic${isActive ? ' kex-topic--active' : ''}${tp.restricted ? ' kex-topic--locked' : ''}`}
                href={`#topic-${tp.section.number}`}
                data-kex-topic={tp.section.number}
                data-kex-test={`topics-row-${i + 1}`}
                title={title}
                aria-current={isActive ? 'true' : undefined}
                tabIndex={tp.section.number === tabStop ? 0 : -1}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onSelect(tp.section.number);
                }}
              >
                <span class="kex-topic__num">{tp.number}</span>
                {anyTile && (
                  <span class="kex-topic__tile" aria-hidden="true">
                    {tp.tile && <img src={tp.tile} alt="" loading="lazy" decoding="async" width="40" height="28" />}
                  </span>
                )}
                <span class="kex-topic__title">{title}</span>
                {tp.restricted && <Lock class="kex-topic__lock" size={13} strokeWidth={1.75} aria-label={t('course.restricted')} />}
              </a>
            </li>
          );
        })}
      </ol>
      {rows > MAX_ROWS && (clipped || expanded) && (
        <button type="button" class="kex-topics__more" aria-expanded={!clipped} data-kex-test="topics-more" onClick={() => setExpanded(clipped)}>
          {clipped ? `${t('course.topicsMore')} (${hidden})` : t('course.topicsLess')}
        </button>
      )}
    </nav>
  );
}
