// Dark audit (round 8): stock Moodle pages in the dark theme, on the capture site with TalTech's real theme CSS. Flags
//   - light panels: an element whose own background is light (luminance > 0.35) and larger than a chip;
//   - dim text: a text run whose contrast against the background it sits on is under 3:1 (4.5:1 is listed separately).
// Pages: the captured forum and participants pages, plus a gallery of stock Moodle components (alerts, cards, tables, quiz,
// assignment, calendar, grader report, file picker, editor chrome, modal) injected into the forum page, so what the captures do
// not show is still checked against the real theme.
// Run: npm run build:dev && node test/bench/dark-audit.mjs [--shots dir] [--verbose]   (exit 1 when anything is flagged)
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, open } from '../harness/capsite.mjs';

const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const verbose = args.includes('--verbose');
if (shots) mkdirSync(shots, { recursive: true });

const GALLERY = `
<section id="kex-audit-gallery" class="mt-4">
  <div class="alert alert-info">Info alert with <a href="#">a link</a></div>
  <div class="alert alert-warning">Warning alert</div>
  <div class="alert alert-success">Success alert</div>
  <div class="alert alert-danger">Danger alert</div>
  <div class="card mb-3"><div class="card-header">Card header</div><div class="card-body"><h5 class="card-title">Card title</h5><p class="card-text text-muted">Muted card text</p></div><div class="card-footer">Footer</div></div>
  <div class="bg-light p-3 mb-2">bg-light panel</div><div class="bg-white border p-3 mb-2">bg-white panel</div><div class="bg-gray p-3 mb-2">bg-gray panel</div>
  <table class="generaltable table-striped"><thead><tr><th>Name</th><th>Grade</th></tr></thead><tbody><tr><td>Row one</td><td>5</td></tr><tr><td>Row two</td><td>4</td></tr><tr class="emptyrow"><td>Row three</td><td>3</td></tr></tbody></table>
  <table class="table table-hover table-bordered"><tbody><tr><td>Bootstrap table</td><td class="table-active">active</td><td class="table-success">success</td><td class="table-warning">warning</td></tr></tbody></table>
  <ul class="list-group mb-3"><li class="list-group-item">List item</li><li class="list-group-item active">Active item</li><li class="list-group-item list-group-item-action">Action item</li></ul>
  <ul class="nav nav-tabs mb-3"><li class="nav-item"><a class="nav-link active" href="#">Active tab</a></li><li class="nav-item"><a class="nav-link" href="#">Tab</a></li></ul>
  <div class="dropdown-menu show position-static mb-3"><a class="dropdown-item" href="#">Dropdown item</a><a class="dropdown-item active" href="#">Active item</a><div class="dropdown-divider"></div><span class="dropdown-item-text">Text item</span></div>
  <p><button class="btn btn-secondary">Secondary</button> <button class="btn btn-outline-secondary">Outline</button> <button class="btn btn-light">Light</button> <button class="btn btn-link">Link</button></p>
  <p><input class="form-control" value="Text field"> <select class="custom-select"><option>Select</option></select> <textarea class="form-control">Text area</textarea></p>
  <p><span class="badge badge-secondary">secondary</span> <span class="badge badge-light">light</span> <span class="badge badge-info">info</span> <span class="badge badge-pill badge-primary">primary</span></p>
  <ul class="pagination"><li class="page-item"><a class="page-link" href="#">1</a></li><li class="page-item active"><a class="page-link" href="#">2</a></li><li class="page-item disabled"><span class="page-link">3</span></li></ul>
  <div class="modal-dialog position-static"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Modal title</h5></div><div class="modal-body">Modal body</div><div class="modal-footer"><button class="btn btn-secondary">Cancel</button></div></div></div>
  <div class="popover bs-popover-bottom position-relative mb-3" style="display:block"><h3 class="popover-header">Popover header</h3><div class="popover-body">Popover body</div></div>
  <div id="page-mod-quiz-attempt-sim" class="path-mod-quiz">
    <div class="que multichoice deferredfeedback notyetanswered"><div class="info"><h3 class="no">Question <span class="qno">1</span></h3><div class="state">Not yet answered</div><div class="grade">Marked out of 1.00</div></div>
      <div class="content"><div class="formulation clearfix"><div class="qtext"><p>Which register holds the stack pointer?</p></div><div class="ablock"><div class="prompt">Select one:</div><div class="answer"><div class="r0"><input type="radio"><div class="d-flex"><span class="answernumber">a. </span><div class="flex-fill ml-1">R13</div></div></div><div class="r1"><input type="radio"><div class="d-flex"><span class="answernumber">b. </span><div class="flex-fill ml-1">R15</div></div></div></div></div></div>
      <div class="outcome clearfix"><div class="feedback"><div class="specificfeedback">Your answer is correct.</div><div class="rightanswer">The correct answer is: R13</div></div></div>
      <div class="comment clearfix">Teacher comment</div></div></div>
    <div id="mod_quiz_navblock" class="block"><div class="qn_buttons"><a class="qnbutton notyetanswered free btn thispage"><span class="thispageholder"></span><span class="trafficlight"></span>1</a><a class="qnbutton answersaved free btn">2</a><a class="qnbutton correct free btn">3</a></div></div>
  </div>
  <div class="submissionstatustable"><table class="generaltable"><tbody>
    <tr><th class="cell c0">Submission status</th><td class="submissionstatussubmitted cell c1">Submitted for grading</td></tr>
    <tr><th class="cell c0">Grading status</th><td class="submissiongraded cell c1">Graded</td></tr>
    <tr><th class="cell c0">Time remaining</th><td class="overdue cell c1">Assignment is overdue by: 2 days</td></tr>
    <tr><th class="cell c0">Last modified</th><td class="earlysubmission cell c1">Early</td></tr>
    <tr><th class="cell c0">Not graded</th><td class="submissionnotgraded cell c1">Not graded</td></tr>
  </tbody></table></div>
  <div class="calendarwrapper"><table class="calendarmonth calendartable mb-0"><thead><tr><th class="header text-xs-center">Mon</th><th class="header text-xs-center">Tue</th></tr></thead><tbody><tr>
    <td class="day text-sm-center text-md-left clickable"><div class="d-none d-md-block hidden-phone text-xs-center"><span class="day-number">1</span></div><div data-region="day-content"><ul><li data-region="event-item"><a class="text-truncate" href="#"><span class="badge badge-circle calendar_event_course">&nbsp;</span>Lab 3 due</a></li></ul></div></td>
    <td class="day text-sm-center text-md-left today clickable"><div class="d-none d-md-block hidden-phone text-xs-center"><span class="day-number today rounded-circle">2</span></div></td>
  </tr></tbody></table></div>
  <div class="gradereport-user"><table class="generaltable user-grade"><thead><tr><th class="header column-itemname">Grade item</th><th class="header column-grade">Grade</th></tr></thead><tbody>
    <tr><th class="level1 leveleven column-itemname b1b"><span class="d-flex"><span>IAS0230</span></span></th><td class="level1 leveleven column-grade"></td></tr>
    <tr><th class="level2 levelodd item column-itemname b1b"><a class="gradeitemheader" href="#">Lab 1</a></th><td class="level2 levelodd item column-grade">9.00</td></tr>
    <tr><th class="level2 leveleven baggt column-itemname b1b">Course total</th><td class="level2 leveleven baggt column-grade">9.00</td></tr>
  </tbody></table></div>
  <div class="filemanager fm-loaded"><div class="fp-navbar bg-faded card mb-0"><div class="filemanager-toolbar card-body"><div class="fp-toolbar"><div class="fp-btn-add"><a class="btn btn-secondary btn-sm" href="#">Add</a></div></div><div class="fp-path-folder"><a class="fp-path-folder-name">Files</a></div></div></div>
    <div class="filemanager-container card"><div class="fm-content-wrapper"><div class="fp-content"><div class="fp-iconview"><div class="fp-file fp-hascontextmenu"><a href="#"><div class="fp-thumbnail"></div></a><div class="fp-filename-field"><div class="fp-filename text-truncate">report.pdf</div></div></div></div></div><div class="fm-empty-container"><div class="dndupload-message">You can drag and drop files here to add them.</div></div></div></div></div>
  <div class="moodle-dialogue-base"><div class="moodle-dialogue-wrap moodle-dialogue-content yui3-widget-stdmod" style="position:relative"><div class="moodle-dialogue-hd yui3-widget-hd">File picker</div><div class="moodle-dialogue-bd yui3-widget-bd"><div class="filepicker"><div class="fp-repo-area"><div class="fp-repo nav-item"><a class="nav-link active" href="#">Upload a file</a></div></div><div class="fp-repo-items"><div class="fp-content"><div class="fp-upload-form"><label>Attachment</label></div></div></div></div></div></div></div>
  <div class="tox tox-tinymce" style="height:180px"><div class="tox-editor-container"><div class="tox-editor-header"><div class="tox-menubar"><button class="tox-mbtn tox-mbtn--select"><span class="tox-mbtn__select-label">Edit</span></button></div><div class="tox-toolbar-overlord"><div class="tox-toolbar__primary"><div class="tox-toolbar__group"><button class="tox-tbtn"><span class="tox-icon">B</span></button></div></div></div></div><div class="tox-sidebar-wrap"><div class="tox-edit-area"><div class="tox-edit-area__iframe" style="height:80px"></div></div></div><div class="tox-statusbar"><div class="tox-statusbar__text-container"><div class="tox-statusbar__path">p</div></div></div></div></div>
  <div class="box generalbox py-3"><div class="no-overflow"><p>Teacher text in a generalbox</p><table border="1"><tr><td style="background-color:#ffffff">white cell</td><td style="background:#fffbcc;color:#333">yellow note</td></tr></table><p><span style="color:#000000">black inline text</span> <span style="color:rgb(51,51,51)">dark grey text</span> <span style="background-color:#ffff00">marker</span></p></div></div>
  <div class="activity-header"><div class="activity-information"><div class="completion-info"><button class="btn btn-outline-secondary btn-sm">Mark as done</button><div class="badge rounded-pill bg-light text-dark">To do: View</div></div></div><div class="activity-description">Description</div></div>
  <div class="forumpost"><div class="header row">Post header</div><div class="row maincontent">Post body</div></div>
  <div class="tertiary-navigation"><div class="navitem"><select class="custom-select urlselect"><option>Navigation</option></select></div></div>
</section>`;

