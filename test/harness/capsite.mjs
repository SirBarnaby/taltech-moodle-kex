// Capture site: the real moodle.taltech.ee pages from captures/ (real theme CSS, real markup) served to Chromium with the dev
// add-on injected, and Moodle's web services answered from the same captures. No lab, no docker, no network.
//
//   import { launch, open } from './capsite.mjs';
//   const browser = await launch();
//   const page = await open(browser, 'course-37829', { theme: 'dark' });
//
// CLI: node test/harness/capsite.mjs <page> [--theme dark|light] [--width 1600] [--height 1000] [--out shot.png] [--full]
// Needs `npm run build:dev` first. Pages: see PAGES below. State for a course is read from its capture: sections, subsections,
// tiles and activities. Courses the capture does not show (other sidebar entries) get a small invented state.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(root, 'dist/firefox-dev');
const CAP = path.join(root, 'captures');
const SHIM = path.join(root, 'test/shim/browser-shim.js');
const PW = process.env.KEX_PLAYWRIGHT ?? '/opt/node22/lib/node_modules/playwright/index.mjs';
export const HOST = 'moodle.taltech.ee';
export const USER_ID = 333286;
const WWW = `https://${HOST}`;

export const PAGES = {
  login: ['/login/index.php', 'login_index'],
  my: ['/my/', 'my_'],
  mycourses: ['/my/courses.php', 'my_courses'],
  'course-37582': ['/course/view.php?id=37582', 'course_view__id-37582'],
  'course-37829': ['/course/view.php?id=37829', 'course_view__id-37829'],
  'course-38420': ['/course/view.php?id=38420', 'course_view__id-38420'],
  forum: ['/mod/forum/view.php?id=981476', 'mod_forum_view__id-981476'],
  participants: ['/user/index.php?id=37582', 'user_index__id-37582'],
};

/** The user's real courses this autumn (ids from the captures where known). */
export const COURSES = [
  { id: 37582, fullname: 'IAS0230 Sardsüsteemide alused / Basics of Embedded Systems (2026 sügis/autumn)', shortname: 'IAS0230' },
  { id: 37829, fullname: 'ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)', shortname: 'ITB8833' },
  { id: 38420, fullname: 'MMO5770 Juhtimise alused / Leadership (2026 sügis/autumn)', shortname: 'MMO5770' },
  { id: 37001, fullname: 'EMT0140 Asjade internet / Internet of Things (2026 sügis/autumn)', shortname: 'EMT0140' },
  { id: 37002, fullname: 'ITI8801 Pilvearhitektuurid / Cloud Architectures & DevOps (2026 sügis/autumn)', shortname: 'ITI8801' },
  { id: 37003, fullname: 'IEE2630 Signaalitöötlus / Signal Processing (2026 sügis/autumn)', shortname: 'IEE2630' },
];

const MIME = { '.woff2': 'font/woff2', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const envelope = (data) => ({ v: 1, at: Date.now(), data });

export async function launch(opts = {}) {
  const { chromium } = await import(pathToFileURL(PW).href);
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...opts });
}

function stripScripts(html) {
  return html.replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '');
}

