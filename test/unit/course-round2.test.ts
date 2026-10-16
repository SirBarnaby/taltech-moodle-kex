import { describe, expect, it } from 'vitest';
import {
  cmsOfSection, itemsOfSection, normalizeState, promotedSection0, section0, subsectionMap, topicNumberOfCm, topicSections,
} from '../../src/data/repo/coursestate';
import { parseCmItems, typeNameOf } from '../../src/data/scrape/cm';
import { scrapeSecondaryNav } from '../../src/data/scrape/secondarynav';
import { scrapeSummaries } from '../../src/data/scrape/summaries';
import { scrapeTiles } from '../../src/data/scrape/tiles';
import { buildSectionView, buildTopics, deadlineTopic, initialTopic } from '../../src/data/topics';
import type { CmEvent } from '../../src/data/repo/courseevents';
import { loadCapture } from '../fixtures/load';

const fmt = (ts: number): string => `ts${ts}`;

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

describe('subsections on Moodle 4.5', () => {
  it('resolves a subsection by cm.delegatesectionid even though itemid is not the cm id', () => {
    const map = subsectionMap(st45);
    expect(map.get(901)?.id).toBe(190);
    expect(st45.sections.find((s) => s.id === 190)?.itemid).toBe(3605);
    expect(st45.cms.find((c) => c.id === 901)?.delegatedSectionId).toBe(190);
  });
  it('falls back to the mod_subsection section with the same title', () => {
    expect(subsectionMap(st45).get(902)?.id).toBe(191);
  });
  it('keeps the legacy itemid lookup for states where itemid is the cm id', () => {
    const legacy = normalizeState(7, {
      ...raw45,
      section: raw45.section.map((s) => (s.id === 191 ? { ...s, title: 'Renamed', itemid: 902 } : s)),
    } as never);
    expect(subsectionMap(legacy).get(902)?.id).toBe(191);
  });
  it('cmsOfSection flattens the subsection cms in place, flagged with their group', () => {
    const w1 = st45.sections.find((s) => s.id === 101)!;
    const cms = cmsOfSection(st45, w1);
    expect(cms.map((c) => c.id)).toEqual([900, 910, 911, 920]);
    expect(cms[1]).toMatchObject({ group: 'Lab 1', groupId: 190 });
    expect(itemsOfSection(st45, w1).map((i) => i.type)).toEqual(['cm', 'sub', 'sub']);
  });
  it('delegated sections are never topics, even with a number of their own', () => {
    expect(topicSections(st45).map((s) => s.number)).toEqual([0, 1, 2]);
  });
  it('a cm inside a subsection belongs to the parent topic (deadlines, search)', () => {
    expect(topicNumberOfCm(st45, st45.cms.find((c) => c.id === 911)!)).toBe(1);
    const ev = [{ cmid: 911, due: 2_000_000_000, overdue: false } as CmEvent];
    expect(deadlineTopic(st45, ev, 1_900_000_000)).toBe(1);
  });
  it('renders each subsection as a titled group with its own summary and progress, in order', () => {
    const w1 = st45.sections.find((s) => s.id === 101)!;
    const view = buildSectionView(
      w1,
      { state: st45, details: new Map(), events: new Map(), fmtDue: fmt },
      { summaries: new Map([[190, '<p>Warm up first.</p>']]) },
    );
    expect(view.blocks.map((b) => b.type)).toEqual(['row', 'group', 'group']);
    const g = view.blocks[1];
    if (g?.type !== 'group') throw new Error('group expected');
    expect(g.group).toMatchObject({ title: 'Lab 1', summaryHtml: '<p>Warm up first.</p>', total: 2, done: 1 });
    expect(g.group.rows.map((r) => r.cm.id)).toEqual([910, 911]);
    expect(view.rows.map((r) => r.cm.id)).toEqual([900, 910, 911, 920]);
  });
  it('a subsection that cannot be resolved stays reachable as a plain row', () => {
    const broken = normalizeState(7, { ...raw45, section: raw45.section.filter((s) => s.id !== 191) } as never);
    const w1 = broken.sections.find((s) => s.id === 101)!;
    expect(cmsOfSection(broken, w1).map((c) => c.id)).toContain(902);
  });
});

