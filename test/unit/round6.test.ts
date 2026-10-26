import { createElement, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTrack, defaultOpen, shortLabel } from '../../src/data/labtrack';
import type { GroupModel, RowModel } from '../../src/data/topics';
import { scanNotices } from '../../src/content/sitenotice';
import { DEFAULT_READER, normalizeSettings } from '../../src/lib/settings';
import * as previews from '../../src/data/repo/preview';
import { settings } from '../../src/state';
import { PreviewSheet } from '../../src/ui/components/PreviewSheet';

const row = (id: number, over: Partial<RowModel> = {}): RowModel => ({
  cm: { id, courseId: 2, sectionId: 3, sectionNumber: 1, name: `Item ${id}`, modname: 'page', url: `/mod/page/view.php?id=${id}`, uservisible: true, restricted: false, tracked: true },
  kind: 'material', format: 'PAGE', title: `Item ${id}`, label: 'PAGE', verb: 'open', locked: false, incomplete: true, typeName: 'Page', provisional: false, ...over,
});
const group = (id: number, title: string, done: number, total: number, rows: RowModel[] = []): GroupModel => ({
  section: { id, number: id, title, summaryHtml: '', visible: true, restricted: false } as GroupModel['section'], title, rows, done, total,
});

describe('lab track', () => {
  it('labels lab chips briefly, marks done, overdue and next, and opens only the next lab', () => {
    expect(shortLabel('Lab 3: GPIO and interrupts')).toBe('Lab 3');
    expect(shortLabel('3. praktikum – taimerid')).toBe('3. praktikum');
    expect(shortLabel('Week 12 recap and exam prep')).toBe('Week 12');
    expect(shortLabel('Introduction to the measuring kit')).toBe('Introduction to');
    const now = 1_800_000_000;
    const groups = [
      group(1, 'Lab 1', 2, 2),
      group(2, 'Lab 2', 0, 2, [row(20, { overdue: true, due: now - 100, dueText: 'Due Mon 5 Oct' })]),
      group(3, 'Lab 3', 0, 2, [row(30, { due: now + 100, dueText: 'Due Fri 9 Oct' })]),
      group(4, 'Lab 4', 0, 2),
    ];
    const track = buildTrack(groups, now);
    expect(track.map((i) => i.state)).toEqual(['done', 'overdue', 'next', 'todo']);
    expect(track[2]?.dueText).toBe('Due Fri 9 Oct');
    expect(defaultOpen(track)).toEqual([3]);
    // Without completion tracking the next lab is the first one whose deadline is ahead.
    const untracked = buildTrack([group(1, 'Lab 1', 0, 0, [row(1, { due: now - 50, incomplete: false })]), group(2, 'Lab 2', 0, 0, [row(2, { due: now + 50, incomplete: false })])], now);
    expect(untracked.map((i) => i.state)).toEqual(['todo', 'next']);
  });
});

describe('site notices', () => {
  it('lifts a foreign body-level notice and top-of-page alerts, never KEX, Moodle overlays or form errors', () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = `
      <div id="kex-root">Our own shell with plenty of text in it</div>
      <div class="toast-wrapper">A toast that has enough text to count</div>
      <div class="taltech-banner"><svg width="900"></svg><p><b>Tule õppima teadlikumalt!</b> E-kursus <a href="/course/view.php?id=9">„Teadlik õppija"</a> on valmis.</p></div>
      <div id="page-wrapper"><div id="page"><div id="topofscroll"><div class="alert alert-info">Moodle is down for maintenance on Sunday night.</div>
        <form><div class="alert alert-danger">This field is required for the form below.</div></form></div></div></div>`;
    const found = scanNotices(doc);
    expect(found.map((f) => f.notice.text)).toEqual([
      'Tule õppima teadlikumalt! E-kursus „Teadlik õppija" on valmis.',
      'Moodle is down for maintenance on Sunday night.',
    ]);
    expect(found[0]?.notice.html).toContain('/course/view.php?id=9"');
    expect(found[0]?.notice.html).not.toContain('<svg');
    expect(scanNotices(doc, false)).toHaveLength(1);
  });
});

describe('reader preferences and side panel', () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete document.documentElement.dataset.kexReader;
    vi.restoreAllMocks();
  });

  it('normalizes stored reader prefs', () => {
    expect(normalizeSettings({}).reader).toEqual(DEFAULT_READER);
    expect(normalizeSettings({ reader: { size: 9, width: 'huge', side: 0.1, mode: 'center' } }).reader).toEqual({ ...DEFAULT_READER, size: 4, side: 0.36, mode: 'center' });
    expect(normalizeSettings({ density: 'compact' }).density).toBe('compact');
  });

  it('opens as a non-modal side panel on a wide window: the page stays usable and makes room', async () => {
    vi.spyOn(previews, 'loadPreview').mockResolvedValue({ kind: 'article', html: '<h2>Notes</h2><p>Lab instructions</p>' });
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList));
    settings.value = { ...settings.value, reader: { ...DEFAULT_READER, mode: 'side', size: 3 } };
    document.body.innerHTML = '<div id="kex-root"><main><button id="origin">Lab notes</button><div id="mount"></div></main></div>';
    const mount = document.getElementById('mount')!;
    const props = { row: { ...row(7), title: 'Lab notes' }, pinned: false, onClose: vi.fn(), onOpen: vi.fn(), onPin: vi.fn(), onStep: vi.fn() };
    await act(async () => render(createElement(PreviewSheet, props), mount));
    await act(async () => { await Promise.resolve(); });
    const panel = document.querySelector<HTMLElement>('[data-kex-test="preview"]')!;
    expect(panel.dataset.mode).toBe('side');
    expect(panel.getAttribute('aria-modal')).toBeNull();
    expect(document.querySelector('main')!.hasAttribute('inert')).toBe(false);
    expect(document.documentElement.dataset.kexReader).toBe('side');
    expect(document.querySelector<HTMLElement>('.kex-reader')!.style.getPropertyValue('--kex-read-size')).toBe('20px');
    document.querySelector<HTMLElement>('[data-kex-test="reader-next"]')!.click();
    expect(props.onStep).toHaveBeenCalledWith(1);
    await act(async () => render(null, mount));
    expect(document.documentElement.dataset.kexReader).toBeUndefined();
  });
});

describe('web-service batches', () => {
  it('sends the calls Moodle skipped after a failing call again, so one unavailable function does not take the deadlines with it', async () => {
    const { WsClient } = await import('../../src/data/ws');
    const client = new WsClient();
    client.configure('https://moodle.example', 'key');
    const bodies: string[][] = [];
    client.setHttp(async (_url, init) => {
      const calls = JSON.parse(String(init?.body)) as { methodname: string }[];
      bodies.push(calls.map((c) => c.methodname));
      // Moodle's service.php: results up to and including the first exception, nothing after it.
      const out: unknown[] = [];
      for (const c of calls) {
        if (c.methodname === 'broken') { out.push({ error: true, exception: { errorcode: 'servicenotavailable', message: 'no' } }); break; }
        out.push({ error: false, data: c.methodname });
      }
      return new Response(JSON.stringify(out), { status: 200 });
    });
    const [a, b, c] = await Promise.allSettled([client.call('first'), client.call('broken'), client.call('events')]);
    expect(a).toEqual({ status: 'fulfilled', value: 'first' });
    expect(b.status).toBe('rejected');
    expect(c).toEqual({ status: 'fulfilled', value: 'events' });
    expect(bodies).toEqual([['first', 'broken', 'events'], ['events']]);
  });
});
