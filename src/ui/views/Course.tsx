import { ChevronRight, Lock } from 'lucide-preact';
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  closePreview, courseCode, foldAll, initCourse, notePlace, openCm, openCmOriginal, previewCm, relaxPageEnd, retryCourse, setGroupOpen, setTopic, spyHeld, startTarget, stepPreview, toggleDone, togglePin, toggleTopic, topicY,
} from '../../actions/course';
import { MOTION, restorePending, revealInScroller, scrollInstant, stickyTop } from '../../fx/navigation';
import { softEntered } from '../../state/navigation';
import { courseGradesStore } from '../../data/repo/grades';
import { splitTitle } from '../../data/names';
import { displayName } from '../../data/repo/courses';
import { pinsStore, isPinned } from '../../data/repo/pins';
import { pad2, resourceCount, type RowModel } from '../../data/topics';
import { t } from '../../i18n';
import { sanitizeHtml } from '../../lib/sanitize';
import { activeCourseId, headerTitle, pageInfo, settings, sidebarCourses } from '../../state';
import {
  courseBlocks, courseError, courseState, courseStatus, focusZone, foldedTopics, labChoice, labOpen, mergedSummaries, pinnedRow, previewCmId, rows, secondaryNav, selectedCmId, topicMarks, topicNumber, topics,
  type TopicBlock,
} from '../../state/course';
import { Button } from '../components/Button';
import { CourseBar } from '../components/CourseBar';
import { CourseNav } from '../components/CourseNav';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { Hero } from '../components/Hero';
import { PinnedRow } from '../components/PinnedRow';
import { PreviewSheet } from '../components/PreviewSheet';
import { ResourceRow } from '../components/ResourceRow';
import { Reveal } from '../components/Reveal';
import { SlideUpText } from '../components/SlideUpText';
import { EmptyState, RowSkeleton } from '../components/States';
import { SubsectionCard } from '../components/SubsectionCard';
import { TopicMark, topicDisplayTitle } from '../components/TopicMark';

/**
 * The course page (round 10): the whole course on one page, every topic in Moodle's order with its materials under it. An
 * outline of the topics stays pinned beside them (the topic bar in a narrow column) and lights up the topic being read; a click
 * glides the page there. Topics are never swapped in and out, so nothing on the page jumps while the reader moves around.
 */

function useCourseInit(): ReturnType<typeof courseGradesStore> | undefined {
  const id = activeCourseId.value;
  const gradeStore = id ? courseGradesStore(id) : undefined;
  useEffect(() => { if (gradeStore) void gradeStore.refresh(); }, [id]);
  // Before the first paint: a course seen before is drawn from the cache at once, with no placeholder frame in between.
  useLayoutEffect(() => {
    if (!id) return;
    return initCourse(id);
  }, [id]);
  return gradeStore;
}

/** Done and total of the tracked activities of a topic. */
function progressOf(list: readonly RowModel[]): { done: number; total: number } {
  const tracked = list.filter((r) => r.kind !== 'note' && r.cm.tracked);
  return { done: tracked.filter((r) => !r.incomplete).length, total: tracked.length };
}

/**
 * Where the page opens (the address, else where the reader left it, else the top), set before the first paint of the content, and
 * the scroll spy that keeps the topic being read and the place in it (for the outline, the header and the next visit).
 */
function usePlace(code: string, courseName: string): void {
  const ready = courseStatus.value === 'ready';
  const placed = useRef(false);
  const heroOut = useRef(false);
  const label = useRef<{ chip: string; text: string } | undefined>(undefined);
  const id = activeCourseId.value;

  useLayoutEffect(() => {
    placed.current = false;
  }, [id]);

  useLayoutEffect(() => {
    if (!ready || placed.current) return;
    placed.current = true;
    // Back, Forward and Reload put their own position back.
    if (restorePending()) return;
    const target = startTarget();
    if (!target) return;
    const y = topicY(target.topic);
    if (y === undefined) return;
    topicNumber.value = target.topic;
    scrollInstant(Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, y + target.offset)));
    if (target.cm !== undefined) selectedCmId.value = target.cm;
  }, [ready, id]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const syncTitle = (): void => {
      headerTitle.value = !heroOut.current ? null : label.current ?? { chip: code, text: courseName };
    };
    const measure = (): void => {
      frame = 0;
      relaxPageEnd();
      const secs = Array.from(document.querySelectorAll<HTMLElement>('#kex-main [data-kex-section]'));
      if (!secs.length) return;
      const line = stickyTop() + 20;
      let cur = secs[0]!;
      for (const s of secs) {
        if (s.getBoundingClientRect().top <= line) cur = s;
        else break;
      }
      // At the very bottom a short last topic never reaches the line: the last one whose header is on screen is being read.
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atEnd) {
        const shown = secs.filter((s) => s.getBoundingClientRect().top < window.innerHeight - 80);
        cur = shown[shown.length - 1] ?? cur;
      }
      const n = Number(cur.dataset.kexSection);
      const head = cur.querySelector<HTMLElement>('.kex-tsec__head');
      const past = !!head && head.getBoundingClientRect().bottom < line;
      const tp = topics.value.find((x) => x.section.number === n);
      label.current = past && tp ? { chip: tp.isIntro ? code : `${t('course.topic')} ${tp.number}`, text: topicDisplayTitle(tp) } : undefined;
      syncTitle();
      if (spyHeld()) return;
      notePlace(n, stickyTop() + 12 - cur.getBoundingClientRect().top);
    };
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const hero = document.querySelector('[data-kex-test="hero-title"]');
    const io = hero && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => {
        heroOut.current = !!e && !e.isIntersecting;
        syncTitle();
      }, { rootMargin: '-52px 0px 0px 0px' })
      : undefined;
    if (hero) io?.observe(hero);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      headerTitle.value = null;
    };
  }, [ready, id, code, courseName]);
}

