import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { NavTab } from '../../data/scrape/secondarynav';
import { scrollBehavior } from '../../fx/motion';
import { t } from '../../i18n';

interface CourseNavProps {
  tabs: readonly NavTab[];
}

/**
 * The course's own secondary navigation (Course, Participants, Grades, Competencies, …) with Moodle's labels and URLs.
 * The active entry (the course page we are on) stays here; the others are links to pages Moodle renders itself. They load normally,
 * but the content controller shows the navigation skeleton at once (see `hardLoadFeedback`) so the click is answered immediately.
 */
export function CourseNav({ tabs }: CourseNavProps) {
  const list = useRef<HTMLElement>(null);
  const [bar, setBar] = useState({ left: 0, width: 0, ready: false, anim: false });
  const activeKey = tabs.find((x) => x.active)?.key;

  useLayoutEffect(() => {
    const place = (): void => {
      const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!el) return setBar((b) => (b.ready ? { ...b, ready: false, anim: false } : b));
      const text = el.querySelector<HTMLElement>('.kex-tab__label') ?? el;
      setBar((b) => ({ left: text.offsetLeft + el.offsetLeft - 9, width: text.offsetWidth + 18, ready: true, anim: b.ready }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (list.current) ro.observe(list.current);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => ro.disconnect();
  }, [activeKey, tabs.length]);

  // The row keeps its height while the tabs are on their way, so the topics below do not drop when they arrive.
  if (!tabs.length) return <div class="kex-tabs kex-coursenav kex-coursenav--empty" aria-hidden="true" />;
  return (
    <nav class="kex-tabs kex-coursenav" aria-label={t('course.tabs')} ref={list} data-kex-test="course-nav">
      {tabs.map((tb) => (
        <a
          key={tb.key}
          class={`kex-tab${tb.active ? ' kex-tab--active' : ''}`}
          href={tb.url}
          data-key={tb.key}
          aria-current={tb.active ? 'page' : undefined}
          onClick={tb.active ? (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: scrollBehavior() }); } : undefined}
        >
          <span class="kex-tab__label">{tb.label}</span>
        </a>
      ))}
      <span
        class="kex-tabs__bar"
        data-kex-test="tab-underline"
        aria-hidden="true"
        style={{ transform: `translateX(${bar.left}px) scaleX(${bar.width})`, opacity: bar.ready ? 1 : 0, transition: bar.anim ? undefined : 'none' }}
      />
    </nav>
  );
}
