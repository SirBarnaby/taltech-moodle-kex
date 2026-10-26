import { describe, expect, it } from 'vitest';
import { contrast, inkPage, parseColor, resolved } from '../../src/content/darkink';
import type { Section } from '../../src/data/model';
import { detectCourseSeries, detectTopicSeries, sameCms } from '../../src/data/series';
import type { BlockModel, GroupModel, RowModel, SectionView } from '../../src/data/topics';
import { dayKey, emptyJournal, noteDeadlines, noteVisit } from '../../src/achievements/journal';
import { cleanDays, evaluate, weekdayRun, type Facts } from '../../src/achievements/rules';

const KIND: Record<string, RowModel['kind']> = { assign: 'assignment', quiz: 'quiz', page: 'reading', resource: 'material', url: 'tool', book: 'reading', questionnaire: 'survey', choicegroup: 'tool' };
let nextId = 1000;
const row = (name: string, modname: string): RowModel => {
  const id = nextId++;
  return {
    cm: { id, courseId: 1, sectionId: 1, sectionNumber: 1, name, modname, url: `/mod/${modname}/view.php?id=${id}`, uservisible: true, restricted: false, tracked: true } as RowModel['cm'],
    kind: KIND[modname] ?? 'material', format: 'PAGE', title: name, label: modname, typeName: modname, verb: 'open', locked: false, incomplete: true, provisional: false,
  } as RowModel;
};
const section = (id: number, title: string): Section => ({ id, number: 1, title, url: '', visible: true, current: false, restricted: false, hasSummary: false, cmIds: [] });
const group = (title: string, ...mods: string[]): BlockModel => ({ type: 'group', group: { section: section(nextId++, title), title, rows: mods.map((m) => row(`${title} ${m}`, m)), total: mods.length, done: 0 } as GroupModel });
const view = (...blocks: (BlockModel | RowModel)[]): SectionView => {
  const bs = blocks.map((b): BlockModel => ('cm' in b ? { type: 'row', row: b } : b));
  return { blocks: bs, rows: bs.flatMap((b) => (b.type === 'row' ? [b.row] : b.group.rows)) };
};

const DARK = { r: 15, g: 11, b: 31, a: 1 };

