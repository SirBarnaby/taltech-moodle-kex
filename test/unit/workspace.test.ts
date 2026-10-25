import { describe, expect, it } from 'vitest';
import { buildFeed, continueItems, nearestCourse, nextByCourse, weekSummary } from '../../src/data/feed';
import type { DueItem } from '../../src/data/model';
import { mapDueItems } from '../../src/data/repo/events';
import { kindOf, mapNotifs } from '../../src/data/repo/notifs';
import { mapRecent } from '../../src/data/repo/recent';
import { groupPins, movedTo, parsePinsJson, pinsToJson, rowPins } from '../../src/data/repo/pins';

import { matchesFilter, sortCourses } from '../../src/state/mycourses';
import { greeting, relTime, studyWeek } from '../../src/lib/time';
import { academicPeriod } from '../../src/lib/academic-calendar';

const NOW = 1_792_000_000;
const DAY = 86400;

const due = (eventId: number, daysFromNow: number, over: Partial<DueItem> = {}): DueItem => ({
  eventId, cmid: eventId, courseId: 2, courseCode: 'ITI8801', title: `T${eventId}`, modname: 'assign', due: NOW + daysFromNow * DAY, overdue: daysFromNow < 0, url: 'u', ...over,
});

describe('events', () => {
  it('maps calendar action events, decodes entities, drops the course image and unactionable urls', () => {
    const items = mapDueItems({
      events: [
        { id: 2, activityname: 'Lab &#38; Docker is due', modulename: 'assign', timesort: NOW + DAY, url: 'https://m/mod/assign/view.php?id=20', action: { name: 'Add submission', url: 'https://m/mod/assign/view.php?id=20&action=editsubmission', actionable: true }, course: { id: 2, shortname: 'ITI8801', fullname: 'Cloud (ITI8801)', courseimage: 'data:image/png;base64,AAAA' } as never },
        { id: 1, name: 'Quiz closes', modulename: 'quiz', timesort: NOW - DAY, overdue: true, url: 'https://m/mod/quiz/view.php?id=7', action: { name: 'Attempt', url: 'https://m/x', actionable: false }, course: { id: 2, shortname: 'ITI8801', fullname: 'Cloud' } },
      ],
    });
    expect(items.map((i) => i.eventId)).toEqual([1, 2]); // overdue first
    expect(items[1]?.title).toBe('Lab & Docker');
    expect(items[1]?.cmid).toBe(20);
    expect(items[0]?.actionUrl).toBeUndefined();
    expect(JSON.stringify(items)).not.toContain('data:image');
  });
});

describe('feed order', () => {
  const recent = mapRecent([
    { cmid: 5, courseid: 2, name: 'Slides', modname: 'resource', coursename: 'Cloud (ITI8801)', timeaccess: NOW - 60, viewurl: 'https://m/5' },
    { cmid: 6, courseid: 2, name: 'Forum', modname: 'forum', coursename: 'Cloud (ITI8801)', timeaccess: NOW - 30, viewurl: 'https://m/6' },
  ]);
  const notifs = mapNotifs([
    { id: 1, subject: 'Read one', timecreated: NOW - 100, read: true, component: 'mod_forum', smallmessage: 'Announcements', contexturl: 'u' },
    { id: 2, subject: 'Unread', timecreated: NOW - 50, read: false, component: 'moodle', eventtype: 'x', contexturl: 'u' },
  ]);
  const items = [due(1, 20), due(2, 10), due(3, 3), due(4, -2), due(5, 1)];

  it('everything: overdue, due within 7 days, continue, unread updates, due in 8 to 14 days', () => {
    const f = buildFeed('all', { due: items, recent, notifs, now: NOW });
    expect(f.map((x) => x.key)).toEqual(['d4', 'd5', 'd3', 'c5', 'n2', 'd2']);
  });
  it('deadlines are sorted overdue first, updates unread first, continue keeps content modules only; the week summary and next deadline per course', () => {
    expect(buildFeed('deadlines', { due: items, recent, notifs, now: NOW }).map((x) => x.key)).toEqual(['d4', 'd5', 'd3', 'd2', 'd1']);
    expect(buildFeed('updates', { due: items, recent, notifs, now: NOW }).map((x) => x.key)).toEqual(['n2', 'n1']);
    expect(continueItems(recent).map((r) => r.cmid)).toEqual([5]);
    // The week summary and the next deadline per course.
    expect(weekSummary(items, NOW)).toEqual({ overdue: 1, dueWeek: 2 });
    expect(nextByCourse(items).get(2)?.eventId).toBe(5);
    expect(nearestCourse(items)).toBe(2);
  });
});

describe('notifications', () => {
  it('classifies announcements and keeps plain text', () => {
    expect(kindOf({ component: 'mod_forum', smallmessage: 'Basics: Announcements' })).toBe('announcement');
    expect(kindOf({ component: 'mod_forum', smallmessage: 'Q&A forum' })).toBe('forum');
    expect(kindOf({ component: 'mod_assign' })).toBe('assign');
    const n = mapNotifs([{ id: 9, subject: 'A &amp; B', smallmessage: '<b>Hi</b> there', timecreated: 1, component: 'mod_forum', contexturl: 'x' }]);
    expect(n[0]?.subject).toBe('A & B');
    expect(n[0]?.small).toBe('Hi there');
  });
});