describe('section 0 as the first topic', () => {
  it('is promoted with its own title when it has a summary (ITB8833 "House Rules")', () => {
    expect(promotedSection0(st45)?.title).toBe('House Rules');
    const tps = buildTopics(st45, new Map());
    expect(tps[0]).toMatchObject({ number: '00', title: 'House Rules', isIntro: true });
    expect(tps.map((t) => t.section.number)).toEqual([0, 1, 2]);
  });
  it('is promoted when it only holds activities', () => {
    const s = normalizeState(7, {
      course: { id: 7 },
      section: [{ id: 1, number: 0, title: 'General', cmlist: ['5'], visible: true }],
      cm: [{ id: 5, name: 'Announcements', module: 'forum', sectionid: 1, uservisible: true }],
    } as never);
    expect(promotedSection0(s)?.id).toBe(1);
  });
  it('stays out when it is the empty default General', () => {
    const s = normalizeState(7, { course: { id: 7 }, section: [{ id: 1, number: 0, title: 'General', cmlist: [], visible: true }, { id: 2, number: 1, title: 'T', cmlist: [], visible: true }], cm: [] } as never);
    expect(promotedSection0(s)).toBeUndefined();
    expect(topicSections(s).map((x) => x.number)).toEqual([1]);
    const et = normalizeState(7, { course: { id: 7 }, section: [{ id: 1, number: 0, title: 'Üldine', cmlist: [], visible: true }], cm: [] } as never);
    expect(promotedSection0(et)).toBeUndefined();
  });
  it('a custom title alone is enough', () => {
    const s = normalizeState(7, { course: { id: 7 }, section: [{ id: 1, number: 0, title: 'Welcome', cmlist: [], visible: true }], cm: [] } as never);
    expect(promotedSection0(s)?.title).toBe('Welcome');
  });
  it('a delegated section numbered 0 is not section 0', () => {
    const s = normalizeState(7, {
      course: { id: 7 },
      section: [{ id: 1, number: 0, title: 'General', cmlist: [], visible: true }, { id: 9, number: 0, title: 'Sub', cmlist: [], visible: true, component: 'mod_subsection' }],
      cm: [],
    } as never);
    expect(section0(s)?.id).toBe(1);
  });
  it('the course opens on its first numbered topic, not on section 0, unless the URL asks for 0', () => {
    const tps = buildTopics(st45, new Map());
    expect(initialTopic({ topics: tps })).toBe(1);
    expect(initialTopic({ topics: tps, fromUrl: 0 })).toBe(0);
  });
});

describe('secondary navigation scraped from Moodle', () => {
  it('reads participants, grades and competencies with Moodle\'s labels and URLs (id-37829)', () => {
    const nav = scrapeSecondaryNav(loadCapture('course_view__id-37829'), 'https://moodle.taltech.ee/course/view.php?id=37829');
    expect(nav.map((n) => n.key)).toEqual(['coursehome', 'participants', 'grades', 'competencies']);
    expect(nav.map((n) => n.label)).toEqual(['Course', 'Participants', 'Grades', 'Competencies']);
    expect(nav.find((n) => n.key === 'participants')?.url).toBe('https://moodle.taltech.ee/user/index.php?id=37829');
    expect(nav.find((n) => n.key === 'grades')?.url).toBe('https://moodle.taltech.ee/grade/report/index.php?id=37829');
    expect(nav.filter((n) => n.active).map((n) => n.key)).toEqual(['coursehome']);
  });
  it('works on the other captures too, and includes entries moved into the More dropdown', () => {
    for (const name of ['course_view__id-37582', 'course_view__id-38420'] as const) {
      const nav = scrapeSecondaryNav(loadCapture(name));
      expect(nav.length).toBeGreaterThanOrEqual(3);
      expect(nav.some((n) => n.key === 'participants')).toBe(true);
      expect(nav.some((n) => n.key === 'grades')).toBe(true);
    }
    const doc = new DOMParser().parseFromString(
      `<div class="secondary-navigation"><nav class="moremenu"><ul>
        <li data-key="coursehome"><a class="nav-link active" href="/course/view.php?id=1">Kursus</a></li>
        <li data-region="morebutton"><a class="dropdown-toggle" href="#">Rohkem</a>
          <ul data-region="moredropdown"><li data-key="badgesview"><a class="dropdown-item" href="/badges/view.php?type=2&id=1">Märgid</a></li></ul></li>
      </ul></nav></div>`,
      'text/html',
    );
    const nav = scrapeSecondaryNav(doc, 'https://moodle.example/');
    expect(nav).toEqual([
      { key: 'coursehome', label: 'Kursus', url: 'https://moodle.example/course/view.php?id=1', active: true },
      { key: 'badgesview', label: 'Märgid', url: 'https://moodle.example/badges/view.php?type=2&id=1', active: false },
    ]);
  });
  it('reads Moodle 5\'s React props when the markup was already replaced, and skips submenu entries', () => {
    const props = JSON.stringify({ items: [
      { key: 'coursehome', text: 'Course', href: 'http://l/course/view.php?id=2', active: true, children: [] },
      { key: 'participants', text: 'Participants', href: 'http://l/user/index.php?id=2', active: false, children: [{ key: 'user3', text: 'Someone', href: 'http://l/user/view.php?id=3' }] },
    ] });
    const doc = new DOMParser().parseFromString(`<div class="secondary-navigation"><div data-react-component="x/Nav" data-react-props='${props}'></div></div>`, 'text/html');
    expect(scrapeSecondaryNav(doc).map((n) => [n.key, n.label, n.active])).toEqual([['coursehome', 'Course', true], ['participants', 'Participants', false]]);
    const nested = new DOMParser().parseFromString(
      '<div class="secondary-navigation"><ul><li data-key="participants"><a href="/user/index.php?id=2">P</a><ul><li data-key="user3"><a href="/user/view.php?id=3">Someone</a></li></ul></li></ul></div>',
      'text/html',
    );
    expect(scrapeSecondaryNav(nested, 'http://l/').map((n) => n.key)).toEqual(['participants']);
  });
  it('returns nothing on a page without the navigation', () => {
    expect(scrapeSecondaryNav(new DOMParser().parseFromString('<p>x</p>', 'text/html'))).toEqual([]);
  });
});

