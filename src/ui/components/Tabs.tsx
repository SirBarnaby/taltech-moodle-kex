import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { TabKey } from '../../data/classify';
import { t, type MessageKey } from '../../i18n';

const TABS: { key: TabKey; label: MessageKey; digit: string }[] = [
  { key: 'all', label: 'tab.all', digit: '1' },
  { key: 'lectures', label: 'tab.lectures', digit: '2' },
  { key: 'labs', label: 'tab.labs', digit: '3' },
];

interface TabsProps {
  value: TabKey;
  onChange: (k: TabKey) => void;
}

/** Everything / Lectures / Labs with a sliding underline. ARIA tabs with arrow-key navigation. */
export function Tabs({ value, onChange }: TabsProps) {
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
    <div class="kex-tabs" role="tablist" aria-label={t('course.tabs')} ref={list} onKeyDown={onKey}>
      {TABS.map((tb) => (
        <button
          key={tb.key}
          type="button"
          role="tab"
          id={`kex-tab-${tb.key}`}
          class={`kex-tab${value === tb.key ? ' kex-tab--active' : ''}`}
          data-tab={tb.key}
          aria-selected={value === tb.key}
          aria-controls="kex-tabpanel"
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

