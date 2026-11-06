import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useSlidingThumb } from './hooks';
import type { NavTab } from '../../data/scrape/secondarynav';
import { TabLabel } from './Tabs';
import { scrollBehavior } from '../../fx/motion';
import { isPlainClick } from '../../content/softnav';
import { t } from '../../i18n';

interface CourseNavProps {
  tabs: readonly NavTab[];
}

/**
 * The course's own secondary navigation (Course, Participants, Grades, Competencies, …) with Moodle's labels and URLs, as a glass
 * segmented control under the course name in the hero. The lit segment is the page we are on; the others are links to pages Moodle
 * renders itself. They load normally, but a press slides the lit segment over at once and the content controller shows the
 * navigation skeleton (see `hardLoadFeedback`), so the click is answered immediately.
 */
export function CourseNav({ tabs }: CourseNavProps) {
  const list = useRef<HTMLElement>(null);
  const [pressed, setPressed] = useState<string | undefined>(undefined);
  const activeKey = tabs.find((x) => x.active)?.key;
  const lit = pressed ?? activeKey;

  const thumb = useSlidingThumb(list, lit ? `[data-key="${CSS.escape(lit)}"]` : null, [tabs.length]);

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
            // The same test the content controller uses before it shows the loading skeleton.
            if (!isPlainClick(e)) return;
            setPressed(tb.key);
          }}
        >
          <TabLabel text={tb.label} />
        </a>
      ))}
    </nav>
  );
}
