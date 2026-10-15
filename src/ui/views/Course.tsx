import { ChevronDown } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { courseCode, closePreview, initCourse, openCm, previewCm, retryCourse, setTab, setTopic, showInfo, togglePin, toggleDone } from '../../actions/course';
import { go, homeUrl } from '../../actions/navigate';
import { classifyKind, type TabKey } from '../../data/classify';
import { seasonLabel, splitTitle } from '../../data/names';
import { pinsStore, isPinned } from '../../data/repo/pins';
import { cmsOfSection, section0 } from '../../data/repo/coursestate';
import { primaryIndex, resourceCount, subtitleForRows, type RowModel } from '../../data/topics';
import { RECORDING_RE } from '../../data/classify';
import { effects } from '../../fx/effects';
import { t } from '../../i18n';
import { sanitizeHtml } from '../../lib/sanitize';
import { activeCourseId, headerTitle, pageInfo, resolvedMotion, settings, sidebarCourses } from '../../state';
import {
  allRows, courseError, courseState, courseStatus, focusZone, infoOpen, pinnedRow, previewCmId, rows, selectedCmId, summaries, tab, topicNumber, topics, currentTopic,
} from '../../state/course';
import { Button } from '../components/Button';
import { Hero, type HeroLink } from '../components/Hero';
import { PinnedRow } from '../components/PinnedRow';
import { PreviewSheet } from '../components/PreviewSheet';
import { ResourceRow } from '../components/ResourceRow';
import { SlideUpText } from '../components/SlideUpText';
import { EmptyState, RowSkeleton, TopicSkeleton } from '../components/States';
import { Tabs } from '../components/Tabs';
import { TopicList, topicDisplayTitle } from '../components/TopicList';
import { pad2 } from '../../data/topics';

const FALLBACK_TITLE_RE = /^(?:general|üldine)$/i;

function useCourseInit(): void {
  const id = activeCourseId.value;
  useEffect(() => {
    if (!id) return;
    return initCourse(id);
  }, [id]);
}

/** Hero effects follow the settings (architecture §14). */
function useEffectsConfig(): void {
  const eff = settings.value.effects;
  const motion = resolvedMotion.value;
  useEffect(() => {
    effects.configure({ effects: eff, motion, freezeTime: settings.value.debug?.freezeTime });
  }, [eff, motion, settings.value.debug?.freezeTime]);
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
  }, [courseState.value === undefined, infoOpen.value, topicNumber.value]);
  useEffect(() => syncRef.current(), [code, courseName, topicLabel?.chip, topicLabel?.text]);
}

function useQuietFocus(): void {
  useEffect(() => {
    const root = document.getElementById('kex-root');
    const off = (): void => root?.removeAttribute('data-quiet');
    root?.setAttribute('data-quiet', '');
    window.addEventListener('keydown', off, { once: true, capture: true });
    return () => {
      window.removeEventListener('keydown', off, true);
      off();
    };
  }, []);
}

