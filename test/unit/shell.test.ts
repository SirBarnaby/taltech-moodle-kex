import { describe, expect, it, vi } from 'vitest';
import { adjustForLocation, buildSnapshot, paintSnapshot, removeSnapshot, SNAPSHOT_KEY } from '../../src/content/snapshot';
import { clickedLink, homeTarget, isPlainClick, PageLoader, prefetchSafe, routeOfDoc, softTarget } from '../../src/content/softnav';
import { scrapeLanguages } from '../../src/content/langs';
import { filterFeedByCourse, groupDeadlines, startsCourseGroup } from '../../src/lib/feedgroups';
import type { FeedItem } from '../../src/data/feed';
import type { DueItem } from '../../src/data/model';
import { contactsStore, mapContacts, teacherLine } from '../../src/lib/contacts';
import { ribbonsFor, SCHOOLS, schoolFor, schoolOf } from '../../src/lib/school';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/lib/settings';
import { langFromTag, resolveLang } from '../../src/i18n';
import { gridColumns } from '../../src/actions/wskeys';
import { KeyManager, keyLabel } from '../../src/lib/keys';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

const CTX = { origin: 'https://moodle.taltech.ee', wwwroot: 'https://moodle.taltech.ee', routeModes: {} };
const u = (p: string) => new URL(p, 'https://moodle.taltech.ee');

describe('language resolution', () => {
  it('defaults to following Moodle and reads et / en from <html lang>', () => {
    expect(DEFAULT_SETTINGS.uiLanguage).toBe('auto');
    expect(normalizeSettings({ uiLanguage: 'klingon' }).uiLanguage).toBe('auto');
    expect(normalizeSettings({ uiLanguage: 'et' }).uiLanguage).toBe('et');
    expect(resolveLang('auto', 'et')).toBe('et');
    expect(resolveLang('auto', 'et_EE')).toBe('et');
    expect(resolveLang('auto', 'en-GB')).toBe('en');
    expect(resolveLang('auto', '')).toBe('en');
    expect(resolveLang('en', 'et')).toBe('en');
    expect(resolveLang('et', 'en')).toBe('et');
    expect(langFromTag('ru')).toBe('en');
  });
});

describe('faculty themes', () => {
  it('maps the first letter of the course code to a school; the option turns it off', () => {
    expect(schoolOf('ITI8801')).toBe('it');
    expect(schoolOf('emt0140')).toBe('eng');
    expect(schoolOf('YKM0010')).toBe('sci');
    expect(schoolOf('TAF1234')).toBe('biz');
    expect(schoolOf('VMS0001')).toBe('sea');
    // M is Business and Governance; MED/MES/MET/MHK are old mechanical engineering codes.
    expect(schoolOf('MMO5770')).toBe('biz');
    expect(schoolOf('MET0010')).toBe('eng');
    expect(schoolOf('MEF0010')).toBe('biz');
    expect(schoolOf('LKK0010')).toBe('sci');
    expect(schoolOf('KMM0010')).toBe('eng');
    expect(schoolOf('HLX0010')).toBe('biz');
    expect(schoolOf('UTT0010')).toBe('gen');
    expect(schoolOf('XYZ1')).toBe('default');
    expect(schoolOf(undefined)).toBe('default');
    expect(schoolOf('')).toBe('default');
    expect(schoolFor('ITI8801', false)).toBe('default');
    expect(schoolFor('ITI8801', true)).toBe('it');
    expect(normalizeSettings({}).colourBySchool).toBe(true);
    // Each prefix nudges its school's ribbons a little, the same way every time; the default look is never nudged.
    const ias = ribbonsFor('IAS0230', true);
    expect(ribbonsFor('ias0231', true)).toBe(ias);
    const itb = ribbonsFor('ITB8833', true);
    expect(itb).not.toEqual(ias);
    for (const v of [ias, itb]) {
      v.shape.forEach((x, i) => expect(Math.abs(x / SCHOOLS.it.ribbons.shape[i]! - 1)).toBeLessThanOrEqual(0.25));
      // Still blue: the body's blue channel leads.
      expect(v.body[2]).toBeGreaterThan(Math.max(v.body[0], v.body[1]));
    }
    expect(ribbonsFor('ITI8801', false)).toBe(SCHOOLS.default.ribbons);
    expect(ribbonsFor('XYZ0001', true)).toBe(SCHOOLS.default.ribbons);
    const d = SCHOOLS.default.ribbons;
    expect([d.body, d.accent, d.hi, d.shape, d.sharp, d.seed]).toEqual([[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1, 1], 0, 0]);
  });
});

