import { describe, expect, it } from 'vitest';
import { buildRows, buildTopics, deadlineTopic, dueTextFromDates, incompleteTopic, initialTopic, isDateRange, pad2, parseTopicHash, primaryIndex, resourceCount, subtitleForRows } from '../../src/data/topics';
import { cmsOfSection, normalizeState, topicSections } from '../../src/data/repo/coursestate';
import { previewFromHtml, downloadUrl, domainOf } from '../../src/data/repo/preview';
import { buildSlideUp, splitGraphemes, splitWords, staggerDelay } from '../../src/fx/slideup';
import type { CmEvent } from '../../src/data/repo/courseevents';

const raw = {
  course: { id: 2, statekey: 'k', highlighted: 'Current week' },
  section: [
    { id: 10, number: 0, title: 'General', cmlist: ['33'], visible: true },
    { id: 11, number: 1, title: 'What is cloud?', cmlist: ['1', '2'], visible: true },
    { id: 16, number: 6, title: 'Kubernetes', rawtitle: 'Kubernetes', cmlist: ['21', '153', '22', '300'], visible: true, current: true },
    { id: 17, number: 7, title: 'Containers &amp; Docker', cmlist: [], visible: true },
    { id: 18, number: 8, title: '12 October - 18 October', cmlist: ['5'], visible: true },
    { id: 19, number: 9, title: 'Hidden', cmlist: [], visible: false },
    { id: 90, number: 10, title: 'Sub', cmlist: ['301'], visible: true, component: 'mod_subsection', itemid: 300 },
  ],
  cm: [
    { id: 33, name: 'Announcements', module: 'forum', sectionid: 10, sectionnumber: 0, uservisible: true },
    { id: 1, name: 'Lecture 1 slides', module: 'resource', sectionid: 11, sectionnumber: 1, uservisible: true, completionstate: 0, istrackeduser: true },
    { id: 2, name: 'Q&amp;A', module: 'forum', sectionid: 11, sectionnumber: 1, uservisible: true },
    { id: 21, name: 'Kubernetes — lecture slides', module: 'resource', sectionid: 16, sectionnumber: 6, uservisible: true, completionstate: 0 },
    { id: 153, name: 'Practice 6: Deploy a service', module: 'resource', sectionid: 16, sectionnumber: 6, uservisible: true, completionstate: 1 },
    { id: 22, name: 'Week 6: Lecture recording', module: 'url', sectionid: 16, sectionnumber: 6, uservisible: true },
    { id: 300, name: 'Subsection', module: 'subsection', sectionid: 16, sectionnumber: 6, uservisible: true },
    { id: 301, name: 'Extra', module: 'resource', sectionid: 90, sectionnumber: 10, uservisible: true },
    { id: 5, name: 'Hidden for me', module: 'resource', sectionid: 18, sectionnumber: 8, uservisible: false },
  ],
};

const state = normalizeState(2, raw as never, 1_700_000_000_000);

describe('normalizeState', () => {
  it('decodes escaped titles, keeps rawtitle, flags subsections and tracking', () => {
    expect(state.sections.find((s) => s.number === 7)?.title).toBe('Containers & Docker');
    expect(state.cms.find((c) => c.id === 2)?.name).toBe('Q&A');
    expect(state.cms.find((c) => c.id === 21)).toMatchObject({ tracked: true, completion: 0, modname: 'resource' });
    expect(state.cms.find((c) => c.id === 22)?.tracked).toBe(false);
    expect(state.sections.find((s) => s.number === 10)).toMatchObject({ component: 'mod_subsection', itemid: 300 });
  });
  it('topics lead with section 0 (it holds an activity), then visible sections; hidden and delegated ones are out', () => {
    expect(topicSections(state).map((s) => s.number)).toEqual([0, 1, 6, 7, 8]);
  });
  it('a subsection cm expands into its own cms, flagged with the group; invisible cms drop out', () => {
    const six = state.sections.find((s) => s.number === 6)!;
    const cms = cmsOfSection(state, six);
    expect(cms.map((c) => c.id)).toEqual([21, 153, 22, 301]);
    expect(cms.at(-1)?.group).toBe('Sub');
    expect(cmsOfSection(state, state.sections.find((s) => s.number === 8)!)).toEqual([]);
  });
});