/** core_courseformat_get_state from a captured course page, read in a real DOM. */
async function stateFromCapture(browser, file, courseId) {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  await ctx.route('**/*', (r) => r.abort());
  const p = await ctx.newPage();
  const html = readFileSync(path.join(CAP, 'pages', `${file}.html`), 'utf8');
  await p.setContent(html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b/gi, '<x-img'));
  const state = await p.evaluate(({ courseId, www }) => {
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sections = new Map();
    const add = (id, number, title, el) => {
      if (!id) return;
      const cur = sections.get(id);
      if (cur) {
        cur.el ??= el;
        cur.title ||= title;
        return;
      }
      sections.set(id, { id, number, title, el, cmlist: [], parentsectionid: null, component: null, itemid: null });
    };
    for (const el of document.querySelectorAll('li[data-for="section"]')) add(Number(el.dataset.id), Number(el.dataset.number), el.dataset.sectionname || text(el.querySelector('h3')), el);
    // Tiles format: the tiles carry the titles; the open tile's section and section 0 carry data-section (number) and
    // data-sectionid (the real id), with the title in .sectiontitle (or none, for the empty placeholders).
    for (const el of document.querySelectorAll('li.tile[data-true-sectionid]')) add(Number(el.dataset.trueSectionid), Number(el.dataset.section), text(el.querySelector('h3')), null);
    for (const el of document.querySelectorAll('.course-section[data-sectionid][data-section]:not([data-for])')) add(Number(el.dataset.sectionid), Number(el.dataset.section), text(el.querySelector(':scope > h3, .sectiontitle h2')), el);
    const sectionOf = (el) => {
      for (let e = el.parentElement; e; e = e.parentElement) {
        if (e.matches('li[data-for="section"]')) return Number(e.dataset.id);
        if (e.matches('.course-section[data-sectionid][data-section]:not([data-for])')) return Number(e.dataset.sectionid);
      }
      return null;
    };
    const cm = [];
    for (const li of document.querySelectorAll('li[data-for="cmitem"]')) {
      const id = Number(li.dataset.id);
      const modname = li.dataset.modtype || /modtype_(\w+)/.exec(li.className)?.[1] || 'resource';
      const nameEl = li.querySelector('.instancename');
      const name = nameEl ? text(nameEl).replace(text(nameEl.querySelector('.accesshide')), '').trim() : li.dataset.title || text(li.querySelector('.activityname, .activity-name')) || `Item ${id}`;
      const url = li.querySelector('a.aalink, .activityname a, a[href*="/mod/"]')?.getAttribute('href') ?? `${www}/mod/${modname}/view.php?id=${id}`;
      const sectionid = sectionOf(li);
      const row = { id, name, modname, module: modname, url: modname === 'label' ? undefined : url, sectionid, uservisible: true, visible: true, istrackeduser: false, completionstate: 0 };
      const delegated = li.querySelector('li[data-for="section"]');
      if (modname === 'subsection' && delegated) {
        row.delegatesectionid = Number(delegated.dataset.id);
        row.hasdelegatedsection = true;
      }
      cm.push(row);
      if (sectionid && sections.has(sectionid)) sections.get(sectionid).cmlist.push(id);
    }
    for (const c of cm) {
      if (!c.delegatesectionid) continue;
      const s = sections.get(c.delegatesectionid);
      if (s) Object.assign(s, { parentsectionid: c.sectionid, component: 'mod_subsection', itemid: c.id });
    }
    // Delegated sections the capture shows without their subsection cm (tiles format renders them in place).
    for (const s of sections.values()) {
      if (s.parentsectionid || !s.el?.classList.contains('delegated-section')) continue;
      const parent = sectionOf(s.el);
      if (parent) s.parentsectionid = parent;
      s.component = 'mod_subsection';
    }
    const section = [...sections.values()].sort((a, b) => a.number - b.number).map(({ el: _el, ...s }) => ({
      ...s, title: s.title || `Section ${s.number}`, visible: true, uservisible: true, hassummary: false,
      sectionurl: `${www}/course/section.php?id=${s.id}`,
    }));
    return { course: { id: courseId, statekey: 'cap', highlighted: null }, section, cm };
  }, { courseId, www: WWW });
  await ctx.close();
  // Tiles: a delegated section without its subsection cm gets one, so the model nests it as Moodle 4.5 does.
  const ids = new Set(state.cm.map((c) => c.id));
  let fake = 9_000_000;
  for (const s of state.section) {
    if (s.component !== 'mod_subsection' || s.itemid || !s.parentsectionid) continue;
    while (ids.has(fake)) fake++;
    const cm = { id: fake, name: s.title, modname: 'subsection', module: 'subsection', url: s.sectionurl, sectionid: s.parentsectionid, uservisible: true, visible: true, delegatesectionid: s.id, hasdelegatedsection: true, completionstate: 0 };
    state.cm.push(cm);
    s.itemid = fake++;
    state.section.find((p) => p.id === s.parentsectionid)?.cmlist.push(cm.id);
  }
  return state;
}