describe('soft navigation targets', () => {
  it('lands at My courses while preserving explicit dossier links and the original Moodle escape', () => {
    expect(homeTarget(u('/my/'), CTX.wwwroot).pathname).toBe('/my/courses.php');
    expect(homeTarget(u('/my/index.php?lang=et'), CTX.wwwroot).href).toContain('/my/courses.php?lang=et');
    for (const path of ['/my/?view=dossier', '/my/?course=5', '/my/#pinned', '/my/?kex=off']) expect(homeTarget(u(path), CTX.wwwroot).href).toBe(u(path).href);
  });
  it('opens app views in place; pages Moodle has to run itself (and course tabs it renders) stay normal loads', () => {
    expect(softTarget(u('/my/'), CTX)?.key).toBe('workspace');
    expect(softTarget(u('/my/?course=5'), CTX)?.key).toBe('workspace');
    expect(softTarget(u('/my/courses.php'), CTX)?.key).toBe('mycourses');
    expect(softTarget(u('/course/view.php?id=7'), CTX)).toMatchObject({ key: 'course', courseId: 7, needsDoc: true });
    expect(softTarget(u('/grade/report/overview/index.php'), CTX)).toMatchObject({ key: 'grades', needsDoc: true });
    expect(softTarget(u('/message/output/popup/notifications.php'), CTX)?.key).toBe('notifications');
    for (const p of [
      '/mod/assign/view.php?id=3', '/calendar/view.php?view=month', '/user/preferences.php', '/message/index.php', '/course/section.php?id=4',
      '/course/view.php?id=7&edit=on', '/course/view.php?id=7&section=2', '/course/view.php?name=abc', '/course/view.php', '/login/logout.php?sesskey=x',
      '/course/view.php?id=7&notifyeditingon=1', '/user/index.php?id=7', '/grade/report/user/index.php?id=7', '/competency/coursecompetencies.php?id=7',
    ]) expect(softTarget(u(p), CTX), p).toBeNull();
    expect(softTarget(new URL('https://example.org/my/'), CTX)).toBeNull();
  });
  it('honours a route the user switched to another mode, and a sub-directory install; the fetched page decides (editing mode is not an app view)', () => {
    expect(softTarget(u('/my/'), { ...CTX, routeModes: { workspace: 'off' } })).toBeNull();
    expect(softTarget(u('/my/'), { ...CTX, routeModes: { workspace: 'skin' } })).toBeNull();
    const sub = { origin: 'https://h', wwwroot: 'https://h/moodle', routeModes: {} };
    expect(softTarget(new URL('https://h/moodle/course/view.php?id=2'), sub)).toMatchObject({ key: 'course', courseId: 2 });
    const page = (cls: string) => new DOMParser().parseFromString(`<html><body id="page-course-view-weeks" class="${cls}"></body></html>`, 'text/html');
    expect(routeOfDoc(page('format-weeks'), '/course/view.php', {})).toMatchObject({ key: 'course', effective: 'app' });
    expect(routeOfDoc(page('editing format-weeks'), '/course/view.php', {})).toMatchObject({ key: 'editing', effective: 'off' });
  });
  it('takes over plain clicks on ordinary links only, and warms only pages whose reading records nothing', () => {
    const e = (o: object) => ({ button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...o });
    expect(isPlainClick(e({}))).toBe(true);
    expect(isPlainClick(e({ ctrlKey: true }))).toBe(false);
    expect(isPlainClick(e({ button: 1 }))).toBe(false);
    expect(isPlainClick(e({ defaultPrevented: true }))).toBe(false);
    document.body.innerHTML = '<a id="a" href="/my/"><span id="s">x</span></a><a id="b" href="/my/" target="_blank">b</a><a id="c" href="#x">c</a><a id="d" href="/f.pdf" download>d</a><a id="e" href="/my/" data-kex-hard>e</a><a id="f" href="mailto:a@b">f</a>';
    expect(clickedLink(document.getElementById('s'))?.id).toBe('a');
    for (const id of ['b', 'c', 'd', 'e', 'f']) expect(clickedLink(document.getElementById(id)), id).toBeNull();
    expect(prefetchSafe(u('/user/preferences.php'), CTX)).toBe(true);
    expect(prefetchSafe(u('/calendar/view.php?view=month'), CTX)).toBe(true);
    expect(prefetchSafe(u('/mod/resource/view.php?id=3'), CTX)).toBe(false);
    expect(prefetchSafe(u('/login/logout.php?sesskey=abc'), CTX)).toBe(false);
    expect(prefetchSafe(new URL('https://evil.example/my/'), CTX)).toBe(false);
  });
});

