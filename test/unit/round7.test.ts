import { createElement, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LabTrackItem } from '../../src/data/labtrack';
import type { GroupModel, RowModel } from '../../src/data/topics';
import { liveNotices, sameNotice, scanNotices, watchLiveNotices } from '../../src/content/sitenotice';
import { restoreScroll } from '../../src/fx/navigation';
import { DEFAULT_READER } from '../../src/lib/settings';
import * as previews from '../../src/data/repo/preview';
import { settings } from '../../src/state';
import { labOpen } from '../../src/state/course';
import { PreviewSheet } from '../../src/ui/components/PreviewSheet';
import { SubsectionCard } from '../../src/ui/components/SubsectionCard';

const row = (id: number, over: Partial<RowModel> = {}): RowModel => ({
  cm: { id, courseId: 2, sectionId: 3, sectionNumber: 1, name: `Item ${id}`, modname: 'page', url: `/mod/page/view.php?id=${id}`, uservisible: true, restricted: false, tracked: true },
  kind: 'material', format: 'PAGE', title: `Item ${id}`, label: 'PAGE', verb: 'open', locked: false, incomplete: true, typeName: 'Page', provisional: false, ...over,
});
const group = (id: number, title: string, done: number, total: number, rows: RowModel[] = []): GroupModel => ({
  section: { id, number: id, title, summaryHtml: '', visible: true, restricted: false } as GroupModel['section'], title, rows, done, total,
});

/** Run every queued animation frame (and the ones they queue) up to `limit` rounds. */
function frames(limit = 10): () => void {
  const queue: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { queue.push(cb); return queue.length; });
  return () => {
    for (let i = 0; i < limit && queue.length; i++) queue.splice(0).forEach((cb) => cb(performance.now()));
  };
}

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.kexReader;
  vi.restoreAllMocks();
});

describe('scroll restore (Back, Forward, Reload)', () => {
  it('scrolls at once when the content is already there (a cached course), instead of skipping the restore', () => {
    document.body.innerHTML = '<main id="kex-main"></main>';
    const flush = frames();
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    restoreScroll(700, () => true);
    flush();
    expect(to).toHaveBeenCalledWith({ top: 700, left: 0, behavior: 'instant' });
    expect(document.getElementById('kex-main')!.style.minHeight).toBe('');
  });

  it('holds the page tall enough while the skeleton is short, then lets go once the content is in', () => {
    document.body.innerHTML = '<main id="kex-main"></main>';
    const flush = frames(1);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    let ready = false;
    restoreScroll(500, () => ready);
    flush();
    const main = document.getElementById('kex-main')!;
    expect(main.style.minHeight).toBe(`${500 + window.innerHeight}px`);
    ready = true;
    flush();
    expect(main.style.minHeight).toBe('');
  });

  it('moves the hold to the view that replaces a skeleton, so the page is not cut short in between', () => {
    document.body.innerHTML = '<main id="kex-main" class="skeleton"></main>';
    const flush = frames(1);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    let ready = false;
    restoreScroll(500, () => ready);
    flush();
    const skeleton = document.getElementById('kex-main')!;
    skeleton.remove();
    document.body.innerHTML = '<main id="kex-main"></main>';
    flush();
    const view = document.getElementById('kex-main')!;
    expect(view.style.minHeight).toBe(`${500 + window.innerHeight}px`);
    ready = true;
    flush();
    expect(view.style.minHeight).toBe('');
  });
});

