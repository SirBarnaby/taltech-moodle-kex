import { useEffect, useRef } from 'preact/hooks';
import { courseCode, closePreview, initCourse, openCm, openCmOriginal, previewCm, retryCourse, setGroupOpen, setTopic, showGroup, stepPreview, togglePin, toggleDone } from '../../actions/course';
import { MOTION, sinceNavigation } from '../../fx/navigation';
import { softEntered } from '../../state/navigation';
import { courseGradesStore } from '../../data/repo/grades';
import { splitTitle } from '../../data/names';
import { displayName } from '../../data/repo/courses';
import { pinsStore, isPinned } from '../../data/repo/pins';
import { pad2, primaryIndex, resourceCount, type RowModel } from '../../data/topics';
import { t } from '../../i18n';
import { sanitizeHtml } from '../../lib/sanitize';
import { activeCourseId, headerTitle, pageInfo, settings, sidebarCourses } from '../../state';
import {
  courseError, courseState, courseStatus, focusZone, labTrack, labTrackSettled, mergedSummaries, openGroups, pinnedRow, previewCmId, rows, sectionView, secondaryNav, selectedCmId, topicNumber, topics, currentTopic,
} from '../../state/course';
import { Button } from '../components/Button';
import { CourseBar } from '../components/CourseBar';
import { CourseNav } from '../components/CourseNav';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { Hero } from '../components/Hero';
import { PinnedRow } from '../components/PinnedRow';
import { PreviewSheet } from '../components/PreviewSheet';
import { ResourceRow } from '../components/ResourceRow';
import { SlideUpText } from '../components/SlideUpText';
import { EmptyState, RowSkeleton, TopicSkeleton } from '../components/States';
import { LabTrack } from '../components/LabTrack';
import { SubsectionCard } from '../components/SubsectionCard';
import { TopicList, topicDisplayTitle } from '../components/TopicList';

function useCourseInit(): ReturnType<typeof courseGradesStore> | undefined {
  const id = activeCourseId.value;
  const gradeStore = id ? courseGradesStore(id) : undefined;
  useEffect(() => { if (gradeStore) void gradeStore.refresh(); }, [id]);
  useEffect(() => {
    if (!id) return;
    return initCourse(id);
  }, [id]);
  return gradeStore;
}

function useCompactTitle(code: string, courseName: string, topicLabel: { chip: string; text: string } | undefined): void {
  const heroOut = useRef(false);
  const topicOut = useRef(false);
  const label = useRef(topicLabel);
  label.current = topicLabel;
  const sync = (): void => {
    if (!heroOut.current) headerTitle.value = null;
    else if (topicOut.current && label.current) headerTitle.value = label.current;
    else headerTitle.value = { chip: code, text: courseName };
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    const hero = document.querySelector('[data-kex-test="hero-title"]');
    const topic = document.querySelector('[data-kex-test="detail-title"]');
    const io = new IntersectionObserver(
      (list) => {
        for (const entry of list) {
          if (entry.target === hero) heroOut.current = !entry.isIntersecting;
          else if (entry.target === topic) topicOut.current = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        }
        syncRef.current();
      },
      { rootMargin: '-52px 0px 0px 0px' },
    );
    if (hero) io.observe(hero);
    if (topic) io.observe(topic);
    return () => {
      io.disconnect();
      headerTitle.value = null;
    };
  }, [courseState.value === undefined, topicNumber.value]);
  useEffect(() => syncRef.current(), [code, courseName, topicLabel?.chip, topicLabel?.text]);
}

