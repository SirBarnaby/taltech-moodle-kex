import { describe, expect, it } from 'vitest';
import { decorateBook, decorateCourseBoxes, decorateSkinPage } from '../../src/content/skindom';
import { parseCalendar, parseError, parseManual, parseSkinPage, shortDate } from '../../src/content/skinpage';
import { neighboursOf, placedLabel, readingOrder } from '../../src/data/neighbours';
import { normalizeState } from '../../src/data/repo/coursestate';

function html(body: string, bodyClass = ''): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.className = bodyClass;
  doc.body.innerHTML = body;
  return doc;
}

describe('shortDate', () => {
  it('shortens English long dates (12 h to 24 h) and Estonian dates (dotted day), and leaves anything else alone', () => {
    expect(shortDate('Due: Thursday, 10 September 2026, 5:38 PM')).toBe('Due Thu 10 Sep, 17:38');
    expect(shortDate('Opened: Monday, 31 August 2026, 12:05 AM')).toBe('Opened Mon 31 Aug, 00:05');
    expect(shortDate('Closes: Saturday, 14 November 2026, 12:09 PM')).toBe('Closes Sat 14 Nov, 12:09');
    expect(shortDate('Tähtaeg: neljapäev, 8. oktoober 2026, 17:38')).toBe('Tähtaeg nel 8 okt, 17:38');
    expect(shortDate('To do: Make a submission')).toBe('To do: Make a submission');
    expect(shortDate('Due: tomorrow')).toBe('Due: tomorrow');
  });
});

describe('parseSkinPage on lab-like markup (Moodle 5.3, Bootstrap 5)', () => {
  it('reads dates, manual completion and auto completion', () => {
    const doc = html(`
      <div class="page-header-headings"><div class="text-uppercase">Assignment</div><h1>Lab 6: Kubernetes</h1></div>
      <div data-region="activity-dates"><div><strong>Opened:</strong> Monday, 7 September 2026, 6:38 PM</div><div><strong>Due:</strong> Thursday, 24 September 2026, 5:38 PM</div></div>
      <div data-region="completion-info"><button data-action="toggle-manual-completion" data-toggletype="manual:mark-done" class="btn btn-outline-secondary">Mark as done</button></div>`);
    const sp = parseSkinPage(doc);
    expect(sp.title).toBe('Lab 6: Kubernetes');
    expect(sp.kicker).toBe('Assignment');
    expect(sp.dates).toEqual(['Opened: Monday, 7 September 2026, 6:38 PM'].map(shortDate).concat(['Due: Thursday, 24 September 2026, 5:38 PM'].map(shortDate)));
    expect(sp.manual).toEqual({ done: false });
    // Done is read from the toggle type.
    expect(parseManual(html('<button data-action="toggle-manual-completion" data-toggletype="manual:undo-mark-done" class="btn btn-success">Done</button>'))).toEqual({ done: true });
  });
  it('resource and url pages: the file and its details, embedded objects, the url target', () => {
    const sp = parseSkinPage(html('<div class="resourceworkaround">Click <a href="https://x.test/pluginfile.php/1/mod_resource/content/0/spec.docx">spec.docx</a> to open</div><div class="resourcedetails">DOCX · 613 bytes</div>'));
    expect(sp.fileUrl).toMatch(/spec\.docx$/);
    expect(sp.file).toEqual({ name: 'spec.docx', details: 'DOCX · 613 bytes', embedded: false });
    expect(parseSkinPage(html('<div class="resourcecontent"><object id="resourceobject" data="https://x.test/a.pdf"></object></div>')).file?.embedded).toBe(true);
    expect(parseSkinPage(html('<div class="urlworkaround">Click on <a href="https://en.wikipedia.org/wiki/Cloud">Reading</a> to open the resource.</div>')).urlTarget).toBe('https://en.wikipedia.org/wiki/Cloud');
  });
});

describe('errors', () => {
  it('reads the message and the code from the docs link, flags maintenance pages, and finds no error on ordinary pages', () => {
    const doc = html(`<div class="box errorbox alert alert-danger"><p class="errormessage">Can't find data record in database.</p><p class="errorcode"><a href="https://docs.moodle.org/405/en/error/moodle/invalidcoursemodule">More information about this error</a></p></div>`);
    expect(parseError(doc)).toEqual({ code: 'invalidcoursemodule', message: "Can't find data record in database." });
    expect(parseError(html('<p>Back soon</p>', 'pagelayout-maintenance'))?.code).toBe('MAINTENANCE');
    expect(parseError(html('<div class="alert alert-info">Note</div>'))).toBeUndefined();
  });
});