describe('topic model', () => {
  const fmt = (ts: number): string => `ts${ts}`;
  const six = state.sections.find((s) => s.number === 6)!;
  const rows = buildRows(state, six, new Map(), new Map(), fmt);
  it('classifies rows, splits "Practice 6: …" and builds the mono label', () => {
    const byId = Object.fromEntries(rows.map((r) => [r.cm.id, r]));
    expect(byId[21]).toMatchObject({ kind: 'lecture', title: 'Kubernetes — lecture slides', provisional: true });
    expect(byId[153]).toMatchObject({ kind: 'practical', title: 'Deploy a service', subtitle: 'Practice 6' });
    expect(byId[22]?.kind).toBe('recording');
    // The eyebrow is Moodle's module name (here the plugin-name fallback), never an invented kind word.
    expect(byId[22]?.label).toBe('URL');
    expect(byId[21]?.label).toBe('RESOURCE');
  });
  it('the eyebrow uses Moodle\'s localised module name: scraped type text first, then core_get_strings', () => {
    const d = new Map([[21, { iconKey: '', format: 'PDF', typeName: 'Fail', dates: [], at: 1 } as never]]);
    const names = new Map([['url', 'Veebilink']]);
    const r = buildRows(state, six, d, new Map(), fmt, names);
    expect(r.find((x) => x.cm.id === 21)?.label).toBe('FAIL');
    expect(r.find((x) => x.cm.id === 22)?.label).toBe('VEEBILINK');
  });
  it('primary button is the first incomplete tracked row', () => {
    expect(rows).toHaveLength(4);
    expect(primaryIndex(rows)).toBe(0);
    expect(resourceCount(rows)).toBe(4);
  });
  it('subtitle lists the kinds present, capitalised, joined with "and"', () => {
    expect(subtitleForRows(rows, {}, 'and')).toBe('Lecture, practical work, recording and materials');
  });
  it('deadline events make assignments show their due text and a Submit verb', () => {
    const st2 = normalizeState(2, { ...raw, cm: [...raw.cm, { id: 400, name: 'Lab 6: Report', module: 'assign', sectionid: 16, sectionnumber: 6, uservisible: true }], section: raw.section.map((s) => (s.number === 6 ? { ...s, cmlist: [...s.cmlist, '400'] } : s)) } as never);
    const sec = st2.sections.find((s) => s.number === 6)!;
    const ev = new Map<number, CmEvent>([[400, { cmid: 400, due: 1_800_000_000, overdue: false, modulename: 'assign', actionable: true } as CmEvent]]);
    const row = buildRows(st2, sec, new Map(), ev, fmt).find((r) => r.cm.id === 400)!;
    expect(row).toMatchObject({ kind: 'assignment', verb: 'submit', dueText: 'ts1800000000', subtitle: 'Lab 6' });
    expect(row.label).toBe('ASSIGN / TS1800000000');
    const late = buildRows(st2, sec, new Map(), new Map([[400, { cmid: 400, due: 5, overdue: true, modulename: 'assign' } as CmEvent]]), fmt).find((r) => r.cm.id === 400)!;
    expect(late).toMatchObject({ verb: 'open', overdue: true });
  });
  it('topics: week ranges recognised, section 0 flagged as the intro', () => {
    const tps = buildTopics(state, new Map());
    expect(tps.find((t) => t.section.number === 8)?.isRange).toBe(true);
    expect(tps.find((t) => t.section.number === 6)).toMatchObject({ number: '06', isRange: false, isIntro: false });
    expect(tps[0]).toMatchObject({ number: '00', isIntro: true, title: 'General' });
  });
  it('isDateRange', () => {
    expect(isDateRange('12 October - 18 October')).toBe(true);
    expect(isDateRange('Oct 12 – Oct 18')).toBe(true);
    expect(isDateRange('12. oktoober – 18. oktoober')).toBe(true);
    expect(isDateRange('Kubernetes')).toBe(false);
    expect(isDateRange('Week 6: Containers')).toBe(false);
  });
  it('pad2 and hash parsing', () => {
    expect(pad2(6)).toBe('06');
    expect(parseTopicHash('#topic-12')).toBe(12);
    expect(parseTopicHash('#section-3')).toBeUndefined();
  });
});

