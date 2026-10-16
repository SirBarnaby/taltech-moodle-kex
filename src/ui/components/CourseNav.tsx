import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { NavTab } from '../../data/scrape/secondarynav';
import { t } from '../../i18n';

interface CourseNavProps {
  tabs: readonly NavTab[];
}

/**
 * The course's own secondary navigation (Course, Participants, Grades, Competencies, …) with Moodle's labels and URLs.
 * The active entry (the course page we are on) stays here; the others are plain links to Moodle's pages.
 */
export function CourseNav({ tabs }: CourseNavProps) {
  const list = useRef<HTMLElement>(null);
  const [bar, setBar] = useState({ left: 0, width: 0, ready: false });
  const activeKey = tabs.find((x) => x.active)?.key;

  useLayoutEffect(() => {
    const place = (): void => {
      const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!el) return setBar((b) => (b.ready ? { ...b, ready: false } : b));
      const text = el.querySelector<HTMLElement>('.kex-tab__label') ?? el;
      setBar({ left: text.offsetLeft + el.offsetLeft - 9, width: text.offsetWidth + 18, ready: true });
    };
    place();
    const ro = new ResizeObserver(place);
    if (list.current) ro.observe(list.current);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => ro.disconnect();
  }, [activeKey, tabs.length]);

  if (!tabs.length) return null;
  return (
    <nav class="kex-tabs kex-coursenav" aria-label={t('course.tabs')} ref={list} data-kex-test="course-nav">
      {tabs.map((tb) => (
        <a
          key={tb.key}
          class={`kex-tab${tb.active ? ' kex-tab--active' : ''}`}
          href={tb.url}
          data-key={tb.key}
          aria-current={tb.active ? 'page' : undefined}
          onClick={tb.active ? (e) => { e.preventDefault(); window.scrollTo({ top: 0 }); } : undefined}
        >
          <span class="kex-tab__label">{tb.label}</span>
        </a>
      ))}
      <span
        class="kex-tabs__bar"
        data-kex-test="tab-underline"
        aria-hidden="true"
        style={{ left: `${bar.left}px`, width: `${bar.width}px`, opacity: bar.ready ? 1 : 0 }}
      />
    </nav>
  );
}