async function audit(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
    };
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const hex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const backdrop = (el) => {
      const stack = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; }
      }
      let base = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
      if (base.a < 1) base = over(base, { r: 255, g: 255, b: 255, a: 1 });
      for (const c of stack.reverse()) base = over(c, base);
      return base;
    };
    const name = (el) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => c && !c.startsWith('yui')).slice(0, 3).map((c) => `.${c}`).join('') : '';
      const host = el.closest('[id]:not(#kex-audit-gallery)');
      return `${el.tagName.toLowerCase()}${id}${cls}${host && host !== el ? ` in #${host.id}` : ''}`;
    };
    // Quiz navigation: an answered question takes the primary fill on purpose (light in dark, like every primary button).
    const skip = (el) => el.closest('#kex-root, .qn_buttons, svg, img, video, canvas, iframe, .btn-primary, input[type=checkbox], input[type=radio], .badge-circle');
    const panels = [];
    const texts = [];
    const scope = document.querySelector('#page') ?? document.body;
    for (const el of scope.querySelectorAll('*')) {
      if (skip(el) || !visible(el)) continue;
      const s = getComputedStyle(el);
      const bg = parse(s.backgroundColor);
      const r = el.getBoundingClientRect();
      if (bg && bg.a > 0.5 && r.width * r.height > 600) {
        const L = lum(over(bg, { r: 15, g: 11, b: 31, a: 1 }));
        if (L > 0.35) panels.push({ el: name(el), bg: hex(bg), size: `${Math.round(r.width)}x${Math.round(r.height)}` });
      }
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const fg = parse(s.color);
      if (!fg) continue;
      const under = backdrop(el);
      const c = ratio(over(fg, under), under);
      if (c < 4.5) texts.push({ el: name(el), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), fg: hex(fg), bg: hex(under), ratio: Math.round(c * 100) / 100 });
    }
    return { panels, low: texts.filter((t) => t.ratio < 3), soft: texts.filter((t) => t.ratio >= 3) };
  });
}