/** A plain topics course for sidebar entries the captures do not cover. */
function inventedState(courseId, code) {
  const titles = ['Üldinfo', 'Week 1: Introduction', 'Week 2: Basics', 'Week 3: Practice', 'Week 4: Project'];
  const section = titles.map((title, n) => ({ id: courseId * 100 + n, number: n, title, cmlist: [], visible: true, uservisible: true, sectionurl: `${WWW}/course/section.php?id=${courseId * 100 + n}` }));
  const cm = [];
  section.forEach((s, n) => {
    for (const [i, modname] of ['resource', 'assign', 'url'].entries()) {
      const id = courseId * 1000 + n * 10 + i;
      cm.push({ id, name: `${code} ${s.title.split(':').pop().trim()} ${modname === 'assign' ? 'homework' : modname === 'url' ? 'link' : 'slides'}`, modname, module: modname, url: `${WWW}/mod/${modname}/view.php?id=${id}`, sectionid: s.id, uservisible: true, visible: true, completionstate: 0 });
      s.cmlist.push(id);
    }
  });
  return { course: { id: courseId, statekey: 'inv', highlighted: null }, section, cm };
}

/**
 * Open a capture page with the add-on.
 * opts: theme ('light'|'dark'), settings (merged into kex:settings), seed (extra storage keys), viewport, states ({courseId: rawState}),
 * wait (ms after load, default 2500), courses (raw course list).
 */
