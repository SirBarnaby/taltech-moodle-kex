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
import { TopicMark, topicDisplayTitle } from './TopicMark';

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
  const placed = useRef(false);
  useLayoutEffect(() => {
    const el = row.current;
    const chip = el?.querySelector<HTMLElement>(`[data-kex-bartopic="${active}"]`)?.parentElement;
    if (el && chip) {
      const pad = 40;
      const left = chip.offsetLeft - pad < el.scrollLeft
        ? Math.max(0, chip.offsetLeft - pad)
        : chip.offsetLeft + chip.offsetWidth + pad > el.scrollLeft + el.clientWidth ? chip.offsetLeft + chip.offsetWidth + pad - el.clientWidth : el.scrollLeft;
      // The lit chip follows the topic being read as the page scrolls: it slides into view, it does not jump (first place: at once).
      if (left !== el.scrollLeft) el.scrollTo({ left, behavior: placed.current && document.documentElement.dataset.kexMotion !== 'reduced' ? 'smooth' : 'instant' });
    }
    placed.current = true;
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
 * The topic bar (round 10): in a column too narrow for the topic outline beside the materials, one row of topic chips (and this
 * course's three pins) stays pinned under the header while the page scrolls; the chip of the topic being read is lit and kept in
 * view. It takes its place in the page from the first frame, so nothing moves when it pins. A wide column hides it (book.css).
 */
export function CourseBar({ topics, active, onSelect, onKeyDown, pins, courseId, marks }: CourseBarProps) {
  const waiting = pinReplace.value;
  const asking = !!waiting && waiting.courseId === courseId && pins.length > 0;
  return (
    <div class="kex-cbar-anchor">
      <div class={`kex-cbar${asking ? ' kex-cbar--asking' : ''}`} data-shown="" data-kex-test="course-bar">
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
