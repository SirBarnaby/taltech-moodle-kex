import { EyeOff, Eye, Star } from 'lucide-preact';
import { SiteNotices } from '../components/SiteNotices';
import { Reveal } from '../components/Reveal';
import { useEffect, useRef } from 'preact/hooks';
import { initMyCourses, setMcTab, storeOf, toggleHide, toggleStar } from '../../actions/mycourses';
import { go } from '../../actions/navigate';
import { seasonLabel } from '../../data/names';
import type { Course } from '../../data/model';
import { COURSE_TABS, lastAccess, type CoursesTab } from '../../data/repo/mycourses';
import { applyAliases, currentSemester, displayName } from '../../data/repo/courses';
import { t, type MessageKey } from '../../i18n';
import { relTime } from '../../lib/time';
import { schoolFor } from '../../lib/school';
import { settings, sidebarCourses } from '../../state';
import { mcFilter, mcHasArchived, mcSel, mcSort, mcTab, matchesFilter, setMcSort, sortCourses, type McSort } from '../../state/mycourses';
import { nowSec } from '../../state/workspace';
import { Band } from '../components/Band';
import { Button } from '../components/Button';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { Segmented } from '../components/Segmented';
import { EmptyState } from '../components/States';
import { Tabs, type TabDef } from '../components/Tabs';
import { MoodleInfo } from '../components/MoodleInfo';

const TAB_DEFS: TabDef<CoursesTab>[] = COURSE_TABS.map((k, i) => ({ key: k, label: `mc.tab.${k}` as MessageKey, digit: String(i + 1) }));

/** A gradient tile with the course code, for courses without a course image. */
function CourseTile({ course }: { course: Course }) {
  if (course.image) return <img class="kex-mc__img" src={course.image} alt="" width="64" height="40" loading="lazy" decoding="async" />;
  const hue = (course.id * 47) % 60;
  return (
    <span class="kex-mc__img kex-mc__img--ph" style={{ '--kex-ph': String(hue) }} aria-hidden="true">
      <span class="kex-mono">{course.code.slice(0, 3)}</span>
    </span>
  );
}

/** One course card of the grid. The school (first letter of the code) sets the accent line; the card is the row of the list. */
function CourseRow({ course, selected, index, access, now, bySchool }: { course: Course; selected: boolean; index: number; access: number | undefined; now: number; bySchool: boolean }) {
  const name = displayName(course);
  const pct = course.progress === null ? undefined : Math.max(0, Math.min(100, Math.round(course.progress)));
  return (
    <li
      class={`kex-mc${selected ? ' kex-mc--selected' : ''}${course.hidden ? ' kex-mc--hidden' : ''}`}
      data-kex-mc={course.id}
      data-kex-test={`mc-row-${index + 1}`}
      data-school={schoolFor(course.code, bySchool)}
      style={{ '--kex-i': String(Math.min(index, 7)) }}
      tabIndex={selected ? 0 : -1}
      aria-label={`${course.code} ${name}`}
      onFocus={() => (mcSel.value = course.id)}
    >
      <a
        class="kex-mc__main"
        href={course.url}
        tabIndex={-1}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          go(course.url);
        }}
      >
        <CourseTile course={course} />
        <span class="kex-mc__text">
          <span class="kex-mc__code kex-mono">{course.code}</span>
          <span class="kex-mc__name">{name}</span>
          {course.category && <span class="kex-mc__cat">{course.category}</span>}
        </span>
        <span class="kex-mc__progress" aria-label={pct === undefined ? undefined : t('mc.progress', { n: pct })}>
          {pct !== undefined && (
            <>
              <span class="kex-mc__bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
              <span class="kex-mc__pct kex-mono">{pct}%</span>
            </>
          )}
        </span>
        <span class="kex-mc__access kex-mono">{access ? t('mc.accessed', { rel: relTime(access - now).toUpperCase() }) : t('mc.never')}</span>
      </a>
      <span class="kex-mc__tools">
        <button
          type="button"
          class={`kex-mc__tool${course.favourite ? ' kex-mc__tool--on' : ''}`}
          aria-pressed={course.favourite}
          aria-label={t(course.favourite ? 'mc.unstar' : 'mc.star', { name })}
          title={`${t(course.favourite ? 'mc.unstar' : 'mc.star', { name })} (s)`}
          data-kex-test="mc-star"
          onClick={() => void toggleStar(course)}
        >
          <Star size={18} strokeWidth={1.6} fill={course.favourite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="kex-mc__tool"
          aria-label={t(course.hidden ? 'mc.show' : 'mc.hide', { name })}
          title={`${t(course.hidden ? 'mc.show' : 'mc.hide', { name })} (Shift+H)`}
          data-kex-test="mc-hide"
          onClick={() => void toggleHide(course)}
        >
          {course.hidden ? <Eye size={18} strokeWidth={1.6} aria-hidden="true" /> : <EyeOff size={18} strokeWidth={1.6} aria-hidden="true" />}
        </button>
      </span>
    </li>
  );
}

