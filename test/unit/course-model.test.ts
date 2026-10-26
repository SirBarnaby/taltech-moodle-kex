import { describe, expect, it } from 'vitest';
import {
  cmsOfSection, itemsOfSection, normalizeState, promotedSection0, section0, subsectionMap, topicNumberOfCm, topicSections,
} from '../../src/data/repo/coursestate';
import { downloadUrl, domainOf, previewFromHtml } from '../../src/data/repo/preview';
import type { CmEvent } from '../../src/data/repo/courseevents';
import {
  buildRows, buildSectionView, buildTopics, deadlineTopic, dueTextFromDates, incompleteTopic, isDateRange, parseTopicHash, primaryIndex, startPlace,
  resourceCount, subtitleForRows,
} from '../../src/data/topics';

const fmt = (ts: number): string => `ts${ts}`;

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
const six = state.sections.find((s) => s.number === 6)!;

/** Moodle 4.5 shape: delegated sections carry their own numbers, `itemid` is the subsection instance id (not the cm id). */
const raw45 = {
  course: { id: 7, statekey: 'k' },
  section: [
    { id: 100, number: 0, title: 'House Rules', hassummary: true, cmlist: [], visible: true },
    { id: 101, number: 1, title: 'Week 1', hassummary: true, cmlist: ['900', '901', '902'], visible: true },
    { id: 102, number: 2, title: 'Week 2', cmlist: [], visible: true },
    { id: 190, number: 3, title: 'Lab 1', hassummary: true, cmlist: ['910', '911'], visible: true, component: 'mod_subsection', itemid: 3605, parentsectionid: 101 },
    { id: 191, number: 4, title: 'Lab 2', cmlist: ['920'], visible: true, component: 'mod_subsection', itemid: 3606, parentsectionid: 101 },
  ],
  cm: [
    { id: 900, name: 'Intro', module: 'resource', sectionid: 101, sectionnumber: 1, uservisible: true },
    // cmid 901 is nowhere near itemid 3605: only delegatesectionid links it.
    { id: 901, name: 'Lab 1', module: 'subsection', sectionid: 101, sectionnumber: 1, uservisible: true, hasdelegatedsection: true, delegatesectionid: 190 },
    // No delegatesectionid (older state): found through component + equal title.
    { id: 902, name: 'Lab 2', module: 'subsection', sectionid: 101, sectionnumber: 1, uservisible: true, hasdelegatedsection: true },
    { id: 910, name: 'Read this', module: 'page', sectionid: 190, sectionnumber: 3, uservisible: true, completionstate: 1, istrackeduser: true },
    { id: 911, name: 'Do that', module: 'assign', sectionid: 190, sectionnumber: 3, uservisible: true, completionstate: 0, istrackeduser: true },
    { id: 920, name: 'Second lab file', module: 'resource', sectionid: 191, sectionnumber: 4, uservisible: true },
  ],
};
const st45 = normalizeState(7, raw45 as never, 1);

describe('course state', () => {
  it('decodes escaped titles, flags subsections and tracking, lists the topics and expands a subsection in place', () => {
    expect(state.sections.find((s) => s.number === 7)?.title).toBe('Containers & Docker');
    expect(state.cms.find((c) => c.id === 2)?.name).toBe('Q&A');
    expect(state.cms.find((c) => c.id === 21)).toMatchObject({ tracked: true, completion: 0, modname: 'resource' });
    expect(state.cms.find((c) => c.id === 22)?.tracked).toBe(false);
    expect(state.sections.find((s) => s.number === 10)).toMatchObject({ component: 'mod_subsection', itemid: 300 });
    // Topics lead with section 0 (it holds an activity), then visible sections; hidden and delegated ones are out; a subsection expands in place.
    expect(topicSections(state).map((s) => s.number)).toEqual([0, 1, 6, 7, 8]);
    const cms = cmsOfSection(state, six);
    expect(cms.map((c) => c.id)).toEqual([21, 153, 22, 301]);
    expect(cms.at(-1)?.group).toBe('Sub');
    expect(cmsOfSection(state, state.sections.find((s) => s.number === 8)!)).toEqual([]); // invisible cms drop out
  });
});

