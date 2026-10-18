import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '../../src/data/cache';
import { courseGradesStore } from '../../src/data/repo/grades';
import { gradeStatFromText, scrapeCourseGrades, scrapeGradeOverview } from '../../src/data/scrape/grades';
import { ws } from '../../src/data/ws';
import { GradeMeter } from '../../src/ui/components/GradeMeter';

function html(body: string): Document {
  return new DOMParser().parseFromString(body, 'text/html');
}

const report = (rows: string): string => `<table class="user-grade"><thead><tr><th class="column-itemname">Grade item</th><th class="column-grade">Hinne</th><th class="column-range">Range</th><th class="column-percentage">Percentage</th></tr></thead><tbody>${rows}</tbody></table>`;
const activity = (id: number, grade: string, range = '', percentage = '', attrs = ''): string => `<tr ${attrs}><th class="column-itemname"><a href="/mod/assign/view.php?id=${id}">Lab ${id}</a></th><td class="column-grade">${grade}</td><td class="column-range">${range}</td><td class="column-percentage">${percentage}</td></tr>`;

describe('grade quantities from Moodle text', () => {
  it('retains zero, points, and decimal commas', () => {
    expect(gradeStatFromText('0.0/2.0')).toMatchObject({ grade: '0.0/2.0', earned: 0, maximum: 2, percentage: 0 });
    expect(gradeStatFromText('2,0 / 2,0')).toMatchObject({ earned: 2, maximum: 2, percentage: 100 });
    expect(gradeStatFromText('1,5', '0–2,0')).toMatchObject({ earned: 1.5, maximum: 2, percentage: 75 });
  });

  it('uses an explicit percentage without guessing a denominator', () => {
    expect(gradeStatFromText('81,25 %')).toMatchObject({ grade: '81,25 %', percentage: 81.25 });
    expect(gradeStatFromText('5')).toEqual({ grade: '5' });
    expect(gradeStatFromText('5', '', '80.00 %')).toMatchObject({ grade: '5', percentage: 80 });
  });

  it('keeps unavailable, scale, invalid and non-zero-minimum ranges as raw grades', () => {
    for (const grade of ['-', '–', 'Hidden', 'Pass', '2 of 5', 'NaN', 'Infinity']) {
      expect(gradeStatFromText(grade, '0–5')).toEqual({ grade });
    }
    expect(gradeStatFromText('4', '1–5')).toEqual({ grade: '4' });
    expect(gradeStatFromText('0/0')).toEqual({ grade: '0/0' });
    expect(gradeStatFromText('3/-2')).toEqual({ grade: '3/-2' });
  });
});

describe('Moodle user grade report', () => {
  it('maps activity links by cmid and recognises the course total only', () => {
    const result = scrapeCourseGrades(html(report(
      activity(27, '0.00', '0–2') + activity(28, '2,0 / 2,0') +
      '<tr class="categoryitem"><th class="column-itemname">Category total</th><td class="column-grade">12</td><td class="column-range">0–20</td></tr>' +
      '<tr><th class="column-itemname"><div class="courseitem">Course total</div></th><td class="column-grade">41,0</td><td class="column-range">0–50</td><td class="column-percentage">82,00 %</td></tr>',
    )));
    expect(result?.course).toMatchObject({ grade: '41,0', earned: 41, maximum: 50, percentage: 82, label: 'Hinne' });
    expect(result?.activities['27']).toMatchObject({ grade: '0.00', earned: 0, maximum: 2, percentage: 0 });
    expect(result?.activities['28']).toMatchObject({ earned: 2, maximum: 2, percentage: 100 });
    expect(Object.keys(result?.activities ?? {})).toEqual(['27', '28']);
  });

  it('ignores decorative hidden icons while reading the visible grade', () => {
    const result = scrapeCourseGrades(html(report(activity(27, '<span aria-hidden="true">✓</span>2,0', '0–2'))));
    expect(result?.activities['27']).toMatchObject({ grade: '2,0', earned: 2, maximum: 2, percentage: 100 });
  });

  it('ignores hidden percentage cells and accepts a visible percentage when the grade column is disabled', () => {
    const doc = html(report(
      '<tr><th class="column-itemname"><a href="/mod/quiz/view.php?id=29">Quiz</a></th><td class="column-grade">2</td><td class="column-percentage" hidden>5%</td></tr>' +
      '<tr><th class="column-itemname"><a href="/mod/quiz/view.php?id=30">Quiz</a></th><td class="column-percentage">70,5 %</td></tr>',
    ));
    expect(scrapeCourseGrades(doc)?.activities['29']?.percentage).toBeUndefined();
    expect(scrapeCourseGrades(doc)?.activities['30']?.percentage).toBe(70.5);
  });

  it('does not expose hidden grades or map unrelated links as activities', () => {
    const doc = html(report(
      activity(27, '2', '0–2', '100%', 'class="hiddenrow"') + activity(28, '<span class="gradehidden">2</span>', '0–2') +
      '<tr><th class="column-itemname"><a href="/user/view.php?id=3">Student</a></th><td class="column-grade">8</td><td class="column-range">0–10</td></tr>',
    ));
    expect(scrapeCourseGrades(doc)?.activities).toEqual({});
    expect(scrapeCourseGrades(html('<form id="login"></form>'))).toBeUndefined();
  });

  it('reads percentages already present in the overview without inventing them for a scale', () => {
    const result = scrapeGradeOverview(html('<table id="overview-grade"><tbody><tr><td><a href="/grade/report/user/index.php?id=7">Course</a></td><td>0,0/2,0</td></tr><tr><td><a href="/grade/report/user/index.php?id=8">Another</a></td><td>5</td></tr></tbody></table>'));
    expect(result[0]).toMatchObject({ courseId: 7, earned: 0, maximum: 2, percentage: 0 });
    expect(result[1]?.percentage).toBeUndefined();
  });
});

