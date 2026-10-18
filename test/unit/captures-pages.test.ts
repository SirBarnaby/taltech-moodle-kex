import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCfgFromText } from '../../src/content/pageinfo';
import { decorateParticipants } from '../../src/content/skindom';
import { scrapeGuest } from '../../src/content/skinguestmodel';
import { parseSkinPage } from '../../src/content/skinpage';
import { primaryIdp, scrapeLogin } from '../../src/data/scrape/login';
import { scrapeMyoverview } from '../../src/data/scrape/myoverview';
import { scrapeTtLinks, scrapeUser } from '../../src/data/scrape/user';
import { findLogoutHref, scrapeUserMenu } from '../../src/data/scrape/usermenu';
import { captureDoc, captureHtml } from '../fixtures/load';
import { expectCaptureReadable, pageInfoOf } from '../fixtures/page';

function page(html: string, lang = 'et'): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.documentElement.lang = lang;
  doc.body.innerHTML = html;
  return doc;
}

describe('page info (M.cfg and body) on the captures', () => {
  it('reads user, sesskey, wwwroot and body id from every capture, and each one resolves to a route (skin routes have a title for the band)', () => {
    for (const name of ['login_index', 'mod_forum_view__id-981476', 'my_', 'my_courses', 'user_index__id-37582'] as const) expectCaptureReadable(name);
  });

  it('course ids, formats, cm ids and language come from cfg and the body class', () => {
    const forum = pageInfoOf('mod_forum_view__id-981476');
    expect([forum.courseId, forum.cmId, forum.lang]).toEqual([37829, 981476, 'en']);
    const site = pageInfoOf('my_');
    expect([site.courseId, site.lang]).toEqual([1, 'et']);
  });

  it('reads the breadcrumb of an activity page', () => {
    const { breadcrumb } = pageInfoOf('mod_forum_view__id-981476');
    expect(breadcrumb.map((c) => c.text)).toEqual([
      'ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)',
      'Announcements',
    ]);
    expect(breadcrumb[0]?.href).toContain('/course/view.php?id=37829');
    expect(breadcrumb[1]?.href).toBeNull();
  });

  it('parseCfgFromText handles nested braces and braces inside strings', () => {
    expect(parseCfgFromText('var x=1; M.cfg = {"a":{"b":"}"},"sesskey":"abc","userId":5};var y=2;')).toEqual({ a: { b: '}' }, sesskey: 'abc', userId: 5 });
    expect(parseCfgFromText('nothing here')).toBeNull();
  });
});

describe('login page', () => {
  it('finds the four identity providers, keeps the username/password form behind "more options", reads languages and FAQ (TalTech capture)', () => {
    const m = scrapeLogin(captureDoc('login_index'));
    expect(m.idps).toHaveLength(4);
    expect(m.idps.every((i) => /^https?:/.test(i.href) && i.title.length > 0)).toBe(true);
    expect(m.form?.id).toBe('login');
    expect(m.formHidden).toBe(true);
    expect(m.langs.map((l) => l.code)).toContain('et');
    expect(m.langs.filter((l) => l.active)).toHaveLength(1);
    expect(m.faq).not.toBeNull();
  });

  it('shows the form directly on stock Moodle markup without providers, with the error and the forgot link', () => {
    const m = scrapeLogin(page(`<div class="loginerrors"><div class="alert alert-danger" id="loginerrormessage">Invalid login, please try again</div></div>
      <form id="login" action="/login/index.php" method="post"><input name="username"><input name="password" type="password"></form>
      <a href="/login/forgot_password.php">Forgotten</a>`));
    expect(m.idps).toHaveLength(0);
    expect(m.formHidden).toBe(false);
    expect(m.form).not.toBeNull();
    expect(m.error).toContain('Invalid login');
    expect(m.forgotHref).toContain('forgot_password.php');
  });

  it('prefers the last used provider, then Uni-ID, then the first', () => {
    const idps = [
      { href: 'https://a/smart', title: 'Smart-ID' },
      { href: 'https://a/oidc', title: 'Uni-ID' },
      { href: 'https://a/ee', title: 'ID-card' },
    ];
    expect(primaryIdp(idps, 'https://a/ee')).toBe(2);
    expect(primaryIdp(idps, undefined)).toBe(1);
    expect(primaryIdp([idps[0]!], undefined)).toBe(0);
    expect(primaryIdp(idps, 'https://gone')).toBe(1);
  });
});

