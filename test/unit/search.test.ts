import { describe, expect, it } from 'vitest';
import { matchText, norm } from '../../src/search/fuzzy';
import { search, parseQuery, type Entry } from '../../src/search';

describe('fuzzy matching', () => {
  it('is diacritic and case insensitive', () => {
    expect(norm('Õppimine ÕIGUSE')).toBe('oppimine oiguse');
    expect(matchText('oppimine', 'Õppimine')?.score).toBe(120);
    expect(matchText('oiguse', 'Õiguse alused')?.score).toBe(100);
  });
  it('scores exact > prefix > word start > substring > subsequence', () => {
    const s = (q: string, t: string) => matchText(q, t)?.score ?? 0;
    expect(s('kubernetes', 'Kubernetes')).toBe(120);
    expect(s('kub', 'Kubernetes slides')).toBe(100);
    expect(s('sli', 'Kubernetes slides')).toBe(80);
    expect(s('ube', 'Kubernetes slides')).toBe(60);
    expect(s('kbs', 'Kubernetes slides')).toBeLessThan(30);
    expect(s('kbs', 'Kubernetes slides')).toBeGreaterThan(0);
    expect(matchText('zzz', 'Kubernetes')).toBeNull();
  });
  it('maps highlights back onto the original text', () => {
    const m = matchText('oppi', 'Õppimine');
    expect(m?.ranges).toEqual([[0, 4]]);
  });
  it('multi-word queries need every word', () => {
    expect(matchText('cloud dev', 'Cloud & DevOps')).not.toBeNull();
    expect(matchText('cloud zzz', 'Cloud & DevOps')).toBeNull();
  });
});

const entry = (e: Partial<Entry> & Pick<Entry, 'id' | 'type' | 'title'>): Entry => ({ keywords: [], ...e });
const index: Entry[] = [
  entry({ id: 'c1', type: 'course', title: 'Cloud & DevOps', courseCode: 'ITI8801', courseId: 2, keywords: ['Cloud Architectures and DevOps (2026 autumn) (ITI8801)'] }),
  entry({ id: 'c2', type: 'course', title: 'IoT for Industry', courseCode: 'EMT0140', courseId: 3 }),
  entry({ id: 'c3', type: 'course', title: 'Digital State ICT', courseCode: 'ITB8833', courseId: 6 }),
  entry({ id: 'c4', type: 'course', title: 'Smart Networks', courseCode: 'IEE2630', courseId: 7 }),
  entry({ id: 'p1', type: 'page', title: 'Notifications' }),
  entry({ id: 'p2', type: 'page', title: 'Workspace' }),
  entry({ id: 'a1', type: 'action', title: 'Toggle theme', run: () => undefined }),
  entry({ id: 'pin1', type: 'pin', title: 'Kubernetes slides', courseCode: 'ITI8801', pinned: true }),
];

describe('palette search', () => {
  it('"iti" puts ITI8801 first', () => {
    const g = search(index, 'iti', { activeCourseId: null });
    expect(g[0]?.key).toBe('courses');
    expect(g[0]?.rows[0]?.entry.courseCode).toBe('ITI8801');
  });
  it('orders groups: courses before pages before actions; pins only on an empty query', () => {
    expect(search(index, '', { activeCourseId: null }).map((x) => x.key)).toEqual(['pins', 'courses', 'pages', 'actions']);
    expect(search(index, 't', { activeCourseId: null }).map((x) => x.key)).not.toContain('pins');
  });
  it('boosts the current course', () => {
    const g = search(index, 'i', { activeCourseId: 7 });
    expect(g[0]?.rows[0]?.entry.courseId).toBe(7);
  });
  it('supports > and @ prefixes', () => {
    expect(parseQuery('>theme')).toEqual({ text: 'theme', only: 'actions' });
    const g = search(index, '>theme', { activeCourseId: null });
    expect(g.map((x) => x.key)).toEqual(['actions']);
    expect(search(index, '@', { activeCourseId: null })[0]?.rows).toHaveLength(4);
  });
  it('caps each group at 8 rows', () => {
    const many = Array.from({ length: 20 }, (_, i) => entry({ id: `x${i}`, type: 'course', title: `Course ${i}`, courseCode: `AAA${1000 + i}` }));
    expect(search(many, 'course', { activeCourseId: null })[0]?.rows).toHaveLength(8);
  });
});