const browser = await launch();
const runs = [
  ['forum', {}],
  ['participants', {}],
  ['gallery', { page: 'forum', gallery: true }],
];
let flagged = 0;
for (const [label, o] of runs) {
  const page = await open(browser, o.page ?? label, { theme: 'dark', settings: { theme: 'dark', effects: 'off' }, wait: 2500 });
  const mode = await page.evaluate(() => [document.documentElement.dataset.kex, document.documentElement.dataset.kexTheme]);
  if (o.gallery) {
    await page.evaluate((html) => {
      const main = document.querySelector('#region-main [role="main"], #region-main, [role="main"]');
      main.insertAdjacentHTML('afterbegin', html);
    }, GALLERY);
    await page.waitForTimeout(300);
  }
  const res = await audit(page);
  if (shots) {
    if (o.gallery) await page.locator('#kex-audit-gallery').screenshot({ path: path.join(shots, `dark-${label}.png`) });
    else await page.screenshot({ path: path.join(shots, `dark-${label}.png`), fullPage: true });
  }
  flagged += res.panels.length + res.low.length;
  console.log(`\n== ${label} (data-kex=${mode[0]} theme=${mode[1]}): ${res.panels.length} light panels, ${res.low.length} text under 3:1, ${res.soft.length} text 3-4.5:1`);
  for (const p of res.panels) console.log(`  panel ${p.bg} ${p.size}  ${p.el}`);
  for (const t of res.low) console.log(`  text  ${t.ratio}:1 ${t.fg} on ${t.bg}  ${t.el}  "${t.text}"`);
  if (verbose) for (const t of res.soft) console.log(`  soft  ${t.ratio}:1 ${t.fg} on ${t.bg}  ${t.el}  "${t.text}"`);
  await page.context().close();
}
await browser.close();
process.exit(flagged ? 1 : 0);
