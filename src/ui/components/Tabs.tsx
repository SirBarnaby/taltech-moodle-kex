import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t, type MessageKey } from '../../i18n';

export interface TabDef<K extends string = string> {
  key: K;
  label: MessageKey;
  digit: string;
}

const COURSE_TABS = [
  { key: 'all', label: 'tab.all', digit: '1' },
  { key: 'lectures', label: 'tab.lectures', digit: '2' },
  { key: 'labs', label: 'tab.labs', digit: '3' },
] as const satisfies readonly TabDef[];

interface TabsProps<K extends string = 'all' | 'lectures' | 'labs'> {
  value: K;
  onChange: (k: K) => void;
  /** Defaults to Everything / Lectures / Labs. */
  items?: readonly TabDef<K>[];
  label?: string;
  /** `data-tab` ids and `id`s are prefixed with this. */
  idPrefix?: string;
  panelId?: string;
}

/** Everything / Lectures / Labs with a sliding underline. ARIA tabs with arrow-key navigation. */
export function Tabs<K extends string = 'all' | 'lectures' | 'labs'>({ value, onChange, items, label, idPrefix = 'kex-tab', panelId = 'kex-tabpanel' }: TabsProps<K>) {
  const TABS = (items ?? COURSE_TABS) as readonly TabDef<K>[];
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const place = (): void => {
      const el = list.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
      const box = list.current;
      if (!el || !box) return;
      const text = el.querySelector<HTMLElement>('.kex-tab__label') ?? el;
      const left = text.offsetLeft + el.offsetLeft - 9;
      setBar({ left, width: text.offsetWidth + 18, ready: true });
    };
    place();
    const ro = new ResizeObserver(place);
    if (list.current) ro.observe(list.current);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => ro.disconnect();
  }, [value]);

  const onKey = (e: KeyboardEvent): void => {
    const i = TABS.findIndex((x) => x.key === value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
    if (next < 0 || next >= TABS.length) return;
    e.preventDefault();
    const target = TABS[next];
    if (!target) return;
    onChange(target.key);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-tab="${target.key}"]`)?.focus());
  };

  return (
    <div class="kex-tabs" role="tablist" aria-label={label ?? t('course.tabs')} ref={list} onKeyDown={onKey}>
      {TABS.map((tb) => (
        <button
          key={tb.key}
          type="button"
          role="tab"
          id={`${idPrefix}-${tb.key}`}
          class={`kex-tab${value === tb.key ? ' kex-tab--active' : ''}`}
          data-tab={tb.key}
          aria-selected={value === tb.key}
          aria-controls={panelId}
          tabIndex={value === tb.key ? 0 : -1}
          onClick={() => onChange(tb.key)}
          title={`${t(tb.label)} (${tb.digit})`}
        >
          <span class="kex-tab__label">{t(tb.label)}</span>
        </button>
      ))}
      <span
        class="kex-tabs__bar"
        data-kex-test="tab-underline"
        aria-hidden="true"
        style={{ left: `${bar.left}px`, width: `${bar.width}px`, opacity: bar.ready ? 1 : 0 }}
      />
    </div>
  );
}