describe('topic model', () => {
  const rows = buildRows(state, six, new Map(), new Map(), fmt);

  it('classifies rows, splits "Practice 6: ..." and uses Moodle\'s module name as the eyebrow (scraped type text first, then core_get_strings)', () => {
    const byId = Object.fromEntries(rows.map((r) => [r.cm.id, r]));
    expect(byId[21]).toMatchObject({ kind: 'lecture', title: 'Kubernetes — lecture slides', provisional: true });
    expect(byId[153]).toMatchObject({ kind: 'practical', title: 'Deploy a service', subtitle: 'Practice 6' });
    expect(byId[22]?.kind).toBe('recording');
    expect(byId[22]?.label).toBe('URL'); // the plugin-name fallback, never an invented kind word
    expect(byId[21]?.label).toBe('RESOURCE');
    const details = new Map([[21, { iconKey: '', format: 'PDF', typeName: 'Fail', dates: [], at: 1 } as never]]);
    const r = buildRows(state, six, details, new Map(), fmt, new Map([['url', 'Veebilink']]));
    expect(r.find((x) => x.cm.id === 21)?.label).toBe('FAIL');
    expect(r.find((x) => x.cm.id === 22)?.label).toBe('VEEBILINK');
  });

  it('the primary button is the first incomplete tracked row; the subtitle lists the kinds present', () => {
    expect(rows).toHaveLength(4);
    expect(primaryIndex(rows)).toBe(0);
    expect(resourceCount(rows)).toBe(4);
    expect(subtitleForRows(rows, {}, 'and')).toBe('Lecture, practical work, recording and materials');
  });

  it('deadline events make assignments show their due text and a Submit verb; overdue ones just open', () => {
    const st2 = normalizeState(2, { ...raw, cm: [...raw.cm, { id: 400, name: 'Lab 6: Report', module: 'assign', sectionid: 16, sectionnumber: 6, uservisible: true }], section: raw.section.map((s) => (s.number === 6 ? { ...s, cmlist: [...s.cmlist, '400'] } : s)) } as never);
    const sec = st2.sections.find((s) => s.number === 6)!;
    const ev = new Map<number, CmEvent>([[400, { cmid: 400, due: 1_800_000_000, overdue: false, modulename: 'assign', actionable: true } as CmEvent]]);
    const row = buildRows(st2, sec, new Map(), ev, fmt).find((r) => r.cm.id === 400)!;
    expect(row).toMatchObject({ kind: 'assignment', verb: 'submit', dueText: 'ts1800000000', subtitle: 'Lab 6' });
    expect(row.label).toBe('ASSIGN / TS1800000000');
    const late = buildRows(st2, sec, new Map(), new Map([[400, { cmid: 400, due: 5, overdue: true, modulename: 'assign' } as CmEvent]]), fmt).find((r) => r.cm.id === 400)!;
    expect(late).toMatchObject({ verb: 'open', overdue: true });
  });

  it('week ranges are recognised, section 0 is flagged as the intro, hashes parse', () => {
    const tps = buildTopics(state, new Map());
    expect(tps.find((t) => t.section.number === 8)?.isRange).toBe(true);
    expect(tps.find((t) => t.section.number === 6)).toMatchObject({ number: '06', isRange: false, isIntro: false });
    expect(tps[0]).toMatchObject({ number: '00', isIntro: true, title: 'General' });
    expect(isDateRange('12 October - 18 October')).toBe(true);
    expect(isDateRange('Oct 12 – Oct 18')).toBe(true);
    expect(isDateRange('12. oktoober – 18. oktoober')).toBe(true);
    expect(isDateRange('Kubernetes')).toBe(false);
    expect(isDateRange('Week 6: Containers')).toBe(false);
    expect(parseTopicHash('#topic-12')).toBe(12);
    expect(parseTopicHash('#section-3')).toBeUndefined();
  });

  it('shortens Moodle dates to "Due Thu 10 Sep" in both languages and leaves unknown shapes', () => {
    expect(dueTextFromDates([{ label: 'Due:', text: 'Thursday, 10 September 2026, 5:38 PM' }])).toBe('Due Thu 10 Sep');
    expect(dueTextFromDates([{ label: 'Closes:', text: 'Monday, 14 September 2026, 4:38 AM' }])).toBe('Closes Mon 14 Sep');
    expect(dueTextFromDates([{ label: 'Tähtaeg:', text: 'neljapäev, 10. september 2026, 17:38' }])).toBe('Tähtaeg Nel 10 Sep');
    expect(dueTextFromDates([{ label: 'Due:', text: 'tomorrow' }])).toBe('tomorrow');
    expect(dueTextFromDates([{ label: 'Opened:', text: 'Monday, 1 June 2026' }])).toBeUndefined();
    expect(dueTextFromDates(undefined)).toBeUndefined();
  });
});