describe('signed-out header', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));

  it('reads Moodle 4.5\'s login link, navigation without the hidden "More" toggle, the language menu with ?lang= URLs, and the home link', () => {
    const navbar = readFileSync(path.join(dir, '../fixtures/lab45-guest-navbar.html'), 'utf8');
    const model = scrapeGuest(page(navbar), 'http://localhost:8081');
    expect(model.login).toEqual({ text: 'Logi sisse', href: 'http://localhost:8081/login/index.php', active: false });
    expect(model.nav.map((n) => n.text)).toEqual(['Avaleht']);
    expect(model.nav[0]?.active).toBe(true);
    expect(model.langs.map((l) => [l.code, l.text, l.active, l.href])).toEqual([
      ['et', 'Eesti', true, ''],
      ['en', 'English', false, 'http://localhost:8081/?lang=en'],
    ]);
    expect(model.langLabel).toBe('Keel');
    expect(model.homeHref).toBe('http://localhost:8081/');
  });

  it('finds the login link of a Bootstrap 5 navbar and of the tt-level1 bar, and returns an empty model on a login layout without a navbar', () => {
    const m5 = scrapeGuest(page('<nav class="navbar fixed-top"><div class="usermenu"><span class="login"><a href="/login/index.php">Log in</a></span></div></nav>', 'en'), 'https://m.example');
    expect(m5.login?.text).toBe('Log in');
    const tt = scrapeGuest(page('<nav class="tt-level1"><a href="https://m.example/login/index.php">Logi sisse</a></nav>'), 'https://m.example');
    expect(tt.login?.href).toBe('https://m.example/login/index.php');
    const body = captureHtml('login_index').replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<script[\s\S]*?<\/script>/gi, '');
    const m = scrapeGuest(page(body), 'https://moodle.taltech.ee');
    expect(m.nav).toEqual([]);
    expect(m.homeHref).toBe('https://moodle.taltech.ee/');
  });
});

describe('user and dashboard scrapers', () => {
  it('user menu items in order with the logout link flagged, and the user\'s name and avatar', () => {
    const doc = captureDoc('my_');
    const items = scrapeUserMenu(doc);
    expect(items.length).toBeGreaterThan(4);
    expect(items[0]).toMatchObject({ label: 'Profiil', kind: 'link' });
    expect(items.some((i) => i.divider)).toBe(true);
    expect(items.filter((i) => i.kind === 'logout')).toHaveLength(1);
    expect(findLogoutHref(doc)).toContain('/login/logout.php');
    const u = scrapeUser(doc, 333286);
    expect([u?.fullname, u?.initials]).toEqual(['Marten Saluste', 'MS']);
    expect(u?.avatar).toContain('/user/icon/');
  });

  it('tt-level1 links give the real OIS and mail URLs; myoverview grouping is the is_archived customfield', () => {
    const l = scrapeTtLinks(captureDoc('my_'));
    expect([l.ois, l.mail]).toEqual(['https://ois2.ttu.ee', 'https://mail.ttu.ee']);
    expect(scrapeMyoverview(captureDoc('my_courses'))).toEqual({ grouping: 'customfield', customfieldname: 'is_archived', customfieldvalue: '-1' });
  });
});

describe('skin pages on the captures', () => {
  it('the forum page has a title and none of the activity-only parts', () => {
    const doc = captureDoc('mod_forum_view__id-981476');
    const sp = parseSkinPage(doc);
    expect(sp.title).toBe(doc.querySelector('.page-header-headings h1, #page-header h1')?.textContent?.trim());
    expect(sp.title.length).toBeGreaterThan(0);
    expect([sp.error, sp.file, sp.urlTarget]).toEqual([undefined, undefined, undefined]);
  });

  it('participants (Estonian): roles and groups columns are found by data-column and role text becomes pills once', () => {
    const doc = captureDoc('user_index__id-37582').cloneNode(true) as Document;
    decorateParticipants(doc);
    decorateParticipants(doc);
    expect(doc.querySelectorAll('#participants th.kex-col-roles')).toHaveLength(1);
    expect(doc.querySelectorAll('#participants th.kex-col-groups')).toHaveLength(1);
    expect(doc.querySelectorAll('#participants tbody td.kex-col-roles').length).toBeGreaterThan(5);
    expect(doc.querySelectorAll('#participants tbody td.kex-col-roles .kex-role').length).toBeGreaterThan(5);
    expect(doc.querySelectorAll('#participants .kex-role .kex-role')).toHaveLength(0);
  });
});
