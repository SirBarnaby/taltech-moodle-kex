import { Lock } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import type { TopicModel } from '../../data/topics';
import { t } from '../../i18n';
import { ArrowEast } from './Glyphs';
import { revealInScroller } from '../../fx/navigation';

interface TopicListProps {
  topics: TopicModel[];
  /** Selected topic number (undefined while Course info is open). */
  active?: number;
  onSelect: (n: number) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export const topicDisplayTitle = (tp: Pick<TopicModel, 'isRange' | 'title' | 'section'>): string =>
  tp.isRange ? t('course.weekN', { n: tp.section.number }) : tp.title;

/** The TOPICS list (design-spec §4.7): number, optional tile photo, title, arrow on the active row. */
export function TopicList({ topics, active, onSelect, onKeyDown }: TopicListProps) {
  const strip = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = strip.current;
    const selected = list?.querySelector<HTMLElement>(`[data-kex-topic="${active}"]`);
    if (!list || !selected) return;
    revealInScroller(selected, list);
  }, [active]);
  const anyTile = topics.some((tp) => tp.tile);
  const tabStop = topics.some((tp) => tp.section.number === active) ? active : topics[0]?.section.number;
  return (
    <nav class="kex-topics" aria-label={t('course.topicsNav')} data-kex-test="topics">
      <p class="kex-topics__label kex-mono" id="kex-topics-label">{t('course.topics')}</p>
      <ol class="kex-topics__list" ref={strip} aria-labelledby="kex-topics-label" onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const index = topics.findIndex((tp) => tp.section.number === active);
        const next = topics[Math.max(0, Math.min(topics.length - 1, index + (e.key === 'ArrowRight' ? 1 : -1)))];
        if (next) onSelect(next.section.number);
      }}>
        {topics.map((tp, i) => {
          const isActive = tp.section.number === active;
          const title = topicDisplayTitle(tp);
          return (
            <li key={tp.section.id}>
              <a
                class={`kex-topic${isActive ? ' kex-topic--active' : ''}${tp.restricted ? ' kex-topic--locked' : ''}`}
                href={`#topic-${tp.section.number}`}
                data-kex-topic={tp.section.number}
                data-kex-test={`topics-row-${i + 1}`}
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
                <ArrowEast class="kex-topic__arrow" size={16} strokeWidth={1.7} />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