export function MyCoursesView() {
  useEffectsConfig();
  useQuietFocus();
  useEffect(() => initMyCourses(), []);

  const tab = mcTab.value;
  const store = storeOf(tab);
  const raw = store.value.value;
  const status = store.status.value;
  const filter = mcFilter.value;
  const sort = mcSort.value;
  const access = lastAccess.value;
  const now = nowSec.value;
  const sel = mcSel.value;
  const bySchool = settings.value.colourBySchool;
  const input = useRef<HTMLInputElement>(null);

  // Opening a tab loads it (the current one is usually warm from the sidebar).
  useEffect(() => {
    void store.refresh();
  }, [tab]);

  const sem = currentSemester(sidebarCourses.value);
  const list = raw ? sortCourses(applyAliases(raw, settings.value.courseAliases).filter((c) => matchesFilter(c, filter)), sort, access) : [];
  const current = sel !== undefined && list.some((c) => c.id === sel) ? sel : list[0]?.id;
  const loading = raw === undefined && status !== 'error';
  const failed = raw === undefined && status === 'error';
  const tabs = TAB_DEFS.filter((d) => d.key !== 'archived' || mcHasArchived.value);

  const sortOptions: { value: McSort; label: string }[] = [
    { value: 'last', label: t('mc.sort.last') },
    { value: 'name', label: t('mc.sort.name') },
    { value: 'code', label: t('mc.sort.code') },
  ];

  return (
    <main class="kex-main kex-mycourses" id="kex-main" data-kex-test="mycourses" data-tab={tab} data-kex-ready={!loading}>
      <Band label={`${t('mc.label')} / ${seasonLabel(sem.season)} ${sem.year}`} title={t('mc.title')} />
      <div class="kex-content">
        <Reveal>
          <MoodleInfo />
          <SiteNotices />
        </Reveal>
        <div class="kex-matheader kex-mcbar">
          <Tabs<CoursesTab> value={tab} onChange={setMcTab} items={tabs} label={t('mc.tabs')} idPrefix="kex-mc-tab" panelId="kex-mc-panel" />
          <div class="kex-mcbar__tools">
            <label class="kex-mcfilter">
              <span class="kex-sr">{t('mc.filter')}</span>
              <input
                ref={input}
                type="search"
                class="kex-mcfilter__input"
                data-kex-test="mc-filter"
                placeholder={t('mc.filterHint')}
                value={filter}
                autocomplete="off"
                spellcheck={false}
                onInput={(e) => (mcFilter.value = (e.currentTarget as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && mcFilter.value) {
                    e.stopPropagation();
                    mcFilter.value = '';
                  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    document.querySelector<HTMLElement>('[data-kex-mc][tabindex="0"]')?.focus({ preventScroll: true });
                  }
                }}
              />
            </label>
            <Segmented<McSort> value={sort} options={sortOptions} onChange={setMcSort} label={t('mc.sort')} slide />
          </div>
        </div>
        <section id="kex-mc-panel" role="tabpanel" aria-labelledby={`kex-mc-tab-${tab}`} class="kex-mclist" data-kex-test="mc-panel">
          {failed ? (
            <EmptyState tone="error" kicker={t('course.errorKicker')} title={t('mc.error')}>
              <Button variant="outlined" arrow={false} onClick={() => void store.refresh(true)}>{t('course.retry')}</Button>
            </EmptyState>
          ) : loading ? (
            <ul class="kex-mcrows kex-mcrows--skel" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <li class="kex-mc kex-mc--skel" key={i}>
                  <span class="kex-skel kex-skel--mc" />
                </li>
              ))}
            </ul>
          ) : list.length === 0 ? (
            <EmptyState kicker={t('ws.emptyKicker')} title={filter ? t('mc.emptyFilter') : t('mc.empty')}>
              {filter && <Button variant="outlined" arrow={false} onClick={() => (mcFilter.value = '')}>{t('mc.clearFilter')}</Button>}
            </EmptyState>
          ) : (
            <ul class="kex-mcrows" key={`${tab}:${sort}`} data-kex-test="mc-rows">
              {list.map((c, i) => (
                <CourseRow key={c.id} course={c} index={i} selected={c.id === current} access={access.get(c.id)} now={now} bySchool={bySchool} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