describe('site notices (round 7)', () => {
  it('lifts a notice only where a card will show it (not on a quiz attempt)', () => {
    document.body.innerHTML = '<div class="ttu-teade"><p>Tule õppima teadlikumalt! E-kursus on valmis ja ootab Sind osalema!</p></div>';
    liveNotices.value = [];
    let shown = false;
    const stop = watchLiveNotices(() => false, () => shown);
    const banner = document.querySelector('.ttu-teade')!;
    expect(banner.classList.contains('kex-lifted')).toBe(false);
    stop();
    shown = true;
    const again = watchLiveNotices(() => false, () => shown);
    expect(banner.classList.contains('kex-lifted')).toBe(true);
    expect(liveNotices.value).toHaveLength(1);
    again();
    liveNotices.value = [];
  });

  it('reads Moodle\'s top-of-body slot, skips Boost\'s drawers, and never takes an editor or dialog for a notice', () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = `
      <div class="tox tox-silver-sink">TinyMCE floating toolbar with a lot of words in it</div>
      <div role="dialog">Insert link: paste the address of the page you want to link</div>
      <div id="page-wrapper">
        <div class="tt-notice"><svg viewBox="0 0 100 100"></svg><p><b>Tule õppima teadlikumalt!</b> E-kursus „Teadlik õppija" on valmis!</p></div>
        <nav class="navbar">Navigation bar with enough text to count as a notice</nav>
        <div id="theme_boost-drawers-courseindex" class="drawer">Course index with plenty of text inside</div>
        <div id="page"><div class="alert">This alert belongs to the page, not the site.</div></div>
      </div>`;
    const found = scanNotices(doc, false);
    expect(found.map((f) => f.notice.text)).toEqual(['Tule õppima teadlikumalt! E-kursus „Teadlik õppija" on valmis!']);
    expect(found[0]?.notice.html).not.toContain('<svg');
  });

  it('treats two wordings of one message as one notice, and two notices that only open alike as two', () => {
    const a = { text: 'Tule õppima teadlikumalt! E-kursus „Teadlik õppija" on valmis ja ootab Sind osalema!' };
    const b = { text: 'Tule  õppima teadlikumalt! E-kursus „Teadlik õppija” on valmis ja ootab Sind osalema! Avasta tõhusa õppimise võimalusi.' };
    expect(sameNotice(a, b)).toBe(true);
    expect(sameNotice({ text: 'Moodle is down for maintenance on Sunday night.' }, a)).toBe(false);
    expect(sameNotice({ text: 'Planned maintenance: Moodle is unavailable on Sunday 3 November, 20:00-23:00.' }, { text: 'Planned maintenance: Moodle is unavailable on Sunday 10 November, 20:00-23:00.' })).toBe(false);
  });

  it('leaves hidden templates and the live maintenance countdown alone', () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = `
      <div id="page-wrapper">
        <div class="eupopup-markup d-none">This website uses cookies to ensure you get the best experience on our website.</div>
        <div id="maintenancewarning" class="box alert alert-danger">This site will be switched to maintenance mode in 0:04:59</div>
        <nav class="navbar">Navigation</nav>
        <div id="page"></div>
      </div>`;
    expect(scanNotices(doc, false)).toEqual([]);
  });
});

describe('labs on the one-page course (round 10)', () => {
  const items = (): LabTrackItem[] => [
    { group: group(1, 'Lab 1: GPIO and interrupts', 2, 2), state: 'done', short: 'Lab 1' },
    { group: group(2, 'Lab 2: Timers', 0, 3), state: 'overdue', short: 'Lab 2', dueText: 'Fri 18 Sept' },
    { group: group(3, 'Lab 3: UART', 0, 3), state: 'next', short: 'Lab 3', dueText: 'Fri 25 Sept' },
  ];

  it('every lab is on the page: a finished one starts folded, the rest open, and the reader’s own choice wins', () => {
    const [done, overdue, next] = items();
    expect(labOpen(1, done, new Map())).toBe(false);
    expect(labOpen(2, overdue, new Map())).toBe(true);
    expect(labOpen(3, next, new Map())).toBe(true);
    expect(labOpen(1, done, new Map([[1, true]]))).toBe(true);
    expect(labOpen(3, next, new Map([[3, false]]))).toBe(false);
  });

  it('a lab’s header folds and unfolds it, with its state and deadline beside the title', async () => {
    document.body.innerHTML = '<ul id="mount"></ul>';
    const mount = document.getElementById('mount')!;
    const onToggle = vi.fn();
    const lab = items()[1]!;
    await act(async () => render(createElement(SubsectionCard, { group: lab.group, index: 2, lab, open: false, onToggle, children: [] }), mount));
    expect(mount.querySelector('.kex-groupcard__due--late')?.textContent).toBe('Fri 18 Sept');
    expect(mount.querySelector('.kex-groupcard__fold')?.hasAttribute('inert')).toBe(true);
    mount.querySelector<HTMLButtonElement>('.kex-groupcard__toggle')!.click();
    expect(onToggle).toHaveBeenCalledWith(true);
    await act(async () => render(null, mount));
  });
});

describe('side reader keeps the row being read in place', () => {
  it('scrolls by however far the narrower column moved that row, on open and on close', async () => {
    vi.spyOn(previews, 'loadPreview').mockResolvedValue({ kind: 'article', html: '<p>Lab instructions</p>' });
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList));
    settings.value = { ...settings.value, reader: { ...DEFAULT_READER, mode: 'side' } };
    document.body.innerHTML = '<div id="kex-root"><main><div data-kex-row="7">Lab notes</div><div id="mount"></div></main></div>';
    const target = document.querySelector<HTMLElement>('[data-kex-row="7"]')!;
    // The row sits 80 px lower while the side panel is open (rows above it wrap onto more lines).
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => ({ top: document.documentElement.dataset.kexReader === 'side' ? 380 : 300 } as DOMRect));
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const mount = document.getElementById('mount')!;
    const props = { row: { ...row(7), title: 'Lab notes' }, pinned: false, onClose: vi.fn(), onOpen: vi.fn(), onPin: vi.fn(), onStep: vi.fn() };
    await act(async () => render(createElement(PreviewSheet, props), mount));
    expect(to).toHaveBeenCalledWith(expect.objectContaining({ top: window.scrollY + 80, behavior: 'instant' }));
    to.mockClear();
    await act(async () => render(null, mount));
    expect(to).toHaveBeenCalledWith(expect.objectContaining({ top: window.scrollY - 80, behavior: 'instant' }));
  });
});