describe('pins', () => {
  const pin = (cmid: number, courseId = 2) => ({ cmid, courseId, courseCode: 'ITI8801', title: `P${cmid}`, modname: 'resource', kind: 'lecture' as const, format: 'PDF' as const, url: `https://m/mod/resource/view.php?id=${cmid}`, addedAt: 1 });
  it('moves a pin, shows the current course first in the row, and groups by course in order of first pin', () => {
    const { next, from } = movedTo([pin(1), pin(2), pin(3)], 1, 2);
    expect(next.map((p) => p.cmid)).toEqual([2, 3, 1]);
    expect(from).toBe(0);
    expect(movedTo([pin(1)], 1, 0).from).toBe(-1);
    expect(rowPins([pin(1, 9), pin(2, 2), pin(3, 9), pin(4, 2)], 2).map((p) => p.cmid)).toEqual([2, 4, 1]);
    const g = groupPins([pin(1, 5), pin(2, 2), pin(3, 5)], new Map([[5, 'Five'], [2, 'Two']]));
    expect(g.map((x) => [x.courseId, x.pins.length])).toEqual([[5, 2], [2, 1]]);
    expect(g[0]?.heading).toBe('ITI8801 / FIVE');
  });
  it('round-trips export and import and drops invalid entries, foreign hosts and duplicates', () => {
    const json = pinsToJson([pin(1), pin(2)]);
    expect(parsePinsJson(json, 'https://m').pins.map((p) => p.cmid)).toEqual([1, 2]);
    const bad = JSON.stringify({ pins: [pin(3), { cmid: 'x' }, { ...pin(4), url: 'https://evil.example/x' }, pin(3)] });
    const r = parsePinsJson(bad, 'https://m');
    expect(r.pins.map((p) => p.cmid)).toEqual([3]);
    expect(r.dropped).toBe(3);
    expect(() => parsePinsJson('not json')).toThrow();
  });
});

describe('my courses', () => {
  const c = (id: number, code: string, name: string, category?: string) => ({ id, code, name, fullname: name, alias: undefined, category }) as never;
  it('filters without diacritics and sorts by last access, name and code', () => {
    expect(matchesFilter(c(1, 'MMO5770', 'Õiguse alused'), 'oiguse')).toBe(true);
    expect(matchesFilter(c(1, 'MMO5770', 'Õiguse alused'), 'mmo 57')).toBe(true);
    expect(matchesFilter(c(1, 'MMO5770', 'Õiguse alused'), 'xyz')).toBe(false);
    expect(matchesFilter(c(1, 'A', 'B', 'Tarkvarateaduse instituut'), 'instituut')).toBe(true);
    const list = [c(1, 'B2', 'Beta'), c(2, 'A1', 'Gamma'), c(3, 'C3', 'Alpha')];
    expect(sortCourses(list, 'last', new Map([[2, 50], [1, 10]])).map((x) => x.id)).toEqual([2, 1, 3]);
    expect(sortCourses(list, 'name', new Map()).map((x) => x.id)).toEqual([3, 1, 2]);
    expect(sortCourses(list, 'code', new Map()).map((x) => x.id)).toEqual([2, 1, 3]);
  });
});

describe('time', () => {
  it('greets by hour, counts study weeks, and speaks in relative phrases', () => {
    expect([greeting(7), greeting(12), greeting(21)]).toEqual(['morning', 'afternoon', 'evening']);
    expect(studyWeek([NOW - 6 * 7 * DAY - 10, NOW + DAY, undefined], NOW)).toBe(7);
    expect(studyWeek([NOW + DAY], NOW)).toBe(7);
    expect(relTime(2 * DAY)).toBe('in 2 days');
    expect(relTime(-3 * 3600)).toBe('3 h ago');
  });
});

describe('TalTech academic calendar', () => {
  const sec = (date: string) => Date.parse(date.includes('T') ? date : `${date}T12:00:00+03:00`) / 1000;
  it('reports week 8 on 20 October regardless of an old or missing course start date', () => {
    expect(studyWeek([1_600_000_000], sec('2026-10-20'))).toBe(8);
    expect(studyWeek([], sec('2026-10-20'))).toBe(8);
  });
  it.each([
    ['2026-08-31', { kind: 'teaching', week: 1 }],
    ['2026-12-19', { kind: 'teaching', week: 16 }],
    ['2026-12-20', { kind: 'exams' }],
    ['2026-12-25', { kind: 'winter' }],
    ['2027-01-10', { kind: 'exams' }],
    ['2027-01-26', { kind: 'winter' }],
    ['2027-02-01', { kind: 'teaching', week: 1 }],
    ['2027-05-23', { kind: 'teaching', week: 16 }],
    ['2027-05-24', { kind: 'exams' }],
    ['2026-07-01', { kind: 'summer' }],
    ['2027-07-01', { kind: 'summer' }],
    ['2026-08-25', { kind: 'preweek' }],
    ['2029-10-01', { kind: 'unknown' }],
  ])('classifies %s without an unbounded teaching week', (date, expected) => {
    expect(academicPeriod(sec(date as string))).toEqual(expected);
  });
  it('changes weeks at Monday midnight in Tallinn, including DST', () => {
    expect(academicPeriod(sec('2026-10-18T20:59:00Z'))).toEqual({ kind: 'teaching', week: 7 });
    expect(academicPeriod(sec('2026-10-18T21:00:00Z'))).toEqual({ kind: 'teaching', week: 8 });
    expect(academicPeriod(sec('2026-10-25T22:00:00Z'))).toEqual({ kind: 'teaching', week: 9 });
  });
});