describe('calendar and course boxes', () => {
  it('reads the calendar heading and view switch (absent elsewhere); decorates a course box code once, keeps the highlight, leaves names without a code alone', () => {
    const doc = html(`<div class="maincalendar"><div data-region="view-selector"><ul>
        <li><a class="dropdown-item active" data-view="month">Month</a></li><li><a class="dropdown-item" data-view="day">Day</a></li><li><a class="dropdown-item" data-view="upcoming">Upcoming events</a></li></ul></div>
      <div class="calendarwrapper"><div class="calendar-controls"><h2 class="current">October 2026</h2></div></div></div>`);
    const cal = parseCalendar(doc);
    expect(cal?.heading).toBe('October 2026');
    expect(cal?.views.map((v) => v.view)).toEqual(['month', 'day', 'upcoming']);
    expect(cal?.views.find((v) => v.active)?.view).toBe('month');
    expect(parseCalendar(html('<div id="region-main"></div>'))).toBeUndefined();
    const box = html(`<div class="courses"><div class="coursebox"><h3 class="coursename"><a href="/course/view.php?id=2"><span class="highlight">Cloud</span> Architectures and DevOps (2026 autumn) (ITI8801)</a></h3></div></div>`);
    decorateCourseBoxes(box);
    decorateCourseBoxes(box);
    const a = box.querySelector('.coursename a');
    expect(a?.querySelectorAll('.kex-coursecode')).toHaveLength(1);
    expect(a?.querySelector('.kex-coursecode')?.textContent).toBe('ITI8801');
    expect(a?.querySelector('.kex-coursename')?.textContent?.trim()).toBe('Cloud Architectures and DevOps (2026 autumn)');
    expect(a?.querySelector('.highlight')?.textContent).toBe('Cloud');
    expect(a?.getAttribute('href')).toBe('/course/view.php?id=2');
    const plain = html(`<div class="coursebox"><h3 class="coursename"><a href="/x">Plain name</a></h3></div>`);
    decorateCourseBoxes(plain);
    expect(plain.querySelector('.kex-coursecode')).toBeNull();
  });
});

describe('decorations are idempotent and leave links alone', () => {
  it('wraps text-only status cells once and leaves links alone; the book TOC clone is added once', () => {
    const doc = html(`<div class="submissionstatustable"><table><tr><th>Submission status</th><td class="cell">No submissions have been made yet</td></tr>
      <tr><th>Grading status</th><td class="submissiongraded cell">Graded</td></tr>
      <tr><th>Time remaining</th><td class="overdue cell">Assignment is overdue by: 2 days</td></tr>
      <tr><th>Last modified</th><td class="cell"><a href="#">Friday</a></td></tr></table></div>`);
    decorateSkinPage(doc);
    decorateSkinPage(doc);
    const pills = Array.from(doc.querySelectorAll('.kex-pill')).map((e) => e.className.replace('kex-pill ', ''));
    expect(pills).toEqual(['kex-pill--grey', 'kex-pill--green', 'kex-pill--magenta']);
    expect(doc.querySelector('a')?.parentElement?.className).toBe('cell');
    const book = html('<div id="region-main"></div><section class="block_book_toc"><div class="book_toc"><ul><li><strong>1. A</strong></li><li><a href="#">2. B</a></li></ul></div></section>', 'path-mod-book');
    decorateBook(book);
    decorateBook(book);
    expect(book.querySelectorAll('.kex-booktoc')).toHaveLength(1);
    expect(book.querySelector('#region-main')?.classList.contains('kex-bookgrid')).toBe(true);
  });
});

describe('previous and next activity', () => {
  const state = normalizeState(
    2,
    {
      course: { id: 2, statekey: 'k' },
      section: [
        { id: 10, number: 0, title: 'General', cmlist: [1], visible: true, uservisible: true },
        { id: 11, number: 1, title: 'Intro', cmlist: [2, 3], visible: true, uservisible: true },
        { id: 12, number: 2, title: 'Labs', cmlist: [4], visible: true, uservisible: true },
      ],
      cm: [
        { id: 1, name: 'Announcements', modname: 'forum', url: 'https://m/mod/forum/view.php?id=1', sectionid: 10, uservisible: true },
        { id: 2, name: 'Welcome', modname: 'label', sectionid: 11, uservisible: true },
        { id: 3, name: 'Lecture 1', modname: 'resource', url: 'https://m/mod/resource/view.php?id=3', sectionid: 11, uservisible: true },
        { id: 4, name: 'Lab 1', modname: 'assign', url: 'https://m/mod/assign/view.php?id=4', sectionid: 12, uservisible: true },
      ],
    },
    1,
  );
  it('skips labels, orders section 0 first, finds neighbours and labels them with the topic number', () => {
    expect(readingOrder(state).map((p) => p.cm.id)).toEqual([1, 3, 4]);
    const n = neighboursOf(state, 3);
    expect(n?.prev?.cm.id).toBe(1);
    expect(n?.next?.cm.id).toBe(4);
    expect(placedLabel(n!.next!)).toBe('02 · Lab 1');
    expect(placedLabel(n!.prev!)).toBe('Announcements');
    expect(neighboursOf(state, 1)?.prev).toBeUndefined();
    expect(neighboursOf(state, 4)?.next).toBeUndefined();
    expect(neighboursOf(state, 999)).toBeUndefined();
  });
});
