import { effect } from '@preact/signals';
import { cache } from '../data/cache';
import { ws } from '../data/ws';
import { log } from '../lib/log';
import { lang, moodleStrings, type Lang, type MessageKey } from './index';

/**
 * Moodle's own wording for the labels Moodle already has (dashboard, calendar, grades, ...): read once per language through
 * `core_get_strings` (an AJAX web service that needs no special capability), cached for 7 days and used by `t()` in place of our tables.
 * Our en/et tables only keep what Moodle has no equivalent for.
 */

interface Src {
  component: string;
  id: string;
  /** Apply upper case (mono labels). */
  upper?: boolean;
}

const core = (id: string, upper = false): Src => ({ component: 'moodle', id, upper });
const mod = (component: string, id: string, upper = false): Src => ({ component, id, upper });

export const MOODLE_KEYS: Partial<Record<MessageKey, Src>> = {
  'nav.mycourses': core('mycourses'),
  'nav.calendar': core('calendar'),
  'nav.grades': core('grades'),
  'nav.notifications': mod('message', 'notifications'),
  'nav.messages': mod('message', 'messages'),
  'nav.profile': core('profile'),
  'nav.preferences': core('preferences'),
  'nav.files': core('privatefiles'),
  'nav.participants': core('participants'),
  'nav.search': core('search'),
  'header.search': core('search'),
  'nav.login': core('login'),
  'nav.logout': core('logout'),
  'nav.language': core('language'),
  'sidebar.courses': core('courses', true),
  'sidebar.settings': core('settings'),
  'action.logout': core('logout'),
  'usermenu.profile': core('profile'),
  'usermenu.logout': core('logout'),
  'crumb.home': core('home'),
  'crumb.mycourses': core('mycourses'),
  'help.go.mycourses': core('mycourses'),
  'help.go.calendar': core('calendar'),
  'help.go.grades': core('grades'),
  'help.go.notifications': mod('message', 'notifications'),
  'help.go.messages': mod('message', 'messages'),
  'ws.link.calendar': core('calendar'),
  'ws.link.grades': core('grades'),
  'ws.link.notifications': mod('message', 'notifications'),
  'ws.courses': core('courses', true),
  'ws.markAll': mod('message', 'markallread'),
  'nf.markAll': mod('message', 'markallread'),
  'mc.label': core('mycourses', true),
  'mc.title': core('mycourses'),
  'mc.tab.current': mod('block_myoverview', 'inprogress'),
  'mc.tab.starred': mod('block_myoverview', 'favourites'),
  'mc.tab.upcoming': mod('block_myoverview', 'future'),
  'mc.tab.past': mod('block_myoverview', 'past'),
  'mc.tab.hidden': mod('block_myoverview', 'hidden'),
  'mc.tab.all': mod('block_myoverview', 'all'),
  'gr.label': core('grades', true),
  'gr.title': core('grades'),
  'nf.label': mod('message', 'notifications', true),
  'nf.title': mod('message', 'notifications'),
  'chrome.back': core('back'),
  'chrome.continue': core('continue'),
  'label.assignment': mod('assign', 'modulename', true),
  'label.quiz': mod('quiz', 'modulename', true),
  'label.forum': mod('forum', 'modulename', true),
  'common.all': core('all'),
  'course.topicsMore': core('showmore'),
  'course.topicsLess': core('showless'),
  'course.expandAll': core('expandall'),
  'course.collapseAll': core('collapseall'),
  'row.markDone': mod('course', 'completion_manual:markdone'),
  'row.isDone': mod('course', 'completion_manual:done'),
  // The dashboard's greeting (Moodle 4.0+), shown in the page band after signing in.
  'handoff.welcome': core('welcomeback'),
};

const TTL = 7 * 24 * 60 * 60 * 1000;

interface WireString {
  stringid: string;
  component: string;
  /** The language Moodle answered in. */
  lang?: string;
  string: string;
}

/** The cache slot of a language (v2: sets from before every request named its language may hold another language's words). */
export const stringsCacheName = (l: Lang): string => `moodlestrings2:${l}`;

type Stored = Partial<Record<MessageKey, string>>;

async function fetchStrings(l: Lang): Promise<Stored> {
  const keys = Object.keys(MOODLE_KEYS) as MessageKey[];
  // Every string names its language: without it Moodle answers in the session's language, which is not always the one KEX shows
  // (another tab switched Moodle's language, or the page was read before Moodle's own language was known), and an Estonian word
  // ended up in English menus.
  const strings = keys.map((k) => {
    const s = MOODLE_KEYS[k] as Src;
    return { stringid: s.id, component: s.component, lang: l };
  });
  const res = await ws.call<WireString[]>('core_get_strings', { strings });
  const out: Stored = {};
  keys.forEach((k, i) => {
    const row = res[i];
    const src = MOODLE_KEYS[k] as Src;
    if (row?.lang && row.lang.split('_')[0] !== l) return;
    const v = row?.string?.trim();
    // Moodle echoes "[[id]]" for a string it does not have.
    if (v && !/^\[\[.*\]\]$/.test(v)) out[k] = src.upper ? v.toLocaleUpperCase(l) : v;
  });
  return out;
}

/**
 * Keep `moodleStrings` current for the language in use: cached strings apply at once, a stale or missing set is fetched in the background.
 * Returns the stop function. Needs a bound cache (a logged-in page).
 */
export function watchMoodleStrings(): () => void {
  let seq = 0;
  return effect(() => {
    const l = lang.value;
    const mine = ++seq;
    if (!cache.isReady) return;
    const name = stringsCacheName(l);
    const cached = cache.peek<Stored>(name);
    moodleStrings.value = cached ? { forLang: l, map: cached.data } : undefined;
    if (cached && Date.now() - cached.at < TTL) return;
    fetchStrings(l)
      .then(async (map) => {
        if (!Object.keys(map).length) return;
        await cache.write(name, map);
        if (mine === seq) moodleStrings.value = { forLang: l, map };
      })
      .catch((e: unknown) => log.debug('moodle strings unavailable', e));
  });
}
