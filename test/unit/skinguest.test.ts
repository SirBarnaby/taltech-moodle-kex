import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scrapeGuest } from '../../src/content/skinguestmodel';
import { captureHtml } from '../fixtures/load';

const dir = path.dirname(fileURLToPath(import.meta.url));

function page(html: string, lang = 'et'): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.documentElement.lang = lang;
  doc.body.innerHTML = html;
  return doc;
}

describe('scrapeGuest (the signed-out header)', () => {
  const navbar = readFileSync(path.join(dir, '../fixtures/lab45-guest-navbar.html'), 'utf8');
  const model = scrapeGuest(page(navbar), 'http://localhost:8081');

  it('reads Moodle 4.5\'s login link and keeps its wording', () => {
    expect(model.login).toEqual({ text: 'Logi sisse', href: 'http://localhost:8081/login/index.php', active: false });
  });
  it('reads the primary navigation without the hidden "More" toggle', () => {
    expect(model.nav.map((n) => n.text)).toEqual(['Avaleht']);
    expect(model.nav[0]?.active).toBe(true);
  });
  it('reads the language menu: the current language has no link, the others keep Moodle\'s ?lang= URL', () => {
    expect(model.langs.map((l) => [l.code, l.text, l.active, l.href])).toEqual([
      ['et', 'Eesti', true, ''],
      ['en', 'English', false, 'http://localhost:8081/?lang=en'],
    ]);
    expect(model.langLabel).toBe('Keel');
  });
  it('links the brand to the site home', () => {
    expect(model.homeHref).toBe('http://localhost:8081/');
  });
  it('finds the login link of a Bootstrap 5 / Moodle 5 navbar and of TalTech\'s tt-level1 bar', () => {
    const m5 = scrapeGuest(page('<nav class="navbar fixed-top"><div class="usermenu"><span class="login"><a href="/login/index.php">Log in</a></span></div></nav>', 'en'), 'https://m.example');
    expect(m5.login?.text).toBe('Log in');
    const tt = scrapeGuest(page('<nav class="tt-level1"><a href="https://m.example/login/index.php">Logi sisse</a></nav>'), 'https://m.example');
    expect(tt.login?.href).toBe('https://m.example/login/index.php');
  });
  it('returns an empty header model on a login-layout page without a navbar', () => {
    const doc = document.implementation.createHTMLDocument('t');
    doc.documentElement.lang = 'et';
    doc.body.innerHTML = captureHtml('login_index').replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<script[\s\S]*?<\/script>/gi, '');
    const m = scrapeGuest(doc, 'https://moodle.taltech.ee');
    expect(m.nav).toEqual([]);
    expect(m.homeHref).toBe('https://moodle.taltech.ee/');
  });
});