export function CourseView() {
  useCourseInit();
  useEffectsConfig();
  useQuietFocus();

  const id = activeCourseId.value;
  const info = pageInfo.value;
  const course = sidebarCourses.value.find((c) => c.id === id);
  const status = courseStatus.value;
  const st = courseState.value;
  const tps = topics.value;
  const topic = currentTopic.value;
  const info0 = infoOpen.value;
  const rowList = rows.value;
  const everyRow = allRows.value;
  const pins = pinsStore().value.value ?? [];
  const activeTab = tab.value;
  const sel = selectedCmId.value;
  const previewId = previewCmId.value;
  const previewRow = previewId === undefined ? undefined : everyRow.find((r) => r.cm.id === previewId);

  const code = course?.code ?? courseCode();
  const rawName = course?.name ?? info?.heading ?? '';
  const lines = splitTitle(rawName);
  const sem = course?.semester;
  const label = [code, sem ? `${seasonLabel(sem.season)} ${sem.year}` : ''].filter(Boolean).join(' / ');

  const sec0 = st ? section0(st) : undefined;
  const infoTitle = !sec0?.title || FALLBACK_TITLE_RE.test(sec0.title) ? t('course.info') : sec0.title;

  const detailTitle = info0 ? infoTitle : topic ? topicDisplayTitle(topic) : '';
  const compactLabel = detailTitle ? { chip: info0 ? t('course.infoLabel') : `${t('course.topic')} ${topic?.number ?? ''}`, text: detailTitle } : undefined;
  useCompactTitle(code, rawName, compactLabel);

  // The page the hero's Recordings link would show.
  const recordings = (() => {
    if (!st) return undefined;
    const sec = tps.find((x) => RECORDING_RE.test(x.title));
    if (sec) return { topic: sec.section.number };
    for (const s of tps) {
      const cm = cmsOfSection(st, s.section).find((c) => classifyKind({ modname: c.modname, name: c.name }) === 'recording');
      if (cm) return { url: cm.url };
    }
    return undefined;
  })();

  const links: HeroLink[] = [
    { key: 'info', label: t('course.info'), href: '#', onClick: (e) => { e.preventDefault(); showInfo(); } },
  ];
  if (recordings) {
    links.push({
      key: 'rec',
      label: t('course.recordings'),
      href: recordings.url ?? `#topic-${recordings.topic}`,
      onClick: (e) => {
        e.preventDefault();
        if (recordings.topic !== undefined) setTopic(recordings.topic, { focus: true });
        else if (recordings.url) go(recordings.url, true);
      },
    });
  }
  if (id) links.push({ key: 'grades', label: t('course.grades'), href: homeUrl(`/grade/report/user/index.php?id=${id}`) });

  const subtitle = !info0 && topic ? subtitleForRows(everyRow, {
    lecture: t('kind.lecture'), practical: t('kind.practical'), assignment: t('kind.assignment'), quiz: t('kind.quiz'),
    recording: t('kind.recording'), reading: t('kind.reading'), material: t('kind.material'), discussion: t('kind.discussion'),
  }, t('kind.and')) : '';

  const topicSection = info0 ? sec0 : topic?.section;
  const summaryHtml = topicSection ? (summaries.value.get(topicSection.id) ?? (topicSection.summaryHtml ? sanitizeHtml(topicSection.summaryHtml) : '')) : '';
  const count = resourceCount(rowList);
  const primary = primaryIndex(rowList);
  let n = 0;

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
      else if (target?.closest('.kex-topics')) focusZone.value = 'topics';
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

  return (
    <main class="kex-main kex-course" id="kex-main" data-kex-test="course" data-kex-course={id ?? ''}>
      <Hero
        key={id ?? 0}
        label={label}
        lines={lines.length ? lines : [rawName]}
        links={links}
        seed={id ?? 0}
      />
      <div class="kex-content">
        <PinnedRow pins={pinnedRow.value} courseId={id} onEdit={() => go(homeUrl('/my/#pinned'))} />
        <div class="kex-matheader">
          <SlideUpText as="h2" class="kex-matheader__title" text={t('course.materials')} split="words" stagger={0.08} duration={0.6} inView />
          <Tabs value={activeTab} onChange={(k: TabKey) => setTab(k)} />
        </div>
        <div class="kex-body">
          {loading ? (
            <TopicSkeleton />
          ) : failed ? null : tps.length ? (
            <TopicList topics={tps} active={info0 ? undefined : topicNumber.value} onSelect={(num) => setTopic(num, { focus: true })} onKeyDown={onTopicKeys} />
          ) : null}
          <section class="kex-detail" id="kex-tabpanel" role="tabpanel" aria-labelledby={`kex-tab-${activeTab}`} data-kex-test="detail">
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
            ) : st && !tps.length && !info0 ? (
              <EmptyState kicker={t('course.infoLabel')} title={t('course.noTopics')} />
            ) : (
              <>
                <div class="kex-detail__top">
                  <p class="kex-detail__kicker kex-mono" data-kex-test="detail-kicker">
                    {info0 ? t('course.infoLabel') : topic?.isRange ? `${t('course.week')} ${topic.number}` : `${t('course.topic')} ${topic?.number ?? ''}`}
                  </p>
                  <p class="kex-detail__count kex-mono" data-kex-test="detail-count">
                    {count === 1 ? t('course.resource') : t('course.resources', { n: count })}
                  </p>
                </div>
                <div class="kex-detail__head">
                  <div class="kex-detail__titles">
                    <SlideUpText as="h3" class="kex-detail__title" testId="detail-title" text={detailTitle} split="characters" stagger={0.018} duration={0.45} />
                    {subtitle && <SlideUpText as="p" class="kex-detail__sub" text={subtitle} split="words" stagger={0.02} duration={0.4} delay={0.08} />}
                    {topic?.isRange && <p class="kex-detail__range">{topic.title}</p>}
                  </div>
                  {topic?.tile && !info0 && <img class="kex-detail__tile" src={topic.tile} alt="" width="160" height="100" decoding="async" />}
                </div>
                {summaryHtml && (info0 ? (
                  <div class="kex-detail__summary" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                ) : (
                  <details class="kex-about">
                    <summary>
                      <span>{t('course.about')}</span>
                      <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
                    </summary>
                    <div class="kex-detail__summary" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                  </details>
                ))}
                {rowList.length ? (
                  <ul class="kex-rows" key={`${info0 ? 0 : topicNumber.value}:${activeTab}`} data-kex-test="rows">
                    {rowList.map((row, i) => {
                      const header = row.group && row.group !== rowList[i - 1]?.group ? <li class="kex-rowgroup kex-mono" key={`g-${row.group}-${i}`}>{row.group}</li> : null;
                      const isNote = row.kind === 'note';
                      const index = isNote ? 0 : ++n;
                      return (
                        <>
                          {header}
                          <ResourceRow
                            key={row.cm.id}
                            row={row}
                            index={index}
                            topicNumber={info0 ? undefined : pad2(topicNumberOf(topic))}
                            pinned={isPinned(row.cm.id, pins)}
                            primary={i === primary}
                            selected={row.cm.id === sel}
                            enter={i}
                            onSelect={(cmid) => (selectedCmId.value = cmid)}
                            onOpen={(r, newTab) => openCm(r, newTab)}
                            onPreview={(r: RowModel) => previewCm(r)}
                            onPin={(r: RowModel) => void togglePin(r)}
                            onDone={(r: RowModel) => void toggleDone(r)}
                          />
                        </>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    kicker={t('course.noRows')}
                    title={everyRow.some((r) => r.kind !== 'note') ? t('course.noMatch', { tab: t(activeTab === 'labs' ? 'tab.labs' : 'tab.lectures') }) : t('course.noRowsText')}
                  >
                    {activeTab !== 'all' && <Button variant="outlined" arrow={false} onClick={() => setTab('all')}>{t('tab.all')}</Button>}
                  </EmptyState>
                )}
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
          onOpen={(r, newTab) => openCm(r, newTab)}
          onPin={(r) => void togglePin(r)}
        />
      )}
    </main>
  );
}

function topicNumberOf(topic: { section: { number: number } } | undefined): number {
  return topic?.section.number ?? 0;
}
