import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { NavTab } from '../../data/scrape/secondarynav';
import { TabLabel } from './Tabs';
import { scrollBehavior } from '../../fx/motion';
import { t } from '../../i18n';

interface CourseNavProps {
  tabs: readonly NavTab[];
}

interface Thumb {
  left: number;
  width: number;
  ready: boolean;
  anim: boolean;
}

/**
 * The course's own secondary navigation (Course, Participants, Grades, Competencies, …) with Moodle's labels and URLs, as a glass
 * segmented control under the course name in the hero. The lit segment is the page we are on; the others are links to pages Moodle
 * renders itself. They load normally, but a press slides the lit segment over at once and the content controller shows the
 * navigation skeleton (see `hardLoadFeedback`), so the click is answered immediately.
 */
export function CourseNav({ tabs }: CourseNavProps) {
  const list = useRef<HTMLElement>(null);
  const [thumb, setThumb] = useState<Thumb>({ left: 0, width: 0, ready: false, anim: false });
  const [pressed, setPressed] = useState<string | undefined>(undefined);
  const activeKey = tabs.find((x) => x.active)?.key;
  const lit = pressed ?? activeKey;

  useLayoutEffect(() => {
    const place = (): void => {
      const el = lit ? list.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(lit)}"]`) : null;
      if (!el) return setThumb((b) => (b.ready ? { ...b, ready: false, anim: false } : b));
      setThumb((b) => ({ left: el.offsetLeft, width: el.offsetWidth, ready: true, anim: b.ready }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (list.current) ro.observe(list.current);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => ro.disconnect();
  }, [lit, tabs.length]);

  // Back to this page from the back/forward cache: the segment pressed before leaving goes back to the page we are on.
  useLayoutEffect(() => {
    const onShow = (e: PageTransitionEvent): void => {
      if (e.persisted) setPressed(undefined);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // The row keeps its height while the tabs are on their way, so nothing under the title moves when they arrive.
  if (!tabs.length) return <div class="kex-coursenav kex-coursenav--empty" aria-hidden="true" />;
  return (
    <nav class="kex-coursenav" aria-label={t('course.nav')} ref={list} data-kex-test="course-nav">
      <span
        class="kex-coursenav__thumb"
        data-kex-test="tab-underline"
        aria-hidden="true"
        style={{ transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px`, opacity: thumb.ready ? 1 : 0, transition: thumb.anim ? undefined : 'none' }}
      />
      {tabs.map((tb) => (
        <a
          key={tb.key}
          class={`kex-coursenav__tab${tb.key === lit ? ' kex-coursenav__tab--lit' : ''}`}
          href={tb.url}
          data-key={tb.key}
          aria-current={tb.active ? 'page' : undefined}
          onClick={(e) => {
            if (tb.active) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: scrollBehavior() });
              return;
            }
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            setPressed(tb.key);
          }}
        >
          <TabLabel text={tb.label} />
        </a>
      ))}
    </nav>
  );
}
