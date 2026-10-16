import { describe, expect, it } from 'vitest';
import { decorateCourseBoxes, decorateParticipants } from '../../src/content/skindom';
import { parseCalendar, parseSkinPage } from '../../src/content/skinpage';
import { resolveRoute } from '../../src/content/router';
import { scrapeGradeOverview } from '../../src/data/scrape/grades';
import { CAPTURES, captureMeta, loadCapture } from '../fixtures/load';

function html(body: string, bodyClass = ''): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.className = bodyClass;
  doc.body.innerHTML = body;
  return doc;
}

describe('scrapeGradeOverview', () => {
  const row = (id: number, text: string, grade: string): string =>
    `<tr><td class="cell c0"><a href="http://localhost:8080/course/user.php?mode=grade&amp;id=${id}&amp;user=3">${text}</a></td><td class="cell c1">${grade}</td></tr>`;
  const doc = html(
    `<table id="overview-grade" class="generaltable"><thead><tr><th>Course name</th><th>Grade</th></tr></thead><tbody>${row(7, 'Tarkade asjade võrgud (2026 sügis) (IEE2630)', '281.00')}${row(2, 'Cloud Architectures and DevOps (2026 autumn) (ITI8801)', '-')}
     <tr class="emptyrow"><td class="cell c0"></td><td class="cell c1"></td></tr></tbody></table>`,
  );
  const rows = scrapeGradeOverview(doc);
  it('reads course id, code, name and grade; skips the empty rows', () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ courseId: 7, code: 'IEE2630', name: 'Tarkade asjade võrgud (2026 sügis)', grade: '281.00', graded: true });
    expect(rows[1]).toMatchObject({ courseId: 2, code: 'ITI8801', grade: '-', graded: false });
  });
  it('keeps the link to the user report', () => {
    expect(rows[0]?.href).toContain('/course/user.php?mode=grade&id=7&user=3');
  });
  it('returns nothing without the table', () => {
    expect(scrapeGradeOverview(html('<p>nothing</p>'))).toEqual([]);
  });
});

describe('parseCalendar', () => {
  it('reads the heading and the view switch', () => {
    const doc = html(`<div class="maincalendar"><div data-region="view-selector"><ul>
        <li><a class="dropdown-item active" data-view="month">Month</a></li><li><a class="dropdown-item" data-view="day">Day</a></li><li><a class="dropdown-item" data-view="upcoming">Upcoming events</a></li></ul></div>
      <div class="calendarwrapper"><div class="calendar-controls"><h2 class="current">October 2026</h2></div></div></div>`);
    const cal = parseCalendar(doc);
    expect(cal?.heading).toBe('October 2026');
    expect(cal?.views.map((v) => v.view)).toEqual(['month', 'day', 'upcoming']);
    expect(cal?.views.find((v) => v.active)?.view).toBe('month');
  });
  it('is absent on other pages', () => {
    expect(parseCalendar(html('<div id="region-main"></div>'))).toBeUndefined();
  });
});

describe('decorateParticipants on the Estonian capture', () => {
  const doc = loadCapture('user_index__id-37582');
  decorateParticipants(doc);
  decorateParticipants(doc);
  it('marks the roles and groups columns by data-column, not by language', () => {
    expect(doc.querySelectorAll('#participants th.kex-col-roles')).toHaveLength(1);
    expect(doc.querySelectorAll('#participants th.kex-col-groups')).toHaveLength(1);
    const rolesCells = doc.querySelectorAll('#participants tbody td.kex-col-roles');
    expect(rolesCells.length).toBeGreaterThan(5);
  });
  it('turns role text into pills once (idempotent)', () => {
    const roles = doc.querySelectorAll('#participants tbody td.kex-col-roles .kex-role');
    expect(roles.length).toBeGreaterThan(5);
    const first = doc.querySelector('#participants tbody td.kex-col-roles');
    expect(first?.querySelectorAll('.kex-role').length).toBe(first?.querySelectorAll('.kex-role').length);
    expect(doc.querySelectorAll('#participants .kex-role .kex-role')).toHaveLength(0);
  });
});

describe('decorateCourseBoxes', () => {
  it('moves the trailing (CODE) in front as a mono code and keeps the highlight', () => {
    const doc = html(`<div class="courses"><div class="coursebox"><h3 class="coursename"><a href="/course/view.php?id=2"><span class="highlight">Cloud</span> Architectures and DevOps (2026 autumn) (ITI8801)</a></h3></div></div>`);
    decorateCourseBoxes(doc);
    decorateCourseBoxes(doc);
    const a = doc.querySelector('.coursename a');
    expect(a?.querySelectorAll('.kex-coursecode')).toHaveLength(1);
    expect(a?.querySelector('.kex-coursecode')?.textContent).toBe('ITI8801');
    expect(a?.querySelector('.kex-coursename')?.textContent?.trim()).toBe('Cloud Architectures and DevOps (2026 autumn)');
    expect(a?.querySelector('.highlight')?.textContent).toBe('Cloud');
    expect(a?.getAttribute('href')).toBe('/course/view.php?id=2');
  });
  it('leaves names without a code alone', () => {
    const doc = html(`<div class="coursebox"><h3 class="coursename"><a href="/x">Plain name</a></h3></div>`);
    decorateCourseBoxes(doc);
    expect(doc.querySelector('.kex-coursecode')).toBeNull();
  });
});

/** The selector report: every capture page resolves to a route and, for skin routes, yields a title the band can use. */
describe('selector report over the captures', () => {
  for (const name of CAPTURES) {
    it(`${name}: route and band data`, () => {
      const meta = captureMeta(name);
      const doc = loadCapture(name);
      const u = new URL(meta.url);
      const route = resolveRoute({ path: u.pathname, bodyId: doc.body.id, bodyClasses: Array.from(doc.body.classList) });
      expect(route.key).not.toBe('none');
      if (route.mode === 'skin') {
        const sp = parseSkinPage(doc);
        expect(sp.title.length, `${name} has a title for the band`).toBeGreaterThan(0);
      }
    });
  }
});
