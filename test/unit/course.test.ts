import { describe, expect, it } from 'vitest';
import { scrapeSummaries } from '../../src/data/scrape/summaries';
import { parseCmItems } from '../../src/data/scrape/cm';
import { scrapeTiles } from '../../src/data/scrape/tiles';
import { loadCapture } from '../fixtures/load';

describe('tiles format (captures)', () => {
  it('IAS0230: 12 tiles, ids from 153220 in order, every tile has a photo', () => {
    const tiles = scrapeTiles(loadCapture('course_view__id-37582'));
    expect(tiles).toHaveLength(12);
    expect(tiles[0]).toMatchObject({ sectionId: 153220, number: 1, title: 'Labs' });
    expect(tiles.map((t) => t.sectionId)).toEqual([153220, 153234, 153235, 153236, 153237, 153238, 153239, 153240, 153241, 153242, 153243, 153244]);
    expect(tiles.every((t) => /^https:\/\/moodle\.taltech\.ee\/pluginfile\.php\/.+\/tilephoto\//.test(t.image ?? ''))).toBe(true);
    expect(tiles[1]?.title).toBe('Echo 360 Lecture Recordings & Lecture Online Feedback Channel');
    expect(tiles[2]?.href).toBe('https://moodle.taltech.ee/course/section.php?id=153235');
  });
  it('MMO5770: 4 tiles that use icons instead of photos', () => {
    const tiles = scrapeTiles(loadCapture('course_view__id-38420'));
    expect(tiles.map((t) => t.sectionId)).toEqual([165788, 165848, 165801, 165807]);
    expect(tiles.every((t) => t.image === undefined)).toBe(true);
    expect(tiles[0]?.title).toBe('1. LEADING SELF');
  });
});

describe('topics format (capture)', () => {
  it('ITB8833: section 0 is "House Rules" and its cms are found with kinds and formats', () => {
    const doc = loadCapture('course_view__id-37829');
    const s0 = doc.querySelector('li#section-0');
    expect(s0?.getAttribute('data-sectionname')).toBe('House Rules');
    const ids = Array.from(s0?.querySelectorAll('li[data-for="cmitem"]') ?? []).map((li) => Number(li.getAttribute('data-id')));
    expect(ids.length).toBeGreaterThan(0);
    const all = parseCmItems(doc);
    expect(all.length).toBeGreaterThanOrEqual(ids.length);
    const first = all.find((c) => c.id === ids[0]);
    expect(first?.name.length).toBeGreaterThan(0);
    expect(first?.details.format).toBeTruthy();
    expect(doc.querySelectorAll('li[data-for="section"]').length).toBeGreaterThanOrEqual(5);
  });
  it('summaries are sanitized and keyed by section id', () => {
    const map = scrapeSummaries(loadCapture('course_view__id-37829'));
    expect(map.size).toBeGreaterThanOrEqual(1);
    for (const html of map.values()) expect(html).not.toMatch(/<script|onerror|javascript:/i);
  });
});