describe('PageLoader', () => {
  it('shares one request between a hover and the click, expires, and forgets failures', async () => {
    let now = 1000;
    const fetchText = vi.fn(async (url: string) => `<html><head><title>${url}</title></head><body id="page-x"></body></html>`);
    const loader = new PageLoader(fetchText, 20_000, () => now);
    const [a, b] = await Promise.all([loader.load(u('/course/view.php?id=2')), loader.load(u('/course/view.php?id=2#topic-3'))]);
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.title).toContain('/course/view.php?id=2');
    await loader.load(u('/course/view.php?id=3'));
    expect(fetchText).toHaveBeenCalledTimes(2);
    now += 25_000;
    await loader.load(u('/course/view.php?id=2'));
    expect(fetchText).toHaveBeenCalledTimes(3);
    const bad = new PageLoader(async () => {
      throw new Error('offline');
    });
    await expect(bad.load(u('/my/'))).rejects.toThrow('offline');
    await expect(bad.load(u('/my/'))).rejects.toThrow('offline');
  });
});

describe('shell snapshot', () => {
  const chrome = `
    <nav class="kex-sidebar" inert data-open="true"><ul class="kex-sb__nav">
      <li><a class="kex-sb__row" href="https://moodle.taltech.ee/my/" aria-current="page">Home</a></li>
      <li><a class="kex-sb__row" href="https://moodle.taltech.ee/my/courses.php">Courses</a></li></ul>
      <ul class="kex-sb__courses">
        <li><a class="kex-sb__course kex-sb__course--active" data-course-id="2" aria-current="page" href="https://moodle.taltech.ee/course/view.php?id=2&sesskey=SECRET">Cloud</a></li>
        <li><a class="kex-sb__course" data-course-id="3" href="https://moodle.taltech.ee/course/view.php?id=3">IoT</a></li></ul></nav>
    <header class="kex-header" data-compact="true"><nav class="kex-crumbs"><ol><li>old page</li></ol></nav><div class="kex-header__title"><span>old title</span></div><button>Search</button></header>
    <main class="kex-main">the view</main>`;
  it('keeps the sidebar and header, drops the view and the page-specific bits, never a sesskey', () => {
    const root = document.createElement('div');
    root.innerHTML = chrome;
    const html = buildSnapshot(root) ?? '';
    expect(html).toContain('kex-sidebar');
    expect(html).toContain('kex-header');
    expect(html).not.toContain('the view');
    expect(html).not.toContain('old page');
    expect(html).not.toContain('old title');
    expect(html).not.toMatch(/SECRET|sesskey/);
    expect(html).not.toContain('inert');
    expect(html).toContain('data-compact="false"');
    expect(buildSnapshot(document.createElement('div'))).toBeNull();
  });
  it('highlights the entry of the page being loaded, not of the stored one', () => {
    const host = document.createElement('div');
    host.innerHTML = chrome;
    adjustForLocation(host, { pathname: '/my/courses.php', search: '' });
    expect(host.querySelector('.kex-sb__nav a[aria-current="page"]')?.textContent).toBe('Courses');
    expect(host.querySelector('.kex-sb__course--active')).toBeNull();
    adjustForLocation(host, { pathname: '/course/view.php', search: '?id=3' });
    expect(host.querySelector('.kex-sb__course--active')?.textContent).toBe('IoT');
    expect(host.querySelector('.kex-sb__nav [aria-current]')).toBeNull();
  });
  it('paints under <html> from localStorage, inert and marked, and is removed again', () => {
    const root = document.createElement('div');
    root.innerHTML = chrome;
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 1, at: Date.now(), html: buildSnapshot(root) }));
    expect(paintSnapshot(document.documentElement, { pathname: '/my/', search: '' })).toBe(true);
    const el = document.querySelector('[data-kex-snapshot]') as HTMLElement;
    expect(el.id).toBe('kex-root');
    expect(el.hasAttribute('inert')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.kex-sidebar')).not.toBeNull();
    removeSnapshot();
    expect(document.querySelector('[data-kex-snapshot]')).toBeNull();
  });
  it('ignores a stale, broken or script-carrying snapshot', () => {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 1, at: Date.now() - 8 * 86400_000, html: '<nav class="kex-sidebar"></nav>' }));
    expect(paintSnapshot(document.documentElement, { pathname: '/my/', search: '' })).toBe(false);
    window.localStorage.setItem(SNAPSHOT_KEY, '{nope');
    expect(paintSnapshot(document.documentElement, { pathname: '/my/', search: '' })).toBe(false);
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 1, at: Date.now(), html: '<nav class="kex-sidebar"><script>alert(1)</script><img src=x onerror=alert(1)></nav>' }));
    expect(paintSnapshot(document.documentElement, { pathname: '/my/', search: '' })).toBe(true);
    expect(document.querySelector('[data-kex-snapshot] script')).toBeNull();
    expect(document.querySelector('[data-kex-snapshot] img')?.hasAttribute('onerror')).toBe(false);
    removeSnapshot();
    window.localStorage.removeItem(SNAPSHOT_KEY);
  });
});

