import { useLayoutEffect, useRef, useState } from 'preact/hooks';

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  /** A highlight that slides to the chosen option (transform only). Off for pages that style the options themselves. */
  slide?: boolean;
}

/** Segmented control (radio group semantics, roving arrows). */
export function Segmented<T extends string>({ value, options, onChange, label, slide = false }: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    if (!slide) return;
    const place = (): void => {
      const el = group.current?.querySelector<HTMLElement>('[aria-checked="true"]');
      setThumb(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    if (group.current) ro.observe(group.current);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => ro.disconnect();
  }, [slide, value, options.length]);
  const onKey = (e: KeyboardEvent, i: number): void => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const group = (e.currentTarget as HTMLElement).parentElement;
    queueMicrotask(() => group?.querySelectorAll<HTMLElement>('[role="radio"]')[(i + d + options.length) % options.length]?.focus());
  };
  return (
    <div class={`kex-segmented${slide ? ' kex-segmented--slide' : ''}`} role="radiogroup" aria-label={label} ref={group}>
      {slide && thumb && <span class="kex-segmented__thumb" aria-hidden="true" style={{ transform: `translateX(${thumb.x}px) scaleX(${thumb.w})` }} />}
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          class="kex-segmented__opt"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
