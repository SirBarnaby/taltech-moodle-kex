import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { heroCanvas } from '../../fx/heroCanvas';
import { MOTION, sinceNavigation } from '../../fx/navigation';
import { formatDate, t } from '../../i18n';
import { nextByCourse } from '../../data/feed';
import { eventsStore } from '../../data/repo/events';
import { contactsStore, teacherLine } from '../../lib/contacts';
import { activeCourseId, activeRibbons, activeSchool, route, sidebarCourses } from '../../state';
import { heroEffectMode } from '../../state/effects';
import { nowSec } from '../../state/workspace';
import { ArrowNE } from './Glyphs';
import { SlideUpText } from './SlideUpText';

export interface HeroLink {
  key: string;
  label: string;
  href?: string;
  onClick?: (e: MouseEvent) => void;
}

interface HeroProps {
  /** Mono eyebrow ("WORKSPACE / THU 16 OCT"). Course heroes do not show it: the breadcrumb already names the course. */
  label?: string;
  /** Title lines (the second one is painted with the gradient). */
  lines: [string, string?];
  links: HeroLink[];
  /** Seed for the shader (course id), so each course has its own phase. */
  seed?: number;
  intensity?: number;
  /** Extra class on the section (page variants). */
  class?: string;
}

/** A single "+" mark (25x25, 1px lines). */
export function Crosshair({ class: cls }: { class: string }) {
  return (
    <svg class={`kex-cross ${cls}`} width="25" height="25" viewBox="0 0 25 25" aria-hidden="true" focusable="false">
      <path d="M12.5 0v25M0 12.5h25" stroke="currentColor" stroke-width="1" fill="none" />
      <rect x="12" y="12" width="1" height="1" fill="currentColor" class="kex-cross__dot" />
    </svg>
  );
}

/** Teachers, progress and the next deadline of the course on screen: all Moodle's own data, no invented labels. */
function CourseMeta({ courseId }: { courseId: number }) {
  const contacts = contactsStore(courseId);
  const events = eventsStore();
  useEffect(() => {
    void contacts.refresh();
    void events.refresh();
  }, [courseId]);
  const course = sidebarCourses.value.find((c) => c.id === courseId);
  const teachers = teacherLine(contacts.value.value ?? []);
  const pct = course && course.progress !== null ? Math.max(0, Math.min(100, Math.round(course.progress))) : undefined;
  const due = (events.value.value ?? []).filter((d) => d.courseId === courseId);
  const overdue = due.find((d) => d.overdue);
  const next = overdue ?? nextByCourse(due).get(courseId);
  void nowSec.value;
  return (
    <p class="kex-hero__label kex-hero__meta kex-mono" data-kex-test="hero-meta">
      {teachers && <span class="kex-hero__mi kex-hero__mi--teachers" data-kex-test="hero-teachers" title={t('hero.teachers')}>{teachers}</span>}
      {pct !== undefined && (
        <span class="kex-hero__mi" data-kex-test="hero-progress" title={t('hero.progress')}>
          <i class="kex-hero__bar" aria-hidden="true"><b style={{ width: `${pct}%` }} /></i>
          {pct}%
        </span>
      )}
      {next && (
        <span class={`kex-hero__mi kex-hero__mi--next${next.overdue ? ' kex-hero__mi--overdue' : ''}`} data-kex-test="hero-next" title={t('hero.next')}>
          {next.overdue
            ? `${t('label.overdue')} · ${next.title}`
            : t('ws.next', { title: next.title, day: formatDate(next.due * 1000, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') })}
        </span>
      )}
    </p>
  );
}

export function Hero({ label, lines, links, seed = 0, intensity = 1, class: cls }: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const mode = heroEffectMode.value;
  const r = route.value;
  const isCourse = r?.effective === 'app' && (r.key === 'course' || r.key === 'section');
  const courseId = isCourse ? activeCourseId.value : null;
  const school = activeSchool.value;
  const style = activeRibbons.value;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const detach = heroCanvas.attach(el, { seed, intensity, leftFade: 0.46, style });
    const onMove = (e: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      heroCanvas.setPointer(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      detach();
    };
  }, [seed, intensity, style]);

  const text = lines[1] ? `${lines[0]}\n${lines[1]}` : lines[0];
  // The title size follows its longest line, so a long course name fits its column instead of running under the ribbons.
  const fit = { '--kex-chars': String(Math.max(8, ...lines.map((l) => l?.length ?? 0))), '--kex-chars-all': String(Math.max(8, text.length)) };
  const aria = courseId ? lines.filter(Boolean).join(' ') : (label ?? '');
  return (
    <section class={`kex-hero${courseId ? ' kex-hero--course' : ''}${cls ? ` ${cls}` : ''}`} ref={root} style={fit} data-kex-test="hero" data-mode={mode} data-school={school === 'default' ? undefined : school}>
      <Crosshair class="kex-cross--a" />
      <Crosshair class="kex-cross--b" />
      <div class="kex-hero__inner">
        {courseId ? <CourseMeta courseId={courseId} /> : <p class="kex-hero__label kex-mono" data-kex-test="hero-label">{label}</p>}
        <SlideUpText
          as="h1"
          class="kex-hero__title"
          testId="hero-title"
          text={text}
          split="words"
          stagger={MOTION.titleStagger / 1000}
          duration={MOTION.title / 1000}
          delay={Math.max(0, MOTION.titleDelay - sinceNavigation()) / 1000}
          lineDelay={lines[1] ? [0, MOTION.accentDelay / 1000] : undefined}
          gradient={lines[1] ? [1] : [0]}
        />
        <nav class="kex-hero__links" aria-label={aria}>
          {links.map((l) => (
            <a key={l.key} class="kex-hero__link" href={l.href ?? '#'} onClick={l.onClick}>
              <span>{l.label}</span>
              <ArrowNE size={13} strokeWidth={1.5} />
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
