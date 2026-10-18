import { afterEach, describe, expect, it } from 'vitest';
import { cache } from '../../src/data/cache';
import { ws } from '../../src/data/ws';
import { lang, moodleStrings, t } from '../../src/i18n';
import { MOODLE_KEYS, stringsCacheName, watchMoodleStrings } from '../../src/i18n/moodle';
import { en } from '../../src/i18n/en';
import { et } from '../../src/i18n/et';

const wire = (rows: Record<string, string>) =>
  async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { index: number; args: { strings: { stringid: string; component: string; lang?: string }[] } }[];
    return new Response(
      JSON.stringify(body.map((b) => ({ error: false, data: b.args.strings.map((s) => ({ stringid: s.stringid, component: s.component, lang: s.lang ?? 'et', string: rows[`${s.component}/${s.stringid}`] ?? `[[${s.stringid}]]` })) }))),
    );
  };

describe('Moodle strings', () => {
  afterEach(() => {
    cache.reset();
    moodleStrings.value = undefined;
    lang.value = 'en';
  });

  it('every mapped key exists in both of our tables (they stay the fallback)', () => {
    for (const k of Object.keys(MOODLE_KEYS)) {
      expect(k in en, k).toBe(true);
      expect(k in et, k).toBe(true);
    }
  });

  it('fetches once through core_get_strings, applies Moodle wording in t(), caches it', async () => {
    cache.bind('h', 1);
    ws.configure('http://h', 'sk');
    const posts: string[] = [];
    ws.setHttp(async (url, init) => {
      posts.push(String(JSON.parse(String(init?.body))[0].methodname));
      return wire({ 'moodle/myhome': 'Töölaud', 'moodle/mycourses': 'Minu kursused', 'moodle/courses': 'Kursused', 'moodle/calendar': '[[calendar]]' })(url, init);
    });
    lang.value = 'et';
    const stop = watchMoodleStrings(() => 'et');
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toEqual(['core_get_strings']);
    expect(t('nav.workspace')).toBe(et['nav.workspace']); // the Workspace is KEX's own name, not Moodle's Dashboard
    expect(t('nav.mycourses')).toBe('Minu kursused');
    expect(t('sidebar.courses')).toBe('KURSUSED'); // mono labels are upper-cased
    expect(t('nav.calendar')).toBe(et['nav.calendar']); // "[[id]]" is Moodle saying it has none: our table answers
    expect(t('toast.pinned')).toBe(et['toast.pinned']); // not mapped: ours
    expect(cache.peek(stringsCacheName('et'))).toBeDefined();
    stop();
  });

  it('a fresh cache means no request, and Moodle strings of another language never leak', async () => {
    cache.bind('h', 1);
    await cache.write(stringsCacheName('et'), { 'nav.mycourses': 'Minu kursused' });
    let calls = 0;
    ws.setHttp(async () => {
      calls++;
      return new Response('[]');
    });
    lang.value = 'et';
    const stop = watchMoodleStrings(() => 'et');
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(0);
    expect(t('nav.mycourses')).toBe('Minu kursused');
    stop();
    lang.value = 'en';
    expect(t('nav.mycourses')).toBe(en['nav.mycourses']);
  });

  it('asks for a language explicitly only when it is not the page language, and survives a failing service', async () => {
    cache.bind('h', 1);
    const seen: (string | undefined)[] = [];
    ws.setHttp(async (_u, init) => {
      const b = JSON.parse(String(init?.body))[0] as { args: { strings: { lang?: string }[] } };
      seen.push(b.args.strings[0]?.lang);
      return new Response(JSON.stringify([{ error: true, exception: { errorcode: 'invalidparameter', message: 'x' } }]));
    });
    lang.value = 'et';
    const stop = watchMoodleStrings(() => 'en');
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual(['et']);
    expect(t('nav.mycourses')).toBe(et['nav.mycourses']);
    stop();
  });
});
