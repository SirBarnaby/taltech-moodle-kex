import { ChevronLeft, ChevronRight } from 'lucide-preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { go } from '../../actions/navigate';
import { pinReplace, replacePinAt } from '../../actions/pins';
import type { LabState } from '../../data/labtrack';
import type { Pin } from '../../data/model';
import type { TopicModel } from '../../data/topics';
import { t } from '../../i18n';
import { PinGlyph } from './Glyphs';
import { PinMark } from './PinnedRow';
import { TopicMark, topicDisplayTitle } from './TopicList';

interface CourseBarProps {
  topics: TopicModel[];
  active?: number;
  onSelect: (n: number) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  /** The course's own row pins (at most three). */
  pins: Pin[];
  courseId: number;
  marks?: ReadonlyMap<number, LabState>;
}

const cssPx = (el: Element, name: string, fallback: number): number => Number.parseFloat(getComputedStyle(el).getPropertyValue(name)) || fallback;

/**
 * Shown while the TOPICS grid is scrolled away, judged by an IntersectionObserver on the grid itself (Firefox has no CSS
 * scroll-state queries). The bar is laid over the page, so showing it moves nothing and cannot feed back into the measurement.
 */
function useGridGone(): boolean {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>('#kex-main .kex-topics--grid');
    const root = document.getElementById('kex-root');
    if (!grid || !root || typeof IntersectionObserver === 'undefined') return;
    // The grid counts as gone once it is behind the compact header and the bar itself.
    const top = cssPx(root, '--kex-header-h-compact', 52) + cssPx(root, '--kex-cbar-h', 48);
    const io = new IntersectionObserver(([e]) => {
      if (e) setGone(!e.isIntersecting && e.boundingClientRect.top < top);
    }, { rootMargin: `-${top}px 0px 0px 0px` });
    io.observe(grid);
    return () => io.disconnect();
  }, []);
  return gone;
}

/** One row of topic chips that scrolls sideways: the active chip stays in view, edges fade where more wait, the wheel scrolls it. */
function Chips({ topics, active, onSelect, onKeyDown, marks }: Pick<CourseBarProps, 'topics' | 'active' | 'onSelect' | 'onKeyDown' | 'marks'>) {
  const row = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = (): void => {
    const el = row.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((cur) => (cur.start === start && cur.end === end ? cur : { start, end }));
  };
  useLayoutEffect(() => {
    const el = row.current;
    const chip = el?.querySelector<HTMLElement>(`[data-kex-bartopic="${active}"]`)?.parentElement;
    if (el && chip) {
      const pad = 40;
      if (chip.offsetLeft - pad < el.scrollLeft) el.scrollLeft = Math.max(0, chip.offsetLeft - pad);
      else if (chip.offsetLeft + chip.offsetWidth + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = chip.offsetLeft + chip.offsetWidth + pad - el.clientWidth;
    }
    measure();
  }, [active, topics.length]);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    ro?.observe(el);
    // A vertical wheel scrolls the chips while they can still move that way; at either end the page scrolls as usual.
    const onWheel = (e: WheelEvent): void => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.ctrlKey) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      const room = dy > 0 ? el.scrollWidth - el.clientWidth - el.scrollLeft : el.scrollLeft;
      if (room <= 1) return;
      e.preventDefault();
      el.scrollLeft += dy;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro?.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, []);
  const page = (dir: 1 | -1): void => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const tabStop = topics.some((tp) => tp.section.number === active) ? active : topics[0]?.section.number;
  return (
    <div class={`kex-cbar__topics${edges.start ? ' kex-cbar__topics--start' : ''}${edges.end ? ' kex-cbar__topics--end' : ''}`}>
      <button type="button" class="kex-cbar__arrow kex-cbar__arrow--prev" tabIndex={-1} aria-label={t('course.bar.prev')} onClick={() => page(-1)}>
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <ol class="kex-cbar__chips" ref={row} aria-label={t('course.topics')} onScroll={measure} onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const i = topics.findIndex((tp) => tp.section.number === active);
        const next = topics[Math.max(0, Math.min(topics.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
        if (next) onSelect(next.section.number);
      }}>
        {topics.map((tp) => {
          const on = tp.section.number === active;
          const title = topicDisplayTitle(tp);
          return (
            <li key={tp.section.id}>
              <a
                class={`kex-cbar__chip${on ? ' kex-cbar__chip--active' : ''}${tp.restricted ? ' kex-cbar__chip--locked' : ''}`}
                href={`#topic-${tp.section.number}`}
                title={title}
                aria-current={on ? 'true' : undefined}
                tabIndex={tp.section.number === tabStop ? 0 : -1}
                data-kex-bartopic={tp.section.number}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onSelect(tp.section.number);
                }}
              >
                <span class="kex-cbar__num">{tp.number}</span>
                <span class="kex-cbar__title">{title}</span>
                <TopicMark state={marks?.get(tp.section.number)} />
              </a>
            </li>
          );
        })}
      </ol>
      <button type="button" class="kex-cbar__arrow kex-cbar__arrow--next" tabIndex={-1} aria-label={t('course.bar.next')} onClick={() => page(1)}>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

