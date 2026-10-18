import { describe, expect, it } from 'vitest';
import { normalizeState } from '../../src/data/repo/coursestate';
import { parseCmItems, typeNameOf } from '../../src/data/scrape/cm';
import { scrapeSecondaryNav } from '../../src/data/scrape/secondarynav';
import { scrapeSummaries } from '../../src/data/scrape/summaries';
import { scrapeTiles } from '../../src/data/scrape/tiles';
import { buildTopics } from '../../src/data/topics';
import { captureDoc } from '../fixtures/load';
import { expectCaptureReadable, pageInfoOf } from '../fixtures/page';

describe('course captures', () => {
  it('give user, sesskey, route and body id (all three), and the course id, format and layout from cfg and the body class', () => {
    for (const name of ['course_view__id-37582', 'course_view__id-37829', 'course_view__id-38420'] as const) expectCaptureReadable(name);
    const tiles = pageInfoOf('course_view__id-37582');
    expect([tiles.courseId, tiles.format, tiles.pageLayout]).toEqual([37582, 'tiles', 'course']);
  });
});

describe('course page shapes', () => {
  it('tiles format (IAS0230): 12 tiles with photos, in order; MMO5770: 4 tiles with icons; a tile photo reaches the topic', () => {
    const tiles = scrapeTiles(captureDoc('course_view__id-37582'));
    expect(tiles).toHaveLength(12);
    expect(tiles[0]).toMatchObject({ sectionId: 153220, number: 1, title: 'Labs' });
    expect(tiles.map((t) => t.sectionId)).toEqual([153220, 153234, 153235, 153236, 153237, 153238, 153239, 153240, 153241, 153242, 153243, 153244]);
    expect(tiles.every((t) => /^https:\/\/moodle\.taltech\.ee\/pluginfile\.php\/.+\/tilephoto\//.test(t.image ?? ''))).toBe(true);
    expect(tiles[1]?.title).toBe('Echo 360 Lecture Recordings & Lecture Online Feedback Channel');
    expect(tiles[2]?.href).toBe('https://moodle.taltech.ee/course/section.php?id=153235');
    const icons = scrapeTiles(captureDoc('course_view__id-38420'));
    expect(icons.map((t) => t.sectionId)).toEqual([165788, 165848, 165801, 165807]);
    expect(icons.every((t) => t.image === undefined)).toBe(true);
    expect(icons[0]?.title).toBe('1. LEADING SELF');
    const first = tiles[0]!;
    const tps = buildTopics(
      normalizeState(1, { course: { id: 1 }, section: [{ id: first.sectionId, number: 1, title: 'T1', cmlist: [], visible: true }], cm: [] } as never),
      new Map(tiles.filter((t) => t.image).map((t) => [t.sectionId, t.image!])),
    );
    expect(tps[0]?.tile).toBe(first.image);
  });

  it('topics format (ITB8833): section 0 is "House Rules" with its cms found; the summary keeps links and carries no script; a parent section does not borrow its subsection\'s summary', () => {
    const doc = captureDoc('course_view__id-37829');
    const s0 = doc.querySelector('li#section-0');
    expect(s0?.getAttribute('data-sectionname')).toBe('House Rules');
    const ids = Array.from(s0?.querySelectorAll('li[data-for="cmitem"]') ?? []).map((li) => Number(li.getAttribute('data-id')));
    expect(ids.length).toBeGreaterThan(0);
    const all = parseCmItems(doc);
    const first = all.find((c) => c.id === ids[0]);
    expect(first?.name.length).toBeGreaterThan(0);
    expect(first?.details.format).toBeTruthy();
    expect(doc.querySelectorAll('li[data-for="section"]').length).toBeGreaterThanOrEqual(5);
    const sums = scrapeSummaries(doc, 'https://moodle.taltech.ee/');
    const html = sums.get(156985) ?? '';
    expect(html).toContain('Chatham House');
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Chatham_House_Rule"');
    for (const h of sums.values()) expect(h).not.toMatch(/<script|onerror|javascript:/i);
    const nested = new DOMParser().parseFromString(
      `<ul><li data-for="section" data-id="1"><div data-for="sectioninfo"></div>
        <ul><li data-for="section" data-id="2"><div class="summarytext"><p>Inner</p></div></li></ul></li></ul>`,
      'text/html',
    );
    const m = scrapeSummaries(nested);
    expect(m.has(1)).toBe(false);
    expect(m.get(2)).toBe('<p>Inner</p>');
  });

  it('a label keeps its banner image; module type names come from accesshide text (topics) or the icon alt without "icon" (tiles)', () => {
    const labels = parseCmItems(captureDoc('course_view__id-37582')).filter((p) => p.modname === 'label');
    expect(labels.some((l) => (l.details.descriptionHtml ?? '').includes('<img'))).toBe(true);
    const names = new Set(parseCmItems(captureDoc('course_view__id-37829')).map((p) => p.details.typeName));
    for (const n of ['URL', 'File', 'Forum']) expect(names).toContain(n);
    expect(parseCmItems(captureDoc('course_view__id-37582')).find((p) => p.id === 960518)?.details.typeName).toBe('Lehekülg');
    const li = new DOMParser().parseFromString('<li><img class="activityicon" alt="External tool icon"></li>', 'text/html').querySelector('li')!;
    expect(typeNameOf(li)).toBe('External tool');
  });

  it('secondary navigation: Moodle\'s labels and URLs on the captures (participants, grades, competencies)', () => {
    const nav = scrapeSecondaryNav(captureDoc('course_view__id-37829'), 'https://moodle.taltech.ee/course/view.php?id=37829');
    expect(nav.map((n) => n.key)).toEqual(['coursehome', 'participants', 'grades', 'competencies']);
    expect(nav.map((n) => n.label)).toEqual(['Course', 'Participants', 'Grades', 'Competencies']);
    expect(nav.find((n) => n.key === 'participants')?.url).toBe('https://moodle.taltech.ee/user/index.php?id=37829');
    expect(nav.find((n) => n.key === 'grades')?.url).toBe('https://moodle.taltech.ee/grade/report/index.php?id=37829');
    expect(nav.filter((n) => n.active).map((n) => n.key)).toEqual(['coursehome']);
    for (const name of ['course_view__id-37582', 'course_view__id-38420'] as const) {
      const other = scrapeSecondaryNav(captureDoc(name));
      expect(other.length, name).toBeGreaterThanOrEqual(3);
      expect(other.some((n) => n.key === 'participants'), name).toBe(true);
      expect(other.some((n) => n.key === 'grades'), name).toBe(true);
    }
  });

  it('secondary navigation: entries in the More dropdown, Moodle 5 React props, submenu entries skipped, none without the navigation', () => {
    const more = new DOMParser().parseFromString(
      `<div class="secondary-navigation"><nav class="moremenu"><ul>
        <li data-key="coursehome"><a class="nav-link active" href="/course/view.php?id=1">Kursus</a></li>
        <li data-region="morebutton"><a class="dropdown-toggle" href="#">Rohkem</a>
          <ul data-region="moredropdown"><li data-key="badgesview"><a class="dropdown-item" href="/badges/view.php?type=2&id=1">Märgid</a></li></ul></li>
      </ul></nav></div>`,
      'text/html',
    );
    expect(scrapeSecondaryNav(more, 'https://moodle.example/')).toEqual([
      { key: 'coursehome', label: 'Kursus', url: 'https://moodle.example/course/view.php?id=1', active: true },
      { key: 'badgesview', label: 'Märgid', url: 'https://moodle.example/badges/view.php?type=2&id=1', active: false },
    ]);
    const props = JSON.stringify({ items: [
      { key: 'coursehome', text: 'Course', href: 'http://l/course/view.php?id=2', active: true, children: [] },
      { key: 'participants', text: 'Participants', href: 'http://l/user/index.php?id=2', active: false, children: [{ key: 'user3', text: 'Someone', href: 'http://l/user/view.php?id=3' }] },
    ] });
    const react = new DOMParser().parseFromString(`<div class="secondary-navigation"><div data-react-component="x/Nav" data-react-props='${props}'></div></div>`, 'text/html');
    expect(scrapeSecondaryNav(react).map((n) => [n.key, n.label, n.active])).toEqual([['coursehome', 'Course', true], ['participants', 'Participants', false]]);
    const nested = new DOMParser().parseFromString(
      '<div class="secondary-navigation"><ul><li data-key="participants"><a href="/user/index.php?id=2">P</a><ul><li data-key="user3"><a href="/user/view.php?id=3">Someone</a></li></ul></li></ul></div>',
      'text/html',
    );
    expect(scrapeSecondaryNav(nested, 'http://l/').map((n) => n.key)).toEqual(['participants']);
    expect(scrapeSecondaryNav(new DOMParser().parseFromString('<p>x</p>', 'text/html'))).toEqual([]);
  });
});

