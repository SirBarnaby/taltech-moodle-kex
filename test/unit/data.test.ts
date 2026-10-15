import { beforeEach, describe, expect, it } from 'vitest';
import { scrub, stripSesskey } from '../../src/data/cache';
import { applyAliases, currentSemester, groupingFromPrefs, mapCourse, orderCourses } from '../../src/data/repo/courses';
import { WsClient } from '../../src/data/ws';

describe('cache scrubbing', () => {
  it('removes sesskey query params and sensitive keys, drops data: URIs', () => {
    expect(stripSesskey('http://x/a?id=1&sesskey=abc123&x=2')).toBe('http://x/a?id=1&x=2');
    expect(stripSesskey('http://x/a?sesskey=abc123&x=2')).toBe('http://x/a?x=2');
    expect(stripSesskey('http://x/a?x=2&sesskey=abc123')).toBe('http://x/a?x=2');
    expect(stripSesskey('http://x/a?sesskey=abc123')).toBe('http://x/a');
    const out = scrub({ url: 'http://x/y?sesskey=ZZ', editurl: 'e', nested: [{ deleteurl: 'd', ok: 1 }], img: 'data:image/svg+xml;base64,AAAA', token: 't' });
    expect(out).toEqual({ url: 'http://x/y', nested: [{ ok: 1 }] });
    expect(JSON.stringify(out)).not.toMatch(/sesskey|editurl|deleteurl/);
  });
});

describe('courses repo helpers', () => {
  const raw = (id: number, short: string, full: string) => ({ id, shortname: short, fullname: full, idnumber: short });
  const courses = [
    mapCourse(raw(2, 'ITI8801', 'Cloud Architectures and DevOps (2026 autumn) (ITI8801)')),
    mapCourse(raw(3, 'EMT0140', 'Asjade internet tööstusele (2026 sügis) (EMT0140)')),
    mapCourse(raw(4, 'IAS0230', 'Basics of Embedded Systems (2026 autumn) (IAS0230)')),
  ];
  it('maps raw courses (url fallback, no data: images)', () => {
    const c = mapCourse({ ...raw(9, 'ABC1234', 'Name (ABC1234)'), courseimage: 'data:image/svg+xml;base64,AA' }, 'en', 'http://l:8080');
    expect(c.url).toBe('http://l:8080/course/view.php?id=9');
    expect(c.image).toBeUndefined();
  });
  it('orders by frozen order then code for new courses', () => {
    expect(orderCourses(courses, []).map((c) => c.code)).toEqual(['EMT0140', 'IAS0230', 'ITI8801']);
    expect(orderCourses(courses, [4, 2]).map((c) => c.code)).toEqual(['IAS0230', 'ITI8801', 'EMT0140']);
  });
  it('applies aliases', () => {
    const a = applyAliases(courses, { '2': 'Cloud & DevOps' });
    expect(a[0]?.alias).toBe('Cloud & DevOps');
    expect(a[1]?.alias).toBeUndefined();
  });
  it('semester label is the most common one', () => {
    expect(currentSemester(courses)).toEqual({ season: 'autumn', year: 2026 });
  });
  it('mirrors the myoverview grouping preference', () => {
    expect(groupingFromPrefs([])).toEqual({ grouping: 'all' });
    expect(groupingFromPrefs([{ name: 'block_myoverview_user_grouping_preference', value: 'inprogress' }])).toEqual({ grouping: 'inprogress' });
    expect(groupingFromPrefs([{ name: 'block_myoverview_user_grouping_preference', value: 'past' }])).toEqual({ grouping: 'inprogress' });
    expect(
      groupingFromPrefs([
        { name: 'block_myoverview_user_grouping_preference', value: 'customfield' },
        { name: 'block_myoverview_user_grouping_customfieldvalue_preference', value: '-1' },
      ]),
    ).toEqual({ grouping: 'customfield', value: '-1' });
  });
});

describe('ws client', () => {
  let ws: WsClient;
  let calls: { url: string; body: { methodname: string }[] }[];
  beforeEach(() => {
    ws = new WsClient();
    ws.configure('http://l:8080', 'SK');
    calls = [];
    ws.setHttp(async (url, init) => {
      const body = JSON.parse(String(init?.body)) as { index: number; methodname: string }[];
      calls.push({ url, body });
      return new Response(JSON.stringify(body.map((b) => (b.methodname === 'bad' ? { error: true, exception: { errorcode: 'nope', message: 'no' } } : { error: false, data: b.methodname }))));
    });
  });
  it('batches calls from the same macrotask into one POST and dedupes identical calls', async () => {
    const [a, b, c] = await Promise.all([ws.call('m1', { x: 1 }), ws.call('m2'), ws.call('m1', { x: 1 })]);
    expect([a, b, c]).toEqual(['m1', 'm2', 'm1']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toHaveLength(2);
    expect(calls[0]?.url).toContain('/lib/ajax/service.php?sesskey=SK&info=m1%2Cm2');
  });
  it('rejects only the failing call', async () => {
    const [ok, bad] = await Promise.allSettled([ws.call('good'), ws.call('bad')]);
    expect(ok.status).toBe('fulfilled');
    expect(bad.status).toBe('rejected');
  });
});