/** Moodle's summary of a topic: its first three lines, then Moodle's own "Show more". */
function TopicSummary({ html, id }: { html: string; id: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [needed, setNeeded] = useState(false);
  // Measured before the first paint (and again when the column or the text changes): the button is there only when it is needed.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || open) return;
    const measure = (): void => setNeeded(el.scrollHeight > el.clientHeight + 2);
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [html, open]);
  return (
    <Reveal class="kex-tsec__about">
      <div class={`kex-tsec__summary kex-detail__summary${open ? ' kex-tsec__summary--open' : ''}`} id={`kex-sum-${id}`} ref={box} dangerouslySetInnerHTML={{ __html: html }} />
      {(needed || open) && (
        <button type="button" class="kex-tsec__more" aria-expanded={open} aria-controls={`kex-sum-${id}`} onClick={() => setOpen(!open)}>
          {open ? t('course.topicsLess') : t('course.topicsMore')}
        </button>
      )}
    </Reveal>
  );
}

interface SectionProps {
  block: TopicBlock;
  code: string;
  folded: boolean;
  renderRow: (row: RowModel, topicNumber: string) => JSX.Element;
  summaryHtml: string;
}

function TopicSection({ block, code, folded, renderRow, summaryHtml }: SectionProps) {
  const { topic, view, labs } = block;
  const n = topic.section.number;
  const title = topicDisplayTitle(topic);
  const count = resourceCount(view.rows);
  const { done, total } = progressOf(view.rows);
  const choice = labChoice.value;
  const num = pad2(n);
  const headId = `kex-tsec-${topic.section.id}`;
  const bodyId = `kex-tsec-body-${topic.section.id}`;
  return (
    <section class={`kex-tsec${folded ? ' kex-tsec--folded' : ''}`} data-kex-section={n} aria-labelledby={headId} data-kex-test={`section-${n}`}>
      <header class="kex-tsec__head">
        <h3 class="kex-tsec__title" id={headId}>
          <button type="button" class="kex-tsec__toggle" aria-expanded={!folded} aria-controls={bodyId} onClick={() => toggleTopic(topic.section.id)}>
            <ChevronRight class="kex-tsec__chev" size={18} strokeWidth={1.75} aria-hidden="true" />
            <span class="kex-tsec__num kex-mono" aria-hidden={topic.isIntro ? 'true' : undefined}>{topic.isIntro ? code : num}</span>
            <span class="kex-tsec__text">{title}</span>
            {topic.restricted && <Lock class="kex-tsec__lock" size={14} strokeWidth={1.75} aria-label={t('course.restricted')} />}
          </button>
        </h3>
        {topic.isRange && <p class="kex-tsec__range">{topic.title}</p>}
        <p class="kex-tsec__count kex-mono">
          {total > 0 ? t('track.progress', { done, total }) : count === 1 ? t('course.resource') : t('course.resources', { n: count })}
        </p>
      </header>
      <div class="kex-tsec__fold" id={bodyId} inert={folded}>
        <div class="kex-tsec__foldin">
          {summaryHtml && <TopicSummary html={summaryHtml} id={topic.section.id} />}
          {view.blocks.length ? (
            <ul class={`kex-rows${settings.value.density === 'compact' ? ' kex-rows--compact' : ''}`} data-kex-test={`rows-${n}`}>
              {view.blocks.map((b, bi) => {
                if (b.type === 'row') return renderRow(b.row, num);
                const lab = labs?.get(b.group.section.id);
                return (
                  <SubsectionCard
                    key={`g-${b.group.section.id}`}
                    group={b.group}
                    index={bi + 1}
                    lab={lab}
                    open={!lab || labOpen(b.group.section.id, lab, choice)}
                    onToggle={(o) => setGroupOpen(b.group.section.id, o)}
                  >
                    {b.group.rows.map((r) => renderRow(r, num))}
                  </SubsectionCard>
                );
              })}
            </ul>
          ) : !summaryHtml ? (
            <p class="kex-tsec__empty">{t('course.noRowsText')}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The outline of the topics beside the materials (wide columns): it stays pinned, lights up the topic being read and keeps it in view. */
function TopicOutline({ blocks, active, onSelect, onKeyDown }: { blocks: TopicBlock[]; active?: number; onSelect: (n: number) => void; onKeyDown: (e: KeyboardEvent) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const marks = topicMarks.value;
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-kex-topic="${active}"]`);
    if (el && list.current) revealInScroller(el, list.current.parentElement);
  }, [active]);
  const tabStop = blocks.some((b) => b.topic.section.number === active) ? active : blocks[0]?.topic.section.number;
  return (
    <nav class="kex-outline" aria-label={t('course.topicsNav')} data-kex-test="topics">
      <div class="kex-outline__scroll">
        <p class="kex-outline__label kex-mono" id="kex-topics-label">{t('course.topics')}</p>
        <ol class="kex-outline__list" ref={list} aria-labelledby="kex-topics-label" onKeyDown={(e) => {
          onKeyDown(e);
          if (e.defaultPrevented || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
          e.preventDefault();
          const i = blocks.findIndex((b) => b.topic.section.number === active);
          const next = blocks[Math.max(0, Math.min(blocks.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
          if (next) onSelect(next.topic.section.number);
        }}>
          {blocks.map(({ topic, view }, i) => {
            const n = topic.section.number;
            const on = n === active;
            const { done, total } = progressOf(view.rows);
            const title = topicDisplayTitle(topic);
            return (
              <li key={topic.section.id}>
                <a
                  class={`kex-outline__item${on ? ' kex-outline__item--active' : ''}${topic.restricted ? ' kex-outline__item--locked' : ''}`}
                  href={`#topic-${n}`}
                  title={title}
                  aria-current={on ? 'true' : undefined}
                  tabIndex={n === tabStop ? 0 : -1}
                  data-kex-topic={n}
                  data-kex-test={`topics-row-${i + 1}`}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    onSelect(n);
                  }}
                >
                  <span class="kex-outline__num kex-mono">{pad2(n)}</span>
                  {topic.tile ? <img class="kex-outline__tile" src={topic.tile} alt="" width="32" height="22" loading="lazy" decoding="async" /> : null}
                  <span class="kex-outline__title">{title}</span>
                  {total > 0 && <span class="kex-outline__done kex-mono" aria-label={t('track.progress', { done, total })}>{done}/{total}</span>}
                  <TopicMark state={marks.get(n)} />
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export function CourseView() {
  const gradeStore = useCourseInit();
  useEffectsConfig();
  useQuietFocus();

  const id = activeCourseId.value;
  const info = pageInfo.value;
  const course = sidebarCourses.value.find((c) => c.id === id);
  const status = courseStatus.value;
  const st = courseState.value;
  const tps = topics.value;
  const blocks = courseBlocks.value;
  const allRows = rows.value;
  const folded = foldedTopics.value;
  const pins = pinsStore().value.value ?? [];
  const sel = selectedCmId.value;
  const previewId = previewCmId.value;
  const previewRow = previewId === undefined ? undefined : allRows.find((r) => r.cm.id === previewId);
  const summaries = mergedSummaries.value;

  const code = course?.code ?? courseCode();
  const rawName = (course ? displayName(course) : '') || info?.heading || '';
  const lines = splitTitle(rawName);
  usePlace(code, rawName);

  // The primary (filled) button: the first thing still to do in the whole course.
  const primaryId = (allRows.find((r) => r.incomplete && r.kind !== 'note' && !r.locked) ?? allRows.find((r) => r.kind !== 'note'))?.cm.id;
  // Display position of each material (notes are not numbered), across the course.
  const position = new Map<number, number>();
  let k = 0;
  for (const r of allRows) if (r.kind !== 'note') position.set(r.cm.id, ++k);

  const onTopicKeys = (e: KeyboardEvent): void => {
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const target = e.key === 'Home' ? tps[0] : tps[tps.length - 1];
      if (target) setTopic(target.section.number, { focus: true });
    }
  };

  useEffect(() => {
    const el = document.getElementById('kex-main');
    if (!el) return;
    const onIn = (e: FocusEvent): void => {
      const target = e.target as Element | null;
      if (target?.closest('.kex-rows')) focusZone.value = 'rows';
      else if (target?.closest('.kex-outline, .kex-cbar__topics')) focusZone.value = 'topics';
    };
    el.addEventListener('focusin', onIn);
    return () => el.removeEventListener('focusin', onIn);
  }, []);

  const loading = status === 'loading' && !st;
  const failed = status === 'error' && !st;
  // Skeleton to content: the real thing fades in once instead of popping.
  const waited = useRef(false);
  if (loading) waited.current = true;
  const arrived = waited.current && !loading && !failed;
  const anyFolded = folded.size > 0;

  const renderRow = (row: RowModel, num: string) => (
    <ResourceRow
      key={row.cm.id}
      row={row}
      grade={gradeStore?.value.value?.activities[String(row.cm.id)]}
      index={position.get(row.cm.id) ?? 0}
      topicNumber={num}
      pinned={isPinned(row.cm.id, pins)}
      primary={row.cm.id === primaryId}
      selected={row.cm.id === sel}
      reading={row.cm.id === previewId}
      onSelect={(cmid) => (selectedCmId.value = cmid)}
      onOpen={(r, newTab) => openCm(r, newTab)}
      onPreview={(r: RowModel) => previewCm(r)}
      onPin={(r: RowModel) => void togglePin(r)}
      onDone={(r: RowModel) => void toggleDone(r)}
    />
  );

  return (
    <main class="kex-main kex-course" id="kex-main" data-kex-test="course" data-kex-course={id ?? ''} data-kex-ready={!loading}>
      <Hero key={id ?? 0} lines={lines.length ? lines : [rawName]} links={[]} />
      <div class="kex-content">
        <PinnedRow pins={pinnedRow.value} courseId={id} />
        <div class="kex-matheader">
          <SlideUpText as="h2" class="kex-matheader__title" text={t('course.materials')} split="words" stagger={0.06} duration={MOTION.title / 1000} still={softEntered.value} inView />
          <CourseNav tabs={secondaryNav.value} />
        </div>
        {id && !loading && !failed && tps.length > 0 && (
          <CourseBar topics={tps} active={topicNumber.value} onSelect={(num) => setTopic(num, { focus: true })} onKeyDown={onTopicKeys} pins={pinnedRow.value} courseId={id} marks={topicMarks.value} />
        )}
        <div class={`kex-book${arrived ? ' kex-fade-in' : ''}`} data-kex-test="detail">
          {loading ? (
            <div class="kex-book__pages" aria-busy="true">
              <div class="kex-tsec kex-tsec--skel" aria-hidden="true"><span class="kex-skel kex-skel--title" /><RowSkeleton n={4} /></div>
              <div class="kex-tsec kex-tsec--skel" aria-hidden="true"><span class="kex-skel kex-skel--title" /><RowSkeleton n={3} /></div>
            </div>
          ) : failed ? (
            <EmptyState tone="error" kicker={t('course.errorKicker')} title={t('course.error')} text={courseError.value}>
              <Button variant="outlined" arrow={false} onClick={retryCourse}>{t('course.retry')}</Button>
              <a class="kex-link" href={info ? `${info.wwwroot}/course/view.php?id=${id}&kex=off` : '#'}>{t('course.openMoodle')}</a>
            </EmptyState>
          ) : st && !tps.length ? (
            <EmptyState kicker={t('course.noRows')} title={t('course.noTopics')} />
          ) : (
            <>
              <TopicOutline blocks={blocks} active={topicNumber.value} onSelect={(num) => setTopic(num, { focus: true })} onKeyDown={onTopicKeys} />
              <div class="kex-book__pages">
                <div class="kex-book__tools">
                  <button type="button" class="kex-book__foldall" data-kex-test="fold-all" onClick={() => foldAll(!anyFolded)}>
                    {anyFolded ? t('course.expandAll') : t('course.collapseAll')}
                  </button>
                </div>
                {blocks.map((b) => {
                  const sec = b.topic.section;
                  const html = summaries.get(sec.id) ?? (sec.summaryHtml ? sanitizeHtml(sec.summaryHtml) : '');
                  return <TopicSection key={sec.id} block={b} code={code} folded={folded.has(sec.id)} renderRow={renderRow} summaryHtml={html} />;
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {previewRow && (
        <PreviewSheet
          row={previewRow}
          pinned={isPinned(previewRow.cm.id, pins)}
          onClose={closePreview}
          onOpen={(r, newTab) => openCmOriginal(r, newTab)}
          onPin={(r) => void togglePin(r)}
          onStep={stepPreview}
        />
      )}
    </main>
  );
}
