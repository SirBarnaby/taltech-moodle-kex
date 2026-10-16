import { describe, expect, it } from 'vitest';
import { decorateBook, decorateSkinPage } from '../../src/content/skindom';
import { parseError, parseManual, parseSkinPage, shortDate } from '../../src/content/skinpage';
import { neighboursOf, placedLabel, readingOrder } from '../../src/data/neighbours';
import { normalizeState } from '../../src/data/repo/coursestate';
import { loadCapture } from '../fixtures/load';

function html(body: string, bodyClass = ''): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.className = bodyClass;
  doc.body.innerHTML = body;
  return doc;
}

describe('shortDate', () => {
  it('shortens English long dates and converts 12 h to 24 h', () => {
    expect(shortDate('Due: Thursday, 10 September 2026, 5:38 PM')).toBe('Due Thu 10 Sep, 17:38');
    expect(shortDate('Opened: Monday, 31 August 2026, 12:05 AM')).toBe('Opened Mon 31 Aug, 00:05');
    expect(shortDate('Closes: Saturday, 14 November 2026, 12:09 PM')).toBe('Closes Sat 14 Nov, 12:09');
  });
  it('shortens Estonian dates (24 h, dotted day)', () => {
    expect(shortDate('Tähtaeg: neljapäev, 8. oktoober 2026, 17:38')).toBe('Tähtaeg nel 8 okt, 17:38');
  });
  it('leaves anything else alone', () => {
    expect(shortDate('To do: Make a submission')).toBe('To do: Make a submission');
    expect(shortDate('Due: tomorrow')).toBe('Due: tomorrow');
  });
});

describe('parseSkinPage on the forum capture (Moodle 4.5, Bootstrap 4)', () => {
  const doc = loadCapture('mod_forum_view__id-981476');
  it('finds the title and the kicker', () => {
    const sp = parseSkinPage(doc);
    expect(sp.title.length).toBeGreaterThan(0);
    expect(sp.title).toBe(doc.querySelector('.page-header-headings h1, #page-header h1')?.textContent?.trim());
    expect(sp.error).toBeUndefined();
    expect(sp.file).toBeUndefined();
    expect(sp.urlTarget).toBeUndefined();
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
  });
  it('manual completion done is read from the toggle type', () => {
    const doc = html('<button data-action="toggle-manual-completion" data-toggletype="manual:undo-mark-done" class="btn btn-success">Done</button>');
    expect(parseManual(doc)).toEqual({ done: true });
  });
  it('a resource "click to open" page yields the file and its details', () => {
    const doc = html('<div class="resourceworkaround">Click <a href="https://x.test/pluginfile.php/1/mod_resource/content/0/spec.docx">spec.docx</a> to open</div><div class="resourcedetails">DOCX · 613 bytes</div>');
    const sp = parseSkinPage(doc);
    expect(sp.fileUrl).toMatch(/spec\.docx$/);
    expect(sp.file).toEqual({ name: 'spec.docx', details: 'DOCX · 613 bytes', embedded: false });
  });
  it('an embedded resource is marked embedded', () => {
    const doc = html('<div class="resourcecontent"><object id="resourceobject" data="https://x.test/a.pdf"></object></div>');
    expect(parseSkinPage(doc).file?.embedded).toBe(true);
  });
  it('the url page target', () => {
    const doc = html('<div class="urlworkaround">Click on <a href="https://en.wikipedia.org/wiki/Cloud">Reading</a> to open the resource.</div>');
    expect(parseSkinPage(doc).urlTarget).toBe('https://en.wikipedia.org/wiki/Cloud');
  });
});

describe('errors', () => {
  it('reads the message and the code from the docs link', () => {
    const doc = html(`<div class="box errorbox alert alert-danger"><p class="errormessage">Can't find data record in database.</p><p class="errorcode"><a href="https://docs.moodle.org/405/en/error/moodle/invalidcoursemodule">More information about this error</a></p></div>`);
    expect(parseError(doc)).toEqual({ code: 'invalidcoursemodule', message: "Can't find data record in database." });
  });
  it('maintenance pages', () => {
    expect(parseError(html('<p>Back soon</p>', 'pagelayout-maintenance'))?.code).toBe('MAINTENANCE');
  });
  it('ordinary pages have no error', () => {
    expect(parseError(html('<div class="alert alert-info">Note</div>'))).toBeUndefined();
  });
});

describe('decorations are idempotent and leave links alone', () => {
  it('wraps text-only status cells once', () => {
    const doc = html(`<div class="submissionstatustable"><table><tr><th>Submission status</th><td class="cell">No submissions have been made yet</td></tr>
      <tr><th>Grading status</th><td class="submissiongraded cell">Graded</td></tr>
      <tr><th>Time remaining</th><td class="overdue cell">Assignment is overdue by: 2 days</td></tr>
      <tr><th>Last modified</th><td class="cell"><a href="#">Friday</a></td></tr></table></div>`);
    decorateSkinPage(doc);
    decorateSkinPage(doc);
    const pills = Array.from(doc.querySelectorAll('.kex-pill')).map((e) => e.className.replace('kex-pill ', ''));
    expect(pills).toEqual(['kex-pill--grey', 'kex-pill--green', 'kex-pill--magenta']);
    expect(doc.querySelector('a')?.parentElement?.className).toBe('cell');
  });
  it('book: the TOC clone is added once', () => {
    const doc = html('<div id="region-main"></div><section class="block_book_toc"><div class="book_toc"><ul><li><strong>1. A</strong></li><li><a href="#">2. B</a></li></ul></div></section>', 'path-mod-book');
    decorateBook(doc);
    decorateBook(doc);
    expect(doc.querySelectorAll('.kex-booktoc')).toHaveLength(1);
    expect(doc.querySelector('#region-main')?.classList.contains('kex-bookgrid')).toBe(true);
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
  it('skips labels and orders section 0 first', () => {
    expect(readingOrder(state).map((p) => p.cm.id)).toEqual([1, 3, 4]);
  });
  it('finds neighbours and labels them with the topic number', () => {
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