describe('initial topic rules (happy-path §3.3)', () => {
  const topics = buildTopics(state, new Map());
  const recent = Date.now();
  it('URL wins, then recent memory, then the current section, then deadline, incomplete, first', () => {
    expect(initialTopic({ topics, fromUrl: 7 })).toBe(7);
    expect(initialTopic({ topics, fromUrl: 99 })).toBe(6); // unknown topic falls through to "current"
    expect(initialTopic({ topics, ui: { topic: 1, at: recent } })).toBe(1);
    expect(initialTopic({ topics, ui: { topic: 1, at: recent - 20 * 86_400_000 } })).toBe(6);
    const noCurrent = topics.map((t) => ({ section: { ...t.section, current: false } }));
    expect(initialTopic({ topics: noCurrent, deadlineTopic: 7 })).toBe(7);
    expect(initialTopic({ topics: noCurrent, incompleteTopic: 8 })).toBe(8);
    expect(initialTopic({ topics: noCurrent })).toBe(1);
    expect(initialTopic({ topics: [] })).toBeUndefined();
  });
  it('deadline and incomplete topics come from the state', () => {
    expect(incompleteTopic(state)).toBe(1);
    const ev = [{ cmid: 153, due: 2_000_000_000, overdue: false }, { cmid: 1, due: 1_900_000_000, overdue: false }] as CmEvent[];
    expect(deadlineTopic(state, ev, 1_800_000_000)).toBe(1);
    expect(deadlineTopic(state, [{ cmid: 1, due: 5, overdue: true } as CmEvent], 10)).toBeUndefined();
  });
});

describe('preview content', () => {
  const base = 'http://l:8080/mod/page/view.php?id=3';
  it('page: sanitized article from the generalbox', () => {
    const c = previewFromHtml('page', '<div id="region-main"><div class="box generalbox"><h2>Notes</h2><p onclick="x()">Hi <script>1</script><a href="/a">link</a></p></div></div>', base);
    expect(c.kind).toBe('article');
    if (c.kind === 'article') {
      expect(c.html).toContain('<h2>Notes</h2>');
      expect(c.html).not.toMatch(/script|onclick/);
    }
  });
  it('url: link card from the workaround anchor', () => {
    const c = previewFromHtml('url', '<div class="urlworkaround"><a href="https://www.example.org/x?y=1">go</a></div>', base);
    expect(c).toEqual({ kind: 'link', href: 'https://www.example.org/x?y=1', domain: 'example.org' });
  });
  it('resource with an embedded object: frame with a download URL; nothing known: none', () => {
    const c = previewFromHtml('resource', '<iframe id="resourceobject" src="/pluginfile.php/5/mod_resource/content/1/a.pdf"></iframe>', 'http://l:8080/mod/resource/view.php?id=1');
    expect(c).toMatchObject({ kind: 'frame', src: 'http://l:8080/pluginfile.php/5/mod_resource/content/1/a.pdf' });
    expect(previewFromHtml('resource', '<p>nothing</p>', base)).toEqual({ kind: 'none' });
    expect(downloadUrl('http://l/p.pdf')).toBe('http://l/p.pdf?forcedownload=1');
    expect(domainOf('not a url')).toBe('not a url');
  });
  it('offers external resource objects as safe links and rejects executable URL cards', () => {
    expect(previewFromHtml('resource', '<iframe id="resourceobject" src="https://external.example/notes.pdf"></iframe>', base)).toEqual({ kind: 'link', href: 'https://external.example/notes.pdf', domain: 'external.example' });
    expect(previewFromHtml('url', '<div class="urlworkaround"><a href="javascript:alert(1)">open</a></div>', base)).toEqual({ kind: 'none' });
    expect(previewFromHtml('url', '<div class="urlworkaround"><a href="/read">open</a></div>', base)).toEqual({ kind: 'link', href: 'http://l:8080/read', domain: 'l' });
  });
});

