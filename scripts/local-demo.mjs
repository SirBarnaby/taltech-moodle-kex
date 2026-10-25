// Replay the captured TalTech theme on this PC. No production cookies or Moodle writes.
// npm run build:local, then npm run demo. KEX_DEMO_DIST=firefox-dev selects the debug bundle.
import http from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { verifyProvenance } from './provenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.KEX_DEMO_PORT || 8099);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('KEX_DEMO_PORT must be an unprivileged TCP port');
const origin = `http://localhost:${port}`;
const variant = process.env.KEX_DEMO_DIST || 'firefox';
if (!/^firefox(?:-dev|-prod-lab|-mv3-probe|-dev-cssonly)?$/.test(variant)) throw new Error('Unknown replay build variant');
const dist = path.join(root, 'dist', variant);
const nativeExtension = process.env.KEX_DEMO_NATIVE_EXTENSION === '1';
const startedAt = new Date().toISOString();
const runId = process.env.KEX_DEMO_RUN_ID || `manual-${process.pid}`;
const build = JSON.parse(readFileSync(path.join(dist, 'build-info.json'), 'utf8'));
if (build.state === 'verified') await verifyProvenance(dist);
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const local = (s) => s.replaceAll('https://moodle.taltech.ee', origin);
function parse(name) {
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableIframePageLoading: true } });
  win.document.write(local(read(`captures/pages/${name}.html`)));
  return win.document;
}
const overview = parse('my_courses');
const courses = [...overview.querySelectorAll('[data-region="course-content"][data-course-id]')].map((e) => {
  const a = e.querySelector('a.coursename, a[href*="/course/view.php"]:not([tabindex="-1"])');
  const label = a?.cloneNode(true);
  label?.querySelectorAll('.sr-only, .accesshide, .visually-hidden, [data-region="favourite-icon"]').forEach((n) => n.remove());
  const name = label?.textContent.replace(/\s+/g, ' ').trim() || `Course ${e.dataset.courseId}`;
  const progress = /(\d+)\s*%/.exec(e.textContent);
  return { id: Number(e.dataset.courseId), fullname: name.replace(/^Kursuse nimi\s*/, ''), shortname: name, viewurl: `${origin}/course/view.php?id=${e.dataset.courseId}`, startdate: 1788123600, progress: progress ? Number(progress[1]) : null, hasprogress: !!progress, isfavourite: true, coursecategory: e.querySelector('.categoryname')?.textContent.trim() || '' };
});
const captures = new Map([['/my/', 'my_'], ['/my/index.php', 'my_'], ['/my/courses.php', 'my_courses'], ['/login/index.php', 'login_index']]);
const states = new Map();
for (const id of [37582, 37829, 38420]) {
  const name = `course_view__id-${id}`;
  const doc = parse(name);
  const sections = [...doc.querySelectorAll('.course-content [data-sectionid][data-section]')];
  const unique = [...new Map(sections.map((s) => [s.dataset.sectionid, s])).values()];
  const cm = [];
  const section = unique.map((s) => {
    const cmlist = [...s.querySelectorAll('[data-for="cmitem"], .activity[id^="module-"]')].filter((a) => a.closest('[data-sectionid][data-section]') === s).map((a) => {
      const cmid = Number(a.dataset.id || a.id.replace('module-', ''));
      const mod = /modtype_(\w+)/.exec(a.className)?.[1] || a.dataset.modname || 'label';
      const link = a.querySelector('.activityname a, .activityinstance a, a.aalink');
      const label = a.querySelector('.instancename, .activityname')?.cloneNode(true);
      label?.querySelectorAll('.sr-only, .accesshide').forEach((n) => n.remove());
      cm.push({ id: cmid, name: (label?.textContent || a.querySelector('.contentwithoutlink')?.textContent || 'Moodle').trim(), module: mod, sectionid: Number(s.dataset.sectionid), sectionnumber: Number(s.dataset.section), url: link?.href || `${origin}/mod/${mod}/view.php?id=${cmid}`, uservisible: true, completionstate: mod === 'label' ? undefined : 0 });
      return cmid;
    });
    return { id: Number(s.dataset.sectionid), number: Number(s.dataset.section), title: s.querySelector('.sectionname, .section-title, h3')?.textContent.trim() || `Topic ${s.dataset.section}`, hassummary: !!s.querySelector('.summary'), cmlist, uservisible: true };
  }).sort((a, b) => a.number - b.number);
  states.set(id, { doc, name, state: { course: { id, statekey: 'local-replay' }, section, cm } });
}
const dashboard = parse('my_');
const months = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli', 'august', 'september', 'oktoober', 'november', 'detsember'];
function capturedTime(label) {
  const date = /tähtaeg on (\d+)\. (\S+) (\d{4}), (\d+)\.(\d+)/.exec(label);
  if (!date) throw new Error('Captured deadline has no civil date');
  const utc = Date.UTC(Number(date[3]), months.indexOf(date[2]), Number(date[1]), Number(date[4]), Number(date[5]));
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Tallinn', timeZoneName: 'shortOffset' }).formatToParts(new Date(utc)).find((p) => p.type === 'timeZoneName').value;
  return utc / 1000 - Number(/GMT\+?(\d+)/.exec(offset)?.[1] || 0) * 3600;
}
// Replay captured deadlines, preserving their dates and wording.
const events = [...dashboard.querySelectorAll('[data-region="event-list-item"]')].map((e, i) => {
  const a = e.querySelector('a[href*="/mod/"]');
  const href = a?.href || '';
  const courseLink = e.querySelector('a[href*="/course/view.php"]');
  const id = Number(new URL(courseLink?.href || `${origin}/?id=37582`).searchParams.get('id'));
  const course = courseLink ? courses.find((c) => c.id === id) : courses.find((c) => c.shortname.includes(/\b[A-Z]{3}\d{4}\b/.exec(a?.getAttribute('aria-label') || '')?.[0] || 'not-a-course'));
  const timesort = capturedTime(a?.getAttribute('aria-label') || '');
  return { id: i + 1, activityname: a?.textContent.trim() || 'Deadline', modulename: /\/mod\/(\w+)/.exec(href)?.[1] || 'assign', timesort, overdue: timesort < Date.now() / 1000, url: href, course, action: { url: href, actionable: true } };
});
function api(method, args) {
  if (method === 'core_course_get_enrolled_courses_by_timeline_classification') return { courses: args.classification === 'past' || args.classification === 'future' || args.classification === 'hidden' ? [] : courses, nextoffset: 0 };
  if (method === 'core_courseformat_get_state') return JSON.stringify(states.get(Number(args.courseid))?.state || { course: { id: args.courseid }, section: [], cm: [] });
  if (method === 'core_course_get_module') {
    for (const { doc } of states.values()) { const cm = doc.getElementById(`module-${args.id}`); if (cm) return cm.outerHTML; }
    return '';
  }
  if (method === 'core_user_get_user_preferences') return { preferences: [] };
  if (method === 'core_user_get_users_by_field') return [{ id: 3, fullname: 'Local demo' }];
  if (method.startsWith('core_calendar_get_action_events')) return { events: args.courseid ? events.filter((e) => e.course.id === Number(args.courseid)) : events };
  if (method === 'core_course_get_recent_courses') return courses.map((c) => ({ ...c, lastaccess: Math.floor(Date.now() / 1000) - c.id }));
  if (method === 'core_course_get_recentlyaccesseditems') return [];
  if (method.includes('unread')) return 0;
  if (method === 'message_popup_get_popup_notifications') return { notifications: [], unreadcount: 0 };
  if (method === 'core_get_strings') return args.strings.map((s) => ({ ...s, string: `[[${s.stringid}]]` }));
  return [];
}
function page(name, plain = false) {
  const doc = parse(name);
  doc.querySelectorAll('script, link, base, iframe, object, embed').forEach((e) => e.remove());
  doc.querySelectorAll('*').forEach((e) => {
    for (const a of [...e.attributes]) if (/^on/i.test(a.name)) e.removeAttribute(a.name);
    // Captured authentication fields and links are never replayed as credentials.
    if (e.matches('input[name="sesskey"], input[name="logintoken"]')) e.setAttribute('value', 'local-demo');
    if (e.matches('a[href]')) e.setAttribute('href', e.getAttribute('href').replace(/([?&]sesskey=)[^&#]+/g, '$1local-demo'));
  });
  const id = Number(/id-(\d+)/.exec(name)?.[1] || 1);
  const guest = name === 'login_index';
  const cfg = `<script>window.M={cfg:${JSON.stringify({ wwwroot: origin, sesskey: guest ? '' : 'local-demo', userId: guest ? 0 : 3, courseId: id, language: 'et' })}};</script>`;
  const replay = plain || nativeExtension ? '' : '<script src="/__demo/shim.js"></script><script defer src="/__ext/content.js"></script><link rel="stylesheet" href="/__ext/kex.css">';
  return doc.documentElement.outerHTML.replace('<head>', `<head><meta charset="utf-8"><link rel="stylesheet" href="/__demo/theme.css">${cfg}${replay}`);
}
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/__demo/meta') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ schema: 1, pid: process.pid, runId, startedAt, origin, variant, nativeExtension, build }));
    return;
  }
  if (url.pathname === '/lib/ajax/service.php' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    try { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(JSON.parse(body).map((r) => ({ error: false, data: api(r.methodname, r.args) })))); } catch { res.writeHead(400).end(); }
    return;
  }
  if (url.pathname === '/__demo/shim.js') {
    if (nativeExtension) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'text/javascript');
    res.end(read('test/shim/browser-shim.js').replace("'https://kex.ext/'", "location.origin + '/__ext/'")); return;
  }
  if (url.pathname === '/__demo/theme.css') {
    res.setHeader('Content-Type', 'text/css'); res.end(readdirSync(path.join(root, 'captures/css')).filter((n) => n.endsWith('.css')).map((n) => read(`captures/css/${n}`)).join('\n')); return;
  }
  if (url.pathname.startsWith('/__ext/')) {
    if (nativeExtension) { res.writeHead(404).end(); return; }
    const file = path.resolve(dist, '.' + url.pathname.slice('/__ext'.length));
    if (!file.startsWith(dist + path.sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(readFileSync(file)); return;
  }
  const name = url.pathname === '/course/view.php' ? states.get(Number(url.searchParams.get('id')))?.name : captures.get(url.pathname);
  if (url.pathname === '/login/logout.php') { res.writeHead(302, { Location: '/login/index.php' }).end(); return; }
  if (!name) { res.writeHead(404).end('This route has no captured Moodle page.'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page(name, url.searchParams.get('kex') === 'off'));
});
server.listen(port, '127.0.0.1', () => console.log(`Local TalTech replay: ${origin}/my/courses.php (stock: /my/?kex=off)`));