describe('where the course page opens', () => {
  const topics = buildTopics(state, new Map());

  it('the address wins, then where the reader left it (14 days), else the top', () => {
    const recent = Date.now();
    expect(startPlace({ topics, fromUrl: 7 })).toEqual({ topic: 7, offset: 0 });
    expect(startPlace({ topics, fromUrl: 99 })).toBeUndefined(); // an unknown topic opens at the top
    expect(startPlace({ topics, ui: { anchor: { topic: 1, offset: 240 }, at: recent } })).toEqual({ topic: 1, offset: 240 });
    expect(startPlace({ topics, fromUrl: 6, ui: { anchor: { topic: 1, offset: 240 }, at: recent } })).toEqual({ topic: 6, offset: 0 });
    expect(startPlace({ topics, ui: { anchor: { topic: 1, offset: 240 }, at: recent - 20 * 86_400_000 } })).toBeUndefined();
    expect(startPlace({ topics, ui: { topic: 1, at: recent } })).toBeUndefined(); // an old memory without a place
    expect(startPlace({ topics: [] })).toBeUndefined();
  });

  it('deadline and incomplete topics come from the state', () => {
    expect(incompleteTopic(state)).toBe(1);
    const ev = [{ cmid: 153, due: 2_000_000_000, overdue: false }, { cmid: 1, due: 1_900_000_000, overdue: false }] as CmEvent[];
    expect(deadlineTopic(state, ev, 1_800_000_000)).toBe(1);
    expect(deadlineTopic(state, [{ cmid: 1, due: 5, overdue: true } as CmEvent], 10)).toBeUndefined();
  });
});

describe('section 0 as the first topic', () => {
  const sec0 = (title: string, cmlist: string[], extra: object = {}) =>
    normalizeState(7, {
      course: { id: 7 },
      section: [{ id: 1, number: 0, title, cmlist, visible: true, ...extra }, { id: 2, number: 1, title: 'T', cmlist: [], visible: true }],
      cm: cmlist.length ? [{ id: 5, name: 'Announcements', module: 'forum', sectionid: 1, uservisible: true }] : [],
    } as never);

  it('is promoted with a summary ("House Rules"), with only activities, or with a custom title; stays out as the empty default General (also Estonian); a delegated section 0 does not count', () => {
    expect(promotedSection0(st45)?.title).toBe('House Rules');
    const tps = buildTopics(st45, new Map());
    expect(tps[0]).toMatchObject({ number: '00', title: 'House Rules', isIntro: true });
    expect(tps.map((t) => t.section.number)).toEqual([0, 1, 2]);
    expect(promotedSection0(sec0('General', ['5']))?.id).toBe(1);
    expect(promotedSection0(sec0('Welcome', []))?.title).toBe('Welcome');
    const empty = sec0('General', []);
    expect(promotedSection0(empty)).toBeUndefined();
    expect(topicSections(empty).map((x) => x.number)).toEqual([1]);
    expect(promotedSection0(sec0('Üldine', []))).toBeUndefined();
    // A delegated section numbered 0 is not section 0.
    const s = normalizeState(7, {
      course: { id: 7 },
      section: [{ id: 1, number: 0, title: 'General', cmlist: [], visible: true }, { id: 9, number: 0, title: 'Sub', cmlist: [], visible: true, component: 'mod_subsection' }],
      cm: [],
    } as never);
    expect(section0(s)?.id).toBe(1);
  });
});