describe('Slide Up Text splitting', () => {
  it('words, graphemes (õ, combining marks, emoji) and stagger orders', () => {
    expect(splitWords('  Cloud   Architectures \n & DevOps ')).toEqual(['Cloud', 'Architectures', '&', 'DevOps']);
    expect(splitGraphemes('Õpe👩‍💻é')).toEqual(['Õ', 'p', 'e', '👩‍💻', 'é']);
    expect([0, 1, 2, 3].map((i) => staggerDelay(i, 4, 'first', 0.1))).toEqual([0, 0.1, 0.2, 0.30000000000000004]);
    expect([0, 1, 2].map((i) => staggerDelay(i, 3, 'last', 0.1))).toEqual([0.2, 0.1, 0]);
    expect([0, 1, 2].map((i) => staggerDelay(i, 3, 'center', 0.1))).toEqual([0.1, 0, 0.1]);
  });
  it('builds one visually hidden full text plus aria-hidden pieces', () => {
    const host = document.createElement('h1');
    const b = buildSlideUp(host, 'Cloud Architectures\n& DevOps', { split: 'words' });
    expect(host.querySelector('.kex-sr')?.textContent).toBe('Cloud Architectures & DevOps');
    expect(host.querySelector('.kex-su')?.getAttribute('aria-hidden')).toBe('true');
    expect(b.items.map((i) => i.textContent)).toEqual(['Cloud', 'Architectures', '&', 'DevOps']);
    expect(b.lineItems.map((l) => l.length)).toEqual([2, 2]);
    expect(host.querySelectorAll('.kex-su-line')).toHaveLength(2);
  });
  it('characters keep words together so lines break between words only', () => {
    const host = document.createElement('h3');
    const b = buildSlideUp(host, 'Kubernetes ja Õpe', { split: 'characters' });
    expect(b.items).toHaveLength('Kubernetes'.length + 2 + 3);
    expect(host.querySelectorAll('.kex-su-word')).toHaveLength(3);
    expect(host.textContent).toContain('Kubernetes ja Õpe');
  });
});

describe('due text from Moodle dates', () => {
  it('shortens the long date to "Due Thu 10 Sep"', () => {
    expect(dueTextFromDates([{ label: 'Due:', text: 'Thursday, 10 September 2026, 5:38 PM' }])).toBe('Due Thu 10 Sep');
    expect(dueTextFromDates([{ label: 'Closes:', text: 'Monday, 14 September 2026, 4:38 AM' }])).toBe('Closes Mon 14 Sep');
  });
  it('handles Estonian dates and unknown shapes', () => {
    expect(dueTextFromDates([{ label: 'Tähtaeg:', text: 'neljapäev, 10. september 2026, 17:38' }])).toBe('Tähtaeg Nel 10 Sep');
    expect(dueTextFromDates([{ label: 'Due:', text: 'tomorrow' }])).toBe('tomorrow');
    expect(dueTextFromDates([{ label: 'Opened:', text: 'Monday, 1 June 2026' }])).toBeUndefined();
    expect(dueTextFromDates(undefined)).toBeUndefined();
  });
});