describe('Moodle language menu', () => {
  const menu = `<div id="user-action-menu">
    <a class="dropdown-item" href="https://m/my/?lang=en" lang="en" aria-current="true">English ‎(en)‎</a>
    <a class="dropdown-item" href="https://m/my/?lang=et" lang="et">Eesti ‎(et)‎</a></div>`;
  it('reads labels, codes and links as Moodle writes them, falls back to <html lang> for the current one, and offers nothing with a single language', () => {
    const d = document.createElement('div');
    d.innerHTML = menu;
    const l = scrapeLanguages(d, 'et');
    expect(l.map((x) => [x.code, x.label, x.href])).toEqual([['en', 'English', 'https://m/my/?lang=en'], ['et', 'Eesti', 'https://m/my/?lang=et']]);
    expect(l.filter((x) => x.current).map((x) => x.code)).toEqual(['en']); // Moodle's own aria-current wins
    d.innerHTML = menu.replace(' aria-current="true"', '');
    expect(scrapeLanguages(d, 'et').find((x) => x.current)?.code).toBe('et');
    const one = document.createElement('div');
    one.innerHTML = '<a class="dropdown-item" href="https://m/my/?lang=en" lang="en">English</a>';
    expect(scrapeLanguages(one, 'en')).toEqual([]);
  });
});

describe('Workspace feed: course filter and grouping', () => {
  const dl = (eventId: number, courseId: number, due: number, over = false): FeedItem => ({
    type: 'deadline', key: `d${eventId}`,
    item: { eventId, courseId, courseCode: `C${courseId}`, title: `T${eventId}`, modname: 'assign', due, overdue: over, url: 'u' } as DueItem,
  });
  const cont = (cmid: number, courseId: number): FeedItem => ({ type: 'continue', key: `c${cmid}`, item: { cmid, courseId, courseCode: `C${courseId}`, courseName: '', title: 'x', modname: 'resource', url: 'u', accessedAt: 1 } });
  const upd = (id: number, code: string): FeedItem => ({
    type: 'update', key: `n${id}`,
    item: { id, subject: 's', small: '', html: '', contextUrl: '', contextName: '', component: '', eventtype: '', created: 1, read: false, kind: 'other', courseCode: code },
  });
  const items = [dl(1, 2, 10), dl(2, 3, 11), dl(3, 2, 12), cont(9, 3), dl(4, 3, 13), dl(5, 2, 14), upd(7, 'C2')];

  it('groups the deadlines of a course inside each run, marks where a course heading goes, and filters in place by course (updates match by course code)', () => {
    const g = groupDeadlines(items);
    expect(g.map((i) => i.key)).toEqual(['d1', 'd3', 'd2', 'c9', 'd4', 'd5', 'n7']);
    expect(g.map((_, i) => startsCourseGroup(g, i))).toEqual([true, false, true, false, true, true, false]);
    expect(filterFeedByCourse(items, 3, 'C3').map((i) => i.key)).toEqual(['d2', 'c9', 'd4']);
    expect(filterFeedByCourse(items, 2, 'C2').map((i) => i.key)).toEqual(['d1', 'd3', 'd5', 'n7']);
    expect(filterFeedByCourse(items, undefined, undefined)).toHaveLength(items.length);
  });
});