describe('subsections on Moodle 4.5', () => {
  it('resolves a subsection by delegatesectionid (itemid is not the cm id), then by equal title, and still by the legacy itemid', () => {
    const map = subsectionMap(st45);
    expect(map.get(901)?.id).toBe(190);
    expect(st45.sections.find((s) => s.id === 190)?.itemid).toBe(3605);
    expect(st45.cms.find((c) => c.id === 901)?.delegatedSectionId).toBe(190);
    expect(map.get(902)?.id).toBe(191);
    const legacy = normalizeState(7, { ...raw45, section: raw45.section.map((s) => (s.id === 191 ? { ...s, title: 'Renamed', itemid: 902 } : s)) } as never);
    expect(subsectionMap(legacy).get(902)?.id).toBe(191);
  });

  it('flattens subsection cms in place, never makes a delegated section a topic, and gives a nested cm to the parent topic', () => {
    const w1 = st45.sections.find((s) => s.id === 101)!;
    const cms = cmsOfSection(st45, w1);
    expect(cms.map((c) => c.id)).toEqual([900, 910, 911, 920]);
    expect(cms[1]).toMatchObject({ group: 'Lab 1', groupId: 190 });
    expect(itemsOfSection(st45, w1).map((i) => i.type)).toEqual(['cm', 'sub', 'sub']);
    expect(topicSections(st45).map((s) => s.number)).toEqual([0, 1, 2]);
    expect(topicNumberOfCm(st45, st45.cms.find((c) => c.id === 911)!)).toBe(1);
    expect(deadlineTopic(st45, [{ cmid: 911, due: 2_000_000_000, overdue: false } as CmEvent], 1_900_000_000)).toBe(1);
  });

  it('renders each subsection as a titled group with its own summary and progress; an unresolvable one stays reachable as a plain row', () => {
    const w1 = st45.sections.find((s) => s.id === 101)!;
    const view = buildSectionView(w1, { state: st45, details: new Map(), events: new Map(), fmtDue: fmt }, { summaries: new Map([[190, '<p>Warm up first.</p>']]) });
    expect(view.blocks.map((b) => b.type)).toEqual(['row', 'group', 'group']);
    const g = view.blocks[1];
    if (g?.type !== 'group') throw new Error('group expected');
    expect(g.group).toMatchObject({ title: 'Lab 1', summaryHtml: '<p>Warm up first.</p>', total: 2, done: 1 });
    expect(g.group.rows.map((r) => r.cm.id)).toEqual([910, 911]);
    expect(view.rows.map((r) => r.cm.id)).toEqual([900, 910, 911, 920]);
    const broken = normalizeState(7, { ...raw45, section: raw45.section.filter((s) => s.id !== 191) } as never);
    expect(cmsOfSection(broken, broken.sections.find((s) => s.id === 101)!).map((c) => c.id)).toContain(902);
  });
});

describe('preview content', () => {
  const base = 'http://l:8080/mod/page/view.php?id=3';

  it('page: the generalbox as a sanitised article', () => {
    const c = previewFromHtml('page', '<div id="region-main"><div class="box generalbox"><h2>Notes</h2><p onclick="x()">Hi <script>1</script><a href="/a">link</a></p></div></div>', base);
    expect(c.kind).toBe('article');
    if (c.kind === 'article') {
      expect(c.html).toContain('<h2>Notes</h2>');
      expect(c.html).not.toMatch(/script|onclick/);
    }
  });

  it('url and resource: link card, frame with a download URL, external objects as safe links, executable URLs rejected', () => {
    expect(previewFromHtml('url', '<div class="urlworkaround"><a href="https://www.example.org/x?y=1">go</a></div>', base)).toEqual({ kind: 'link', href: 'https://www.example.org/x?y=1', domain: 'example.org' });
    expect(previewFromHtml('url', '<div class="urlworkaround"><a href="javascript:alert(1)">open</a></div>', base)).toEqual({ kind: 'none' });
    expect(previewFromHtml('url', '<div class="urlworkaround"><a href="/read">open</a></div>', base)).toEqual({ kind: 'link', href: 'http://l:8080/read', domain: 'l' });
    const frame = previewFromHtml('resource', '<iframe id="resourceobject" src="/pluginfile.php/5/mod_resource/content/1/a.pdf"></iframe>', 'http://l:8080/mod/resource/view.php?id=1');
    expect(frame).toMatchObject({ kind: 'frame', src: 'http://l:8080/pluginfile.php/5/mod_resource/content/1/a.pdf' });
    expect(previewFromHtml('resource', '<iframe id="resourceobject" src="https://external.example/notes.pdf"></iframe>', base)).toEqual({ kind: 'link', href: 'https://external.example/notes.pdf', domain: 'external.example' });
    expect(previewFromHtml('resource', '<p>nothing</p>', base)).toEqual({ kind: 'none' });
    expect(downloadUrl('http://l/p.pdf')).toBe('http://l/p.pdf?forcedownload=1');
    expect(domainOf('not a url')).toBe('not a url');
  });
});
