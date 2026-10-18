import { Lock } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TopicModel } from '../../data/topics';
import { t } from '../../i18n';
import { scrollBehavior } from '../../fx/motion';

interface TopicListProps {
  topics: TopicModel[];
  /** Selected topic number (undefined while Course info is open). */
  active?: number;
  onSelect: (n: number) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export const topicDisplayTitle = (tp: Pick<TopicModel, 'isRange' | 'title' | 'section'>): string =>
  tp.isRange ? t('course.weekN', { n: tp.section.number }) : tp.title;

/** The TOPICS list (design-spec §4.7): number, optional tile photo (wide windows), two-line title; two rows are visible. */
export function TopicList({ topics, active, onSelect, onKeyDown }: TopicListProps) {
  const strip = useRef<HTMLOListElement>(null);
  const placed = useRef(false);
  const [more, setMore] = useState(false);
  // Keep the active chip inside the two visible rows; the list scrolls by whole rows.
  useEffect(() => {
    const list = strip.current;
    const selected = list?.querySelector<HTMLElement>(`[data-kex-topic="${active}"]`)?.parentElement;
    if (!list || !selected) return;
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    const target = top < list.scrollTop ? top : bottom > list.scrollTop + list.clientHeight ? bottom - list.clientHeight : undefined;
    if (target === undefined) return;
    list.scrollTo({ top: target, behavior: placed.current ? scrollBehavior() : 'auto' });
  }, [active]);
  useEffect(() => {
    placed.current = true;
  }, []);
  // Bottom fade while rows remain below the window.
  useEffect(() => {
    const list = strip.current;
    if (!list) return;
    const measure = (): void => setMore(list.scrollTop + list.clientHeight < list.scrollHeight - 2);
    measure();
    list.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    ro?.observe(list);
    return () => {
      list.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [topics.length]);
  const anyTile = topics.some((tp) => tp.tile);
  const tabStop = topics.some((tp) => tp.section.number === active) ? active : topics[0]?.section.number;
  return (
    <nav class={`kex-topics kex-topics--grid${more ? ' kex-topics--more' : ''}`} aria-label={t('course.topicsNav')} data-kex-test="topics">
      <p class="kex-topics__label kex-mono" id="kex-topics-label">{t('course.topics')}</p>
      <ol class="kex-topics__list" ref={strip} aria-labelledby="kex-topics-label" onKeyDown={(e) => {
        onKeyDown?.(e);
        const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
        if (e.defaultPrevented || (!vertical && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const cols = vertical && strip.current ? Math.max(1, getComputedStyle(strip.current).gridTemplateColumns.split(' ').length) : 1;
        const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) * cols;
        const index = topics.findIndex((tp) => tp.section.number === active);
        const next = topics[Math.max(0, Math.min(topics.length - 1, index + step))];
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
    </nav>
  );
}