describe('round 8', () => {
  it('teacher colours read in the dark theme, keep the original, and never touch an editor', () => {
    document.body.innerHTML = `
      <div class="no-overflow">
        <p><span id="black" style="color:#000000">black</span> <span id="red" style="color: rgb(153, 0, 0)">dark red</span>
          <font id="font" color="navy">navy</font> <span id="ok" style="color:#e0e0ff">already light</span></p>
        <table><tr><td id="white" style="background-color:#ffffff">cell</td><td id="note" style="background:#fffbcc"><b id="inner" style="color:#333">note</b></td>
          <td id="mid" style="background:#3366cc"><span id="onmid" style="color:#000">designed pairing</span></td></tr></table>
        <span id="marker" style="background-color: yellow">marker</span>
      </div>
      <div class="no-overflow"><div contenteditable="true"><span id="edit" style="color:#000">draft</span></div></div>`;
    inkPage(document);
    const ink = (id: string): string | undefined => document.getElementById(id)?.style.getPropertyValue('--kex-ink') || undefined;
    const paint = (id: string): string | undefined => document.getElementById(id)?.style.getPropertyValue('--kex-paint') || undefined;
    // Neutral dark text becomes body text; coloured text keeps its hue and reaches 4.5:1; light text is left alone.
    expect(ink('black')).toBe('var(--kex-text-2)');
    for (const id of ['red', 'font']) {
      const c = resolved(ink(id) ?? '');
      expect(c && contrast(c, DARK)).toBeGreaterThanOrEqual(4.5);
    }
    const red = parseColor(ink('red'));
    expect(red && red.r > red.g && red.r > red.b).toBe(true);
    expect(ink('ok')).toBeUndefined();
    // White dissolves, pastel and highlighter turn into a dark tint; a dark-on-mid pairing the teacher chose stays as it is.
    expect(paint('white')).toBe('transparent');
    const TEXT = resolved('var(--kex-text-2)') ?? DARK;
    for (const id of ['note', 'marker']) expect(contrast(TEXT, resolved(paint(id) ?? '') ?? DARK)).toBeGreaterThanOrEqual(4.5);
    const marker = parseColor(paint('marker'));
    expect(marker && marker.r > marker.b && marker.g > marker.b).toBe(true);
    expect(paint('mid')).toBeUndefined();
    expect(ink('onmid')).toBeUndefined();
    expect(ink('inner')).toBe('var(--kex-text-2)');
    // The teacher's own value stays in place (the light theme shows it), and an editable region is never marked.
    expect(parseColor(document.getElementById('black')?.style.color)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(document.getElementById('edit')?.dataset.kexInk).toBeUndefined();
    expect(ink('edit')).toBeUndefined();
  });

  it('finds labs and numbered work from titles and activities, never "Theory, Practice", lectures or a lost activity', () => {
    // IAS0230 "Labs" (captured titles): three plain rows, then Lab 1 ... Lab 12 and Lab Final as subsections; work from Lab 3 on.
    const labTitles = ['Lab 1 - Simple I/O', 'Lab 2 - Functions in C', 'Lab 3 - Port initialization, Delay, LED control', 'Lab 4 - Loop sequence, subroutines',
      'Lab 5 - Breadboard circuit building', 'Lab 6 - µC Debugging', 'Lab 7 - Interrupts and buzzer', 'Lab 8 - FSM', 'Lab 9 - UART, OLED display', 'Lab 10 - DAC',
      'Lab 11 - ADC, slide potentiometer', 'Lab 12 - Low power mode', 'Lab Final - Game'];
    const labs = view(row('BESLabs', 'book'), row('Labs GitLab', 'url'), row('Lab day choice', 'choicegroup'),
      ...labTitles.map((t, i) => (i < 2 ? group(t, 'page') : group(t, 'page', 'questionnaire', 'assign'))));
    const ias = detectTopicSeries(labs, section(153220, 'Labs'));
    expect([ias?.shape, ias?.confidence, ias?.key, ias?.groups.length, ias?.groups.at(-1)?.title]).toEqual(['groups', 'high', 'lab', 13, 'Lab Final - Game']);
    // Four subsections that are not a series stay a list, work or not.
    expect(detectTopicSeries(view(group('Theory', 'page'), group('Practice', 'assign'), group('Homework', 'assign'), group('Extra', 'url')), section(1, 'Week'))).toBeNull();
    // ITB8833 "Home assignments" (captured): two numbered submissions, so the board is offered, not imposed.
    const home = view(row('1. National digitalisation strategy (latest submission: 13.09.2026)', 'assign'), row('2. Terms of use (due: 23.10.2026)', 'assign'));
    const itb = detectTopicSeries(home, section(156991, 'Home assignments'));
    expect([itb?.shape, itb?.confidence, itb?.groups.length]).toEqual(['rows', 'medium', 2]);
    // ITB8833 lectures: numbered reading stays a list.
    expect(detectTopicSeries(view(row('Lecture 1. E-country, concepts and basics', 'resource'), row('Lecture 2. Interoperability', 'resource'), row('Lecture 3. Infra', 'resource')), section(2, 'Topic'))).toBeNull();
    // Instructions and submission share a number: one card each; the unnumbered row stays a row; every activity exactly once.
    const mixed = view(row('Course rules', 'page'), ...[1, 2, 3].flatMap((n) => [row(`Lab ${n} instructions`, 'page'), row(`Lab ${n} submission`, 'assign')]));
    const m = detectTopicSeries(mixed, section(3, 'Practicals'));
    expect([m?.shape, m?.confidence, m?.groups.map((g) => g.rows.length), m?.groups[0]?.title]).toEqual(['rows', 'high', [2, 2, 2], 'Lab 1']);
    expect(m?.view.blocks.map((b) => b.type)).toEqual(['row', 'group', 'group', 'group']);
    expect(m && sameCms(mixed, m.view)).toBe(true);
    expect(m?.groups.every((g) => g.section.id < 0)).toBe(true);
    // Course level: numbered topics count only with work in them; a weeks-format course with work is a series by definition.
    const ias0230 = ['1. Introduction to Embedded Systems', '2. Input/Output', '3. Introduction to ARM Cortex-M Processors', '4. Timers', 'MIDTERM EXAM 21.10.2026'];
    expect(detectCourseSeries(ias0230.map((title, i) => ({ number: i + 3, title, work: false })))).toBeNull();
    expect(detectCourseSeries(['1. LEADING SELF', '2. LEADING TEAMS', '3. LEADING ORGANIZATIONS', 'Independent digital exam'].map((title, i) => ({ number: i + 1, title, work: true })))).toEqual([1, 2, 3]);
    expect(detectCourseSeries(['7 September - 13 September', '14 September - 20 September', '21 September - 27 September'].map((title, i) => ({ number: i + 1, title, work: true })))).toEqual([1, 2, 3]);
  });

  it('achievements: progress, labs, grades and KEX use earn; deadlines handed in early or at the last minute are noticed safely', () => {
    const H = 3600_000;
    const now = new Date('2026-10-26T10:00:00').getTime();
    const facts = (over: Partial<Facts> = {}): Facts => ({
      now, courses: [], states: [], labs: [], grades: [], pins: 0, journal: emptyJournal(), earned: new Set(), ...over,
    });
    expect(Object.values(evaluate(facts())).filter((s) => s.earned)).toHaveLength(0);
    const r = evaluate(facts({
      courses: [{ id: 1, progress: 100, opened: true }, { id: 2, progress: 55, opened: true }, { id: 3, progress: null, opened: false }],
      states: [{ courseId: 1, ticks: 4, clearedTopic: 2 }],
      labs: [{ courseId: 2, topic: 3, done: [true, true, true, false, true] }],
      grades: [{ courseId: 1, cmid: 9, pct: 100 }, { courseId: 1, cmid: 8, pct: 91 }],
      pins: 1,
    }));
    expect(r['first-tick'].earned && r['topic-cleared'].topic === 2 && r.halfway.earned && r.pinned.earned).toBe(true);
    expect(r['course-complete']).toMatchObject({ earned: true, tier: 1, progress: { n: 1, of: 3 } });
    expect(r['lab-done']).toMatchObject({ earned: true, tier: 1, progress: { n: 4, of: 5 } });
    expect(r['lab-streak'].earned && !r['every-lab'].earned && r['every-lab'].progress?.n === 4).toBe(true);
    expect(r['full-marks'].earned && !r['steady-hand'].earned && r['steady-hand'].progress?.n === 2).toBe(true);
    expect(r.explorer).toMatchObject({ earned: false, progress: { n: 2, of: 3 } });

    // Weekdays in a row: a weekend does not break the run (Thu, Fri, Mon, Tue, Wed).
    expect(weekdayRun(['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28'])).toBe(5);
    expect(weekdayRun(['2026-10-22', '2026-10-26'])).toBe(1);
    // Clean slate: the days since the last overdue day.
    expect(cleanDays({ '2026-10-01': 2, '2026-10-12': 0, '2026-10-20': 0, '2026-10-26': 0 }, now)).toEqual({ days: 15, records: 3 });
    // Night owl at 1:30; a new term after another is a fresh start; the very first visit is neither.
    let j = noteVisit(emptyJournal(), new Date('2026-10-26T01:30:00').getTime(), '2026-08-31');
    expect([!!j.nightAt, !!j.earlyAt, !!j.freshAt, j.days]).toEqual([true, false, false, ['2026-10-26']]);
    j = noteVisit(j, new Date('2027-02-02T09:00:00').getTime(), '2027-02-01');
    expect(!!j.freshAt).toBe(true);

    // Deadlines: seen open at 10:00, gone at 10:05 while due in three days, the course says done: handed in early.
    const due = (ms: number): number => Math.floor(ms / 1000);
    let d = noteDeadlines(emptyJournal(), [{ cmid: 5, courseId: 1, due: due(now + 72 * H), overdue: false }, { cmid: 6, courseId: 1, due: due(now + 0.75 * H), overdue: false }], now, () => undefined);
    d = noteDeadlines(d, [{ cmid: 6, courseId: 1, due: due(now + 0.75 * H), overdue: false }], now + 5 * 60_000, (cm) => (cm === 5 ? true : undefined));
    expect(d.handed).toEqual([{ cmid: 5, courseId: 1, due: due(now + 72 * H) * 1000, after: now, before: now + 5 * 60_000 }]);
    // Gone while the course says not done (hidden, moved): nothing. An older look than the last one: nothing.
    const notDone = noteDeadlines(d, [], now + 10 * 60_000, () => false);
    expect(notDone.handed).toHaveLength(1);
    expect(noteDeadlines(d, [], now, () => true).handed).toHaveLength(1);
    // The last-hour one, seen open 45 min before and gone 40 min before: a photo finish. A full list proves nothing.
    d = noteDeadlines(d, [], now + 10 * 60_000, () => true);
    const e = evaluate(facts({ journal: d }));
    expect([e['early-bird'].earned, e['photo-finish'].earned]).toEqual([true, true]);
    const full = Array.from({ length: 50 }, (_, i) => ({ cmid: 100 + i, courseId: 1, due: due(now + 90 * H), overdue: false }));
    expect(noteDeadlines({ ...emptyJournal(), watch: { 7: { courseId: 1, due: now + 80 * H, seen: now - 60_000 } } }, full, now, () => true).handed).toHaveLength(0);
    expect(dayKey(now)).toBe('2026-10-26');
  });
});