function PinChip({ pin, slot, asking }: { pin: Pin; slot: number; asking: boolean }) {
  const body = (
    <>
      {asking ? <span class="kex-cbar__slot kex-mono" aria-hidden="true">{slot + 1}</span> : <span class="kex-cbar__mark"><PinMark pin={pin} /></span>}
      <span class="kex-cbar__pintitle">{pin.title}</span>
    </>
  );
  if (asking) {
    return (
      <button type="button" class="kex-cbar__pin kex-cbar__pin--target" title={pin.title} aria-label={`${t('pinned.replaceSlot', { n: slot + 1 })}: ${pin.title}`} onClick={() => void replacePinAt(slot)}>
        {body}
      </button>
    );
  }
  return (
    <a class="kex-cbar__pin" href={pin.url} title={pin.title} onClick={(e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(pin.url);
    }}>
      {body}
    </a>
  );
}

/** Narrow column: one button with the count, opening the three pins below it. */
function PinMenu({ pins, asking }: { pins: Pin[]; asking: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const shown = open || asking;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      box.current?.querySelector<HTMLElement>('.kex-cbar__pinbtn')?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div class="kex-cbar__pinmenu" ref={box}>
      <button type="button" class="kex-cbar__pinbtn" aria-expanded={shown} aria-label={t('course.bar.pins', { n: pins.length })} onClick={() => setOpen(!open)}>
        <PinGlyph width={10} height={15} />
        <span class="kex-mono">{pins.length}</span>
      </button>
      {shown && (
        <div class="kex-cbar__drop" role="group" aria-label={t('course.pinned')}>
          {pins.map((p, i) => <PinChip key={p.cmid} pin={p} slot={i} asking={asking} />)}
        </div>
      )}
    </div>
  );
}

/**
 * The course bar (round 8): once the TOPICS grid scrolls away, a 48 px bar slides in under the compact header with one row of
 * topic chips and this course's three pins. It sits in a zero-height sticky anchor, so it never takes space or moves the page.
 */
export function CourseBar({ topics, active, onSelect, onKeyDown, pins, courseId, marks }: CourseBarProps) {
  const gone = useGridGone();
  const waiting = pinReplace.value;
  const asking = !!waiting && waiting.courseId === courseId && pins.length > 0;
  const shown = gone;
  return (
    <div class="kex-cbar-anchor">
      <div class={`kex-cbar${asking ? ' kex-cbar--asking' : ''}`} data-shown={shown ? '' : undefined} aria-hidden={shown ? undefined : 'true'} inert={!shown} data-kex-test="course-bar">
        <Chips topics={topics} active={active} onSelect={onSelect} onKeyDown={onKeyDown} marks={marks} />
        {pins.length > 0 && (
          <div class="kex-cbar__pins" role="group" aria-label={t('course.pinned')}>
            <div class="kex-cbar__pinrow">
              {pins.map((p, i) => <PinChip key={p.cmid} pin={p} slot={i} asking={asking} />)}
            </div>
            <PinMenu pins={pins} asking={asking} />
          </div>
        )}
      </div>
    </div>
  );
}