describe('Moodle content from the page DOM', () => {
  it('section 0 summary of ITB8833 "House Rules" is picked up, sanitized, links kept', () => {
    const doc = loadCapture('course_view__id-37829');
    const sums = scrapeSummaries(doc, 'https://moodle.taltech.ee/');
    const html = sums.get(156985) ?? '';
    expect(html).toContain('Chatham House');
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Chatham_House_Rule"');
    expect(html).not.toContain('<script');
  });
  it('a parent section does not borrow the summary of a subsection nested in it', () => {
    const doc = new DOMParser().parseFromString(
      `<ul><li data-for="section" data-id="1"><div data-for="sectioninfo"></div>
        <ul><li data-for="section" data-id="2"><div class="summarytext"><p>Inner</p></div></li></ul></li></ul>`,
      'text/html',
    );
    const m = scrapeSummaries(doc);
    expect(m.has(1)).toBe(false);
    expect(m.get(2)).toBe('<p>Inner</p>');
  });
  it('tile photos are scraped from format_tiles (id-37582)', () => {
    const tiles = scrapeTiles(loadCapture('course_view__id-37582'));
    expect(tiles.length).toBeGreaterThan(3);
    const first = tiles.find((t) => t.number === 1);
    expect(first?.image).toContain('/format_tiles/tilephoto/');
    const tps = buildTopics(
      normalizeState(1, { course: { id: 1 }, section: [{ id: first!.sectionId, number: 1, title: 'T1', cmlist: [], visible: true }], cm: [] } as never),
      new Map(tiles.filter((t) => t.image).map((t) => [t.sectionId, t.image!])),
    );
    expect(tps[0]?.tile).toBe(first?.image);
  });
  it('a label keeps its banner image in the note HTML (id-37582)', () => {
    const labels = parseCmItems(loadCapture('course_view__id-37582')).filter((p) => p.modname === 'label');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((l) => (l.details.descriptionHtml ?? '').includes('<img'))).toBe(true);
  });
  it('module type names: accesshide text (topics) and icon alt without "icon" (tiles)', () => {
    const topicsDoc = loadCapture('course_view__id-37829');
    const names = new Set(parseCmItems(topicsDoc).map((p) => p.details.typeName));
    expect(names).toContain('URL');
    expect(names).toContain('File');
    expect(names).toContain('Forum');
    const tiles = parseCmItems(loadCapture('course_view__id-37582'));
    expect(tiles.find((p) => p.id === 960518)?.details.typeName).toBe('Lehekülg');
    const li = new DOMParser().parseFromString('<li><img class="activityicon" alt="External tool icon"></li>', 'text/html').querySelector('li')!;
    expect(typeNameOf(li)).toBe('External tool');
  });
});
