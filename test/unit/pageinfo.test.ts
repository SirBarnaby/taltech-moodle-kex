import { describe, expect, it } from 'vitest';
import { parseCfgFromText, parsePageInfo } from '../../src/content/pageinfo';
import { CAPTURES, captureMeta, loadCapture } from '../fixtures/load';

describe('pageinfo parses M.cfg from all 8 captures', () => {
  it.each(CAPTURES)('%s', (name) => {
    const doc = loadCapture(name);
    const meta = captureMeta(name);
    const u = new URL(meta.url);
    const info = parsePageInfo({ doc, pathname: u.pathname, search: u.search });
    // The login capture is a guest page: Moodle reports userId 1 there.
    expect(info.userId).toBe(name === 'login_index' ? 1 : 333286);
    expect(info.sesskey).toBe('REDACTED');
    expect(info.wwwroot).toBe('https://moodle.taltech.ee');
    expect(info.isGuest).toBe(name === 'login_index');
    expect(info.bodyId.startsWith('page-')).toBe(true);
  });

  it('course ids, formats and cm ids come from cfg and the body class', () => {
    const tiles = parsePageInfo({ doc: loadCapture('course_view__id-37582'), pathname: '/course/view.php', search: '?id=37582' });
    expect(tiles.courseId).toBe(37582);
    expect(tiles.format).toBe('tiles');
    expect(tiles.pageLayout).toBe('course');
    const forum = parsePageInfo({ doc: loadCapture('mod_forum_view__id-981476'), pathname: '/mod/forum/view.php', search: '?id=981476' });
    expect(forum.courseId).toBe(37829);
    expect(forum.cmId).toBe(981476);
    expect(forum.lang).toBe('en');
    const site = parsePageInfo({ doc: loadCapture('my_'), pathname: '/my/', search: '' });
    expect(site.courseId).toBe(1);
    expect(site.lang).toBe('et');
  });

  it('reads the breadcrumb of an activity page', () => {
    const forum = parsePageInfo({ doc: loadCapture('mod_forum_view__id-981476'), pathname: '/mod/forum/view.php', search: '?id=981476' });
    expect(forum.breadcrumb.map((c) => c.text)).toEqual([
      'ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)',
      'Announcements',
    ]);
    expect(forum.breadcrumb[0]?.href).toContain('/course/view.php?id=37829');
    expect(forum.breadcrumb[1]?.href).toBeNull();
  });
});

describe('parseCfgFromText', () => {
  it('handles nested braces and braces inside strings', () => {
    const cfg = parseCfgFromText('var x=1; M.cfg = {"a":{"b":"}"},"sesskey":"abc","userId":5};var y=2;');
    expect(cfg).toEqual({ a: { b: '}' }, sesskey: 'abc', userId: 5 });
  });
  it('returns null when there is no cfg', () => {
    expect(parseCfgFromText('nothing here')).toBeNull();
  });
});
