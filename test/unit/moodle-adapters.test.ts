import { describe, expect, it } from 'vitest';
import { readMoodleContent } from '../../src/data/adapters';
import { inventoryMoodleBlocks } from '../../src/data/parity';
import { sourceFor, sourceMetadata } from '../../src/data/sources';
import { calendarData } from '../../src/lib/academic-calendar';
import { ACADEMIC_CALENDAR } from '../../src/data/academic-calendar';
import { loadCapture } from '../fixtures/load';
import { lang } from '../../src/i18n';
import { seasonLabel } from '../../src/data/names';

describe('Moodle parity and source adapters', () => {
  it('accounts for every captured dashboard block and retains an escape for new widgets', () => {
    const doc = loadCapture('my_');
    const inventory = inventoryMoodleBlocks(doc);
    expect(inventory).toHaveLength(doc.querySelectorAll('[data-block]').length);
    expect(inventory.find((i) => i.key === 'timeline')).toMatchObject({ disposition: 'mapped', path: '/my/?view=dossier#deadlines' });
    const widget = doc.createElement('section');
    widget.dataset.block = 'future_widget';
    widget.innerHTML = '<h2>New university service</h2>';
    doc.body.append(widget);
    expect(inventoryMoodleBlocks(doc).at(-1)).toMatchObject({ title: 'New university service', disposition: 'original', path: '/my/?kex=off' });
    const content = readMoodleContent(doc, new URL('https://moodle.taltech.ee/my/'), 1234);
    expect(content.notices.data.length).toBeGreaterThan(0);
    expect(content.notices.source).toMatchObject({ observedAt: 1234, domain: 'notices', kind: 'document' });
    expect(content.notices.data.every((b) => !/<script/i.test(b.html))).toBe(true);
  });
  it('distinguishes fresh, stale and absent authority even after refresh failure', () => {
    const source = sourceFor('grades:course:42', 1000);
    expect(source.originalPath).toBe('/grade/report/user/index.php?id=42&kex=off');
    expect(sourceMetadata(source, undefined).freshness).toBe('missing');
    expect(sourceMetadata(source, 100, false, false, 500).freshness).toBe('fresh');
    expect(sourceMetadata(source, 100, false, true, 1100)).toMatchObject({ freshness: 'stale', failed: true, observedAt: 100 });
    for (const [key, domain] of [['events', 'deadlines'], ['events:course:42', 'deadlines'], ['sums:42', 'summaries'], ['snav:42', 'navigation'], ['state:42', 'courses'], ['mycourses:all', 'courses']] as const) expect(sourceFor(key, 1000).domain).toBe(domain);
  });
  it('requires annual calendar review and never invents uncovered weeks', () => {
    const at = (date: string) => Date.parse(`${date}T12:00:00Z`) / 1000;
    expect(calendarData(at('2026-10-20'))).toMatchObject({ data: { kind: 'teaching', week: 8 }, maintenance: 'current' });
    expect(calendarData(at(ACADEMIC_CALENDAR.reviewBy)).maintenance).toBe('review-due');
    expect(calendarData(at('2027-08-30'))).toMatchObject({ data: { kind: 'unknown' }, maintenance: 'uncovered' });
    for (const term of ACADEMIC_CALENDAR.terms) {
      expect(calendarData(at(term.start)).data).toEqual({ kind: 'teaching', week: 1 });
      expect(calendarData(at(term.teachingEnd)).data).toEqual({ kind: 'teaching', week: 16 });
      expect(calendarData(at(term.end)).data).toEqual({ kind: 'exams' });
    }
  });
  it('uses the selected language for semester labels', () => {
    lang.value = 'et'; expect(seasonLabel('autumn')).toBe('SÜGIS');
    lang.value = 'en'; expect(seasonLabel('spring')).toBe('SPRING');
  });
});