export async function open(browser, name, opts = {}) {
  const [route] = PAGES[name] ?? [];
  if (!route) throw new Error(`Unknown page ${name}; one of ${Object.keys(PAGES).join(', ')}`);
  if (!existsSync(path.join(DIST, 'content.js'))) throw new Error('Run npm run build:dev first');
  const viewport = opts.viewport ?? { width: 1600, height: 1000 };
  const ctx = opts.context ?? await browser.newContext({ viewport, reducedMotion: opts.reducedMotion ?? 'no-preference', colorScheme: opts.theme === 'dark' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const courses = opts.courses ?? COURSES;
  const states = new Map(Object.entries(opts.states ?? {}).map(([k, v]) => [Number(k), v]));
  const capturedCourse = Object.values(PAGES).filter(([, f]) => f.startsWith('course_view__id-')).map(([, f]) => [Number(f.split('-').pop()), f]);
  const stateFor = async (courseId) => {
    if (!states.has(courseId)) {
      const cap = capturedCourse.find(([id]) => id === courseId);
      const code = courses.find((c) => c.id === courseId)?.shortname ?? 'XXX0000';
      states.set(courseId, cap ? await stateFromCapture(browser, cap[1], courseId) : inventedState(courseId, code));
    }
    return states.get(courseId);
  };
  const calls = [];
  page.calls = calls;
  const answer = async (methodname, args) => {
    calls.push(methodname);
    switch (methodname) {
      case 'core_courseformat_get_state': return JSON.stringify(await stateFor(Number(args.courseid)));
      case 'core_course_get_enrolled_courses_by_timeline_classification':
        return { courses: courses.map((c) => ({ viewurl: `${WWW}/course/view.php?id=${c.id}`, progress: 0, hasprogress: true, isfavourite: false, hidden: false, startdate: 1788220800, enddate: 1798761600, coursecategory: '', ...c })), nextoffset: courses.length };
      case 'core_user_get_user_preferences': return { preferences: [], warnings: [] };
      case 'core_course_get_recent_courses': return courses.map((c) => ({ id: c.id, fullname: c.fullname, shortname: c.shortname, timeaccess: 1790000000 }));
      case 'message_popup_get_popup_notifications': return { notifications: [], unreadcount: 0 };
      case 'message_popup_get_unread_popup_notification_count':
      case 'core_message_get_unread_conversations_count': return 0;
      case 'core_calendar_get_action_events_by_timesort':
      case 'core_calendar_get_action_events_by_course': return { events: [], firstid: 0, lastid: 0 };
      case 'block_recentlyaccesseditems_get_recent_items': return [];
      // Moodle's echo for a string it does not have: the add-on falls back to its own tables.
      case 'core_get_strings': return (args.strings ?? []).map((s) => ({ stringid: s.stringid, component: s.component, string: `[[${s.stringid}]]` }));
      case 'core_user_get_users_by_field': return [{ id: USER_ID, fullname: 'Barnaby Test', profileimageurl: '' }];
      default: return opts.ws?.[methodname]?.(args) ?? null;
    }
  };
  await page.route('https://kex.ext/**', async (r) => {
    const rel = new URL(r.request().url()).pathname.slice(1);
    try {
      await r.fulfill({ status: 200, body: readFileSync(path.join(DIST, rel)), headers: { 'content-type': MIME[path.extname(rel)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' } });
    } catch { await r.fulfill({ status: 404, body: '' }); }
  });
  await page.route(`${WWW}/**`, async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/lib/ajax/service.php') {
      const batch = JSON.parse(r.request().postData() ?? '[]');
      const out = [];
      for (const { methodname, args } of batch) out.push({ error: false, data: await answer(methodname, args ?? {}) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    }
    if (u.pathname.includes('/theme/styles.php/')) return r.fulfill({ status: 200, contentType: 'text/css', body: readFileSync(path.join(CAP, 'css/theme_styles_php_taltech4_boost_1791885836_1788332547_all.css')) });
    if (u.pathname.includes('yui_combo.php')) {
      const f = path.join(CAP, 'css/theme_yui_combo__rollup/3.18.1/yui-moodlesimple-min.css-.css');
      return r.fulfill({ status: 200, contentType: 'text/css', body: existsSync(f) ? readFileSync(f) : '' });
    }
    const hit = Object.values(PAGES).find(([p]) => { const t = new URL(WWW + p); return t.pathname === u.pathname && (!t.search || t.searchParams.get('id') === u.searchParams.get('id')); });
    if (hit && r.request().resourceType() !== 'image') return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: stripScripts(readFileSync(path.join(CAP, 'pages', `${hit[1]}.html`), 'utf8')) });
    if (r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#9a8fb8"/></svg>' });
    return r.fulfill({ status: 404, contentType: 'text/html', body: '<!doctype html><title>Not captured</title><p>Not captured</p>' });
  });
  const seed = {
    'kex:settings': { enabled: true, theme: opts.theme ?? 'light', ...(opts.settings ?? {}) },
    ...Object.fromEntries(Object.entries(opts.seed ?? {}).map(([k, v]) => [k.replace('{user}', `${HOST}:${USER_ID}`), v?.v === 1 ? v : envelope(v)])),
  };
  await page.addInitScript(`window.__KEX_SEED__ = ${JSON.stringify(seed)};`);
  await page.addInitScript({ path: SHIM });
  const css = readFileSync(path.join(DIST, 'kex.css'), 'utf8').replace(/url\(["']?(fonts|assets)\//g, 'url(https://kex.ext/$1/');
  await page.addInitScript(`(() => { if (window.top !== window) return; const s=document.createElement('style'); s.id='kex-test-css'; s.textContent=${JSON.stringify(css)}; const a=()=>{const h=document.documentElement; if(!h) return false; h.insertBefore(s,h.firstChild); return true;}; if(!a()){const mo=new MutationObserver(()=>a()&&mo.disconnect()); mo.observe(document,{childList:true});} })();`);
  await page.addInitScript({ path: path.join(DIST, 'content.js') });
  if (opts.goto !== false) {
    await page.goto(WWW + route, { waitUntil: 'load' });
    await page.waitForTimeout(opts.wait ?? 2500);
  }
  return page;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
  const name = args[0] ?? 'course-37829';
  const browser = await launch();
  const page = await open(browser, name, { theme: flag('theme', 'light'), viewport: { width: Number(flag('width', 1600)), height: Number(flag('height', 1000)) } });
  const out = flag('out', `${name}.png`);
  await page.screenshot({ path: out, fullPage: args.includes('--full') });
  console.log(JSON.stringify({ out, kex: await page.evaluate(() => ({ ...document.documentElement.dataset })), calls: [...new Set(page.calls)] }));
  await browser.close();
}