export function CourseView() {
  const gradeStore = useCourseInit();
  // The topic title follows the hero when the view is new; later topic switches start it almost at once.
  const born = useRef(performance.now());
  const topicDelay = (performance.now() - born.current < 400 ? Math.max(0, MOTION.topicDelay - sinceNavigation()) : 30) / 1000;
  useEffectsConfig();
  useQuietFocus();

  const id = activeCourseId.value;
  const info = pageInfo.value;
  const course = sidebarCourses.value.find((c) => c.id === id);
  const status = courseStatus.value;
  const st = courseState.value;
  const tps = topics.value;
  const topic = currentTopic.value;
  const rowList = rows.value;
  const view = sectionView.value;
  const pins = pinsStore().value.value ?? [];
  const sel = selectedCmId.value;
  const previewId = previewCmId.value;
  const previewRow = previewId === undefined ? undefined : rowList.find((r) => r.cm.id === previewId);
  const track = labTrack.value;
  const open = openGroups.value;
  const labOf = new Map(track?.map((i) => [i.group.section.id, i]) ?? []);
  const compact = !!track || settings.value.density === 'compact';

  const code = course?.code ?? courseCode();
  const rawName = (course ? displayName(course) : '') || info?.heading || '';
  const lines = splitTitle(rawName);

  const detailTitle = topic ? topicDisplayTitle(topic) : '';
  const compactLabel = detailTitle && topic ? { chip: topic.isIntro ? code : `${t('course.topic')} ${topic.number}`, text: detailTitle } : undefined;
  useCompactTitle(code, rawName, compactLabel);

  // Moodle's own summary of the section, sanitized (images and links kept).
  const topicSection = topic?.section;
  const summaryHtml = topicSection ? (mergedSummaries.value.get(topicSection.id) ?? (topicSection.summaryHtml ? sanitizeHtml(topicSection.summaryHtml) : '')) : '';
  const count = resourceCount(rowList);
  const primaryRow = rowList[primaryIndex(rowList)];
  // Display position of each material (notes are not numbered), across the topic and its subsection cards.
  const position = new Map<number, number>();
  let n = 0;
  for (const r of rowList) if (r.kind !== 'note') position.set(r.cm.id, ++n);
  const orderOf = new Map(rowList.map((r, i) => [r.cm.id, i]));

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
      else if (target?.closest('.kex-topics, .kex-cbar__topics')) focusZone.value = 'topics';
    };
    el.addEventListener('focusin', onIn);
    return () => el.removeEventListener('focusin', onIn);
  }, []);

  // Focus starts on the active topic row (without a visible ring until a key is pressed).
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || status !== 'ready' || topicNumber.value === undefined) return;
    focused.current = true;
    requestAnimationFrame(() => {
      // Only when nothing else has taken focus meanwhile (the search box, the palette, a dialog).
      const a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement) return;
      document.querySelector<HTMLElement>(`[data-kex-topic="${topicNumber.value}"]`)?.focus({ preventScroll: true });
    });
  }, [status, topicNumber.value]);

  const loading = status === 'loading' && !st;
  const failed = status === 'error' && !st;
  // Skeleton to content: the real thing fades in once instead of popping.
  const waited = useRef(false);
  if (loading) waited.current = true;
  const arrived = waited.current && !loading && !failed;

  const renderRow = (row: RowModel, enter: number) => (
    <ResourceRow
      key={row.cm.id}
      row={row}
      grade={gradeStore?.value.value?.activities[String(row.cm.id)]}
      index={position.get(row.cm.id) ?? 0}
      topicNumber={pad2(topic?.section.number ?? 0)}
      pinned={isPinned(row.cm.id, pins)}
      primary={row === primaryRow}
      selected={row.cm.id === sel}
      reading={row.cm.id === previewId}
      enter={enter}
      onSelect={(cmid) => (selectedCmId.value = cmid)}
      onOpen={(r, newTab) => openCm(r, newTab)}
      onPreview={(r: RowModel) => previewCm(r)}
      onPin={(r: RowModel) => void togglePin(r)}
      onDone={(r: RowModel) => void toggleDone(r)}
    />
  );

  const list = view.blocks.length ? (
    <ul class={`kex-rows${compact ? ' kex-rows--compact' : ''}`} key={topicNumber.value} data-kex-test="rows">
      {view.blocks.map((block, bi) =>
        block.type === 'row' ? (
          renderRow(block.row, orderOf.get(block.row.cm.id) ?? bi)
        ) : (
          <SubsectionCard
            key={`g-${block.group.section.id}`}
            group={block.group}
            index={bi + 1}
            lab={labOf.get(block.group.section.id)}
            open={!track || open.has(block.group.section.id)}
            onToggle={(o) => setGroupOpen(block.group.section.id, o)}
          >
            {block.group.rows.map((r) => renderRow(r, orderOf.get(r.cm.id) ?? bi))}
          </SubsectionCard>
        ),
      )}
    </ul>
  ) : !summaryHtml ? (
    <EmptyState kicker={t('course.noRows')} title={t('course.noRowsText')} />
  ) : null;

  return (
    <main class="kex-main kex-course" id="kex-main" data-kex-test="course" data-kex-course={id ?? ''} data-kex-ready={!loading && labTrackSettled.value}>
      <Hero
        key={id ?? 0}
        lines={lines.length ? lines : [rawName]}
        links={[]}
      />
      <div class="kex-content">
        {id && !loading && !failed && tps.length > 0 && (
          <CourseBar topics={tps} active={topicNumber.value} onSelect={(num) => setTopic(num, { focus: true })} onKeyDown={onTopicKeys} pins={pinnedRow.value} courseId={id} />
        )}
        <PinnedRow pins={pinnedRow.value} courseId={id} />
        <div class="kex-matheader">
          <SlideUpText as="h2" class="kex-matheader__title" text={t('course.materials')} split="words" stagger={0.06} duration={MOTION.title / 1000} still={softEntered.value} inView />
          <CourseNav tabs={secondaryNav.value} />
        </div>
        <div class={`kex-body${arrived ? ' kex-fade-in' : ''}`}>
          {loading ? (
            <TopicSkeleton />
          ) : failed ? null : tps.length ? (
            <TopicList topics={tps} active={topicNumber.value} onSelect={(num) => setTopic(num, { focus: true })} onKeyDown={onTopicKeys} />
          ) : null}
          <section class="kex-detail" id="kex-detail" data-kex-test="detail" aria-busy={loading}>
            {failed ? (
              <EmptyState tone="error" kicker={t('course.errorKicker')} title={t('course.error')} text={courseError.value}>
                <Button variant="outlined" arrow={false} onClick={retryCourse}>{t('course.retry')}</Button>
                <a class="kex-link" href={info ? `${info.wwwroot}/course/view.php?id=${id}&kex=off` : '#'}>{t('course.openMoodle')}</a>
              </EmptyState>
            ) : loading ? (
              <>
                <div class="kex-detail__top"><span class="kex-skel kex-skel--kicker" /></div>
                <span class="kex-skel kex-skel--title" />
                <RowSkeleton />
              </>
            ) : st && !tps.length ? (
              <EmptyState kicker={t('course.noRows')} title={t('course.noTopics')} />
            ) : (
              <>
                {topic?.tile && <img class="kex-detail__banner" src={topic.tile} alt="" decoding="async" data-kex-test="detail-banner" />}
                <div class="kex-detail__top">
                  <p class="kex-detail__kicker kex-mono" data-kex-test="detail-kicker">
                    {topic?.isIntro ? '' : topic?.isRange ? `${t('course.week')} ${topic.number}` : `${t('course.topic')} ${topic?.number ?? ''}`}
                  </p>
                  <p class="kex-detail__count kex-mono" data-kex-test="detail-count">
                    {count === 1 ? t('course.resource') : t('course.resources', { n: count })}
                  </p>
                </div>
                <div class="kex-detail__head">
                  <div class="kex-detail__titles">
                    <SlideUpText as="h3" class="kex-detail__title" testId="detail-title" text={detailTitle} split="characters" stagger={0.018} maxStagger={MOTION.topicStagger / 1000} duration={MOTION.topic / 1000} delay={topicDelay} />
                    {topic?.isRange && <p class="kex-detail__range">{topic.title}</p>}
                  </div>
                </div>
                {summaryHtml && <div class="kex-detail__summary" data-kex-test="detail-summary" dangerouslySetInnerHTML={{ __html: summaryHtml }} />}
                {track ? (
                  // Labs: a list of every lab beside the open one in a wide column, chips over folded cards in a narrow one (track.css).
                  <div class="kex-labs" data-kex-test="labs">
                    <LabTrack items={track} open={open} onShow={(gid) => showGroup(gid)} />
                    {list}
                    {!track.some((i) => open.has(i.group.section.id)) && (labTrackSettled.value
                      ? <p class="kex-labs__none">{t('track.pick')}</p>
                      : <div class="kex-labs__none kex-labs__none--wait" aria-hidden="true"><span class="kex-skel kex-skel--kicker" /><span class="kex-skel kex-skel--line kex-skel--w1" /><span class="kex-skel kex-skel--line kex-skel--w2" /></div>)}
                  </div>
                ) : list}
              </>
            )}
          </section>
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