describe('course contacts', () => {
  it('maps Moodle contacts and shortens long lists', () => {
    const res = { courses: [{ id: 2, contacts: [{ id: 5, fullname: ' Kati Tamm ' }, { id: 6, fullname: 'Jaan Kask' }, { id: 7, fullname: 'Mari Mets' }, { id: 8, fullname: '' }] }] };
    const c = mapContacts(res, 2);
    expect(c.map((x) => x.fullname)).toEqual(['Kati Tamm', 'Jaan Kask', 'Mari Mets']);
    expect(teacherLine(c)).toBe('Kati Tamm, Jaan Kask +1');
    expect(teacherLine(c.slice(0, 2))).toBe('Kati Tamm, Jaan Kask');
    expect(mapContacts({ courses: [] }, 2)).toEqual([]);
    expect(mapContacts(undefined, 2)).toEqual([]);
    expect(typeof contactsStore).toBe('function');
  });
});

describe('keyboard', () => {
  it('KeyManager fires single keys, modifiers and chords; ignores typing targets except allowInInput', () => {
    const km = new KeyManager(window);
    const t = vi.fn(), k = vi.fn(), gw = vi.fn(), q = vi.fn();
    km.register([
      { keys: 't', scope: 'global', group: 'General', description: 'x', run: t },
      { keys: 'ctrl+k', scope: 'global', group: 'General', description: 'x', allowInInput: true, run: k },
      { keys: 'g w', scope: 'global', group: 'Navigate', description: 'x', run: gw },
      { keys: '?', scope: 'global', group: 'General', description: 'x', run: q },
    ]);
    km.attach();
    press('t');
    expect(t).toHaveBeenCalledTimes(1);
    press('t', { ctrlKey: true });
    expect(t).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.append(input);
    press('t', {}, input);
    expect(t).toHaveBeenCalledTimes(1);
    expect(press('k', { ctrlKey: true }, input).defaultPrevented).toBe(true);
    expect(k).toHaveBeenCalledTimes(1);
    press('g');
    press('w');
    expect(gw).toHaveBeenCalledTimes(1);
    press('?', { shiftKey: true });
    expect(q).toHaveBeenCalledTimes(1);
    km.detach();
  });
  it('a chord times out and an unrelated key resets it; labels spell the chord', () => {
    vi.useFakeTimers();
    const km = new KeyManager(window);
    const gw = vi.fn(), t = vi.fn();
    km.register([
      { keys: 'g w', scope: 'global', group: 'Navigate', description: 'x', run: gw },
      { keys: 't', scope: 'global', group: 'General', description: 'x', run: t },
    ]);
    km.attach();
    press('g');
    vi.advanceTimersByTime(1100);
    press('w');
    expect(gw).not.toHaveBeenCalled();
    press('g');
    press('t'); // resets the chord and fires t
    expect(t).toHaveBeenCalledTimes(1);
    km.detach();
    vi.useRealTimers();
    expect(keyLabel('ctrl+k')).toEqual(['Ctrl', 'K']);
    expect(keyLabel('g w')).toEqual(['G', 'then', 'W']);
  });
  it('the course grid steps by the number of cards that share the first row', () => {
    expect(gridColumns([])).toBe(1);
    expect(gridColumns([{ offsetTop: 0 }])).toBe(1);
    expect(gridColumns([{ offsetTop: 10 }, { offsetTop: 10 }, { offsetTop: 10 }, { offsetTop: 200 }])).toBe(3);
    expect(gridColumns([{ offsetTop: 0 }, { offsetTop: 0 }])).toBe(2);
    expect(gridColumns([{ offsetTop: 0 }, { offsetTop: 120 }])).toBe(1);
  });
});
