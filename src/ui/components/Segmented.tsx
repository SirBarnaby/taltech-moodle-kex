interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

/** Segmented control (radio group semantics, roving arrows). */
export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
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
    <div class="kex-segmented" role="radiogroup" aria-label={label}>
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
