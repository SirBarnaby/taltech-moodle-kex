import { ArrowRight } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { go } from '../../actions/navigate';
import { setGradesTab } from '../../actions/grades';
import { seasonLabel } from '../../data/names';
import { currentSemester, displayName } from '../../data/repo/courses';
import { courseGradesStore } from '../../data/repo/grades';
import type { GradeRow } from '../../data/scrape/grades';
import { t, type MessageKey } from '../../i18n';
import { sidebarCourses } from '../../state';
import { gradeRows, grSel, grTab, visibleGrades, type GradesTab } from '../../state/grades';
import { Band } from '../components/Band';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { EmptyState } from '../components/States';
import { GradeMeter } from '../components/GradeMeter';
import { Tabs, type TabDef } from '../components/Tabs';

const TAB_DEFS: TabDef<GradesTab>[] = [
  { key: 'current', label: 'gr.tab.current' as MessageKey, digit: '1' },
  { key: 'all', label: 'gr.tab.all' as MessageKey, digit: '2' },
];

/** Enrich only visible, graded courses; a long transcript never triggers a request per course at mount. */
function CourseGrade({ row }: { row: GradeRow }) {
  const ref = useRef<HTMLSpanElement>(null);
  const store = courseGradesStore(row.courseId);
  const courseGrade = store.value.value?.course;
  const grade = row.percentage !== undefined ? row : courseGrade ?? row;
  useEffect(() => {
    if (!row.graded || row.percentage !== undefined || !ref.current) return;
    let mounted = true;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (!mounted || !entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void store.refresh();
    });
    observer.observe(ref.current);
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [row.courseId, row.graded, row.percentage, store]);
  return (
    <span ref={ref} class="kex-gr__grade kex-mono" data-kex-test="gr-grade">
      <span>{row.graded ? row.grade : '–'}</span>
      {row.graded && <GradeMeter grade={grade} compact />}
    </span>
  );
}

/** Grades overview: Moodle's raw grade and, when available, its percentage in a compact course row. */
export function GradesOverviewView() {
  useEffectsConfig();
  useQuietFocus();
  useEffect(() => {
    grSel.value = undefined;
  }, []);

  const tab = grTab.value;
  const list = visibleGrades.value;
  const courses = sidebarCourses.value;
  const sem = currentSemester(courses);
  const sel = grSel.value !== undefined && list.some((r) => r.courseId === grSel.value) ? grSel.value : list[0]?.courseId;
  const byId = new Map(courses.map((c) => [c.id, c]));
  const none = gradeRows.value.length === 0;

  return (
    <main class="kex-main kex-grades" id="kex-main" data-kex-test="grades" data-tab={tab}>
      <Band label={`${t('gr.label')} / ${seasonLabel(sem.season)} ${sem.year}`} title={t('gr.title')} seed={3} />
      <div class="kex-content">
        <div class="kex-matheader kex-grbar">
          <Tabs<GradesTab> value={tab} onChange={setGradesTab} items={TAB_DEFS} label={t('gr.tabs')} idPrefix="kex-gr-tab" panelId="kex-gr-panel" />
        </div>
        <section id="kex-gr-panel" role="tabpanel" aria-labelledby={`kex-gr-tab-${tab}`} data-kex-test="gr-panel">
          {list.length === 0 ? (
            <EmptyState kicker={t('ws.emptyKicker')} title={none ? t('gr.empty') : t('gr.emptyCurrent')} />
          ) : (
            <ul class="kex-grrows" data-kex-test="gr-rows">
              {list.map((r, i) => {
                const c = byId.get(r.courseId);
                const name = c ? displayName(c) : r.name;
                const code = c?.code || r.code;
                return (
                  <li
                    key={r.courseId}
                    class={`kex-gr${r.courseId === sel ? ' kex-gr--selected' : ''}${r.graded ? '' : ' kex-gr--none'}`}
                    data-kex-gr={r.courseId}
                    data-kex-test={`gr-row-${i + 1}`}
                    tabIndex={r.courseId === sel ? 0 : -1}
                    aria-label={`${code} ${name}, ${r.graded ? r.grade : t('gr.notGraded')}`}
                    onFocus={() => (grSel.value = r.courseId)}
                  >
                    <a
                      class="kex-gr__main"
                      href={r.href}
                      tabIndex={-1}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        go(r.href);
                      }}
                    >
                      <span class="kex-gr__code kex-mono">{code}</span>
                      <span class="kex-gr__name">{name}</span>
                      <CourseGrade row={r} />
                      <ArrowRight class="kex-gr__arrow" size={18} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