describe('cached course grade reports', () => {
  beforeEach(() => {
    cache.reset();
    cache.bind('moodle.taltech.ee', 3);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cache.reset();
  });

  it('shares a single request across rows and keeps the cached report', async () => {
    const fetcher = vi.spyOn(ws, 'fetchText').mockResolvedValue(report(activity(27, '2', '0–2')));
    const one = courseGradesStore(7);
    const two = courseGradesStore(7);
    expect(one).toBe(two);
    await Promise.all([one.refresh(), two.refresh()]);
    await one.refresh();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/grade/report/user/index.php?id=7');
    expect(one.value.value?.activities['27']?.percentage).toBe(100);
  });

  it('separates user scopes and preserves stale data when a login page is returned', async () => {
    const fetcher = vi.spyOn(ws, 'fetchText').mockResolvedValue(report(activity(27, '1', '0–2')));
    const old = courseGradesStore(8);
    await old.refresh();
    fetcher.mockResolvedValue('<form id="login"></form>');
    await old.refresh(true);
    expect(old.value.value?.activities['27']?.percentage).toBe(50);
    expect(old.status.value).toBe('error');
    cache.bind('moodle.taltech.ee', 4);
    expect(courseGradesStore(8)).not.toBe(old);
    expect(courseGradesStore(8).value.value).toBeUndefined();
  });

  it('limits report enrichment to two concurrent requests', async () => {
    let release!: (html: string) => void;
    const firstResponse = new Promise<string>((resolve) => (release = resolve));
    const fetcher = vi.spyOn(ws, 'fetchText').mockReturnValueOnce(firstResponse).mockReturnValueOnce(firstResponse).mockResolvedValue(report(''));
    const pending = [11, 12, 13].map((id) => courseGradesStore(id).refresh());
    expect(fetcher).toHaveBeenCalledTimes(2);
    release(report(''));
    await Promise.all(pending);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('does not persist a pending report after the signed-in account changes', async () => {
    let release!: (html: string) => void;
    vi.spyOn(ws, 'fetchText').mockReturnValue(new Promise<string>((resolve) => (release = resolve)));
    const old = courseGradesStore(14);
    const pending = old.refresh();
    cache.bind('moodle.taltech.ee', 4);
    release(report(activity(27, '2', '0–2')));
    await pending;
    expect(old.status.value).toBe('error');
    expect(cache.peek('grades:course:14')).toBeUndefined();
    expect(courseGradesStore(14).value.value).toBeUndefined();
  });
});

describe('GradeMeter semantics', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('shows points including zero, with an accessible bounded meter', () => {
    render(h(GradeMeter, { grade: gradeStatFromText('0.0/2.0'), label: 'Hinne' }), host);
    const meter = host.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-label')).toBe('Hinne');
    expect(meter?.getAttribute('aria-valuenow')).toBe('0');
    expect(meter?.getAttribute('aria-valuemin')).toBe('0');
    expect(meter?.getAttribute('aria-valuemax')).toBe('100');
    expect(meter?.getAttribute('aria-valuetext')).toContain('0.0/2.0');
    expect(host.textContent).toContain('0.0/2.0');
  });

  it('omits meters for a scale and bounds extra-credit fill without hiding the actual grade', () => {
    render(h(GradeMeter, { grade: gradeStatFromText('Pass'), label: 'Hinne' }), host);
    expect(host.querySelector('[role="meter"]')).toBeNull();
    render(h(GradeMeter, { grade: gradeStatFromText('12/10'), label: 'Hinne' }), host);
    expect(host.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(host.textContent).toContain('12/10');
    expect(host.textContent).toContain('120%');
  });
});
