import { describe, expect, it } from 'vitest';
import { primaryIdp, scrapeLogin } from '../../src/data/scrape/login';

import { loadCapture } from '../fixtures/load';

describe('scrapeLogin on the TalTech capture (Moodle 4.5)', () => {
  const m = scrapeLogin(loadCapture('login_index'));
  it('finds the four identity providers', () => {
    expect(m.idps).toHaveLength(4);
    expect(m.idps.every((i) => /^https?:/.test(i.href) && i.title.length > 0)).toBe(true);
  });
  it('keeps the username/password form behind "more options"', () => {
    expect(m.form?.id).toBe('login');
    expect(m.formHidden).toBe(true);
  });
  it('reads the languages and the FAQ', () => {
    expect(m.langs.map((l) => l.code).sort()).toEqual(expect.arrayContaining(['et']));
    expect(m.langs.filter((l) => l.active)).toHaveLength(1);
    expect(m.faq).not.toBeNull();
  });
});

describe('scrapeLogin on stock Moodle markup', () => {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.innerHTML = `<div class="loginerrors"><div class="alert alert-danger" id="loginerrormessage">Invalid login, please try again</div></div>
    <form id="login" action="/login/index.php" method="post"><input name="username"><input name="password" type="password"></form>
    <a href="/login/forgot_password.php">Forgotten</a>`;
  const m = scrapeLogin(doc);
  it('shows the form directly when there are no providers', () => {
    expect(m.idps).toHaveLength(0);
    expect(m.formHidden).toBe(false);
    expect(m.form).not.toBeNull();
    expect(m.error).toContain('Invalid login');
    expect(m.forgotHref).toContain('forgot_password.php');
  });
});

describe('primaryIdp', () => {
  const idps = [
    { href: 'https://a/smart', title: 'Smart-ID' },
    { href: 'https://a/oidc', title: 'Uni-ID' },
    { href: 'https://a/ee', title: 'ID-card' },
  ];
  it('prefers the last used provider, then Uni-ID, then the first', () => {
    expect(primaryIdp(idps, 'https://a/ee')).toBe(2);
    expect(primaryIdp(idps, undefined)).toBe(1);
    expect(primaryIdp([idps[0]!], undefined)).toBe(0);
    expect(primaryIdp(idps, 'https://gone')).toBe(1);
  });
});
