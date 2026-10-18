import { createElement, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openCm, openCmOriginal } from '../../src/actions/course';
import { openFeedItem } from '../../src/actions/workspace';
import { go } from '../../src/actions/navigate';
import * as previews from '../../src/data/repo/preview';
import type { RowModel } from '../../src/data/topics';
import { previewCmId } from '../../src/state/course';
import { wsPreview } from '../../src/state/workspace';
import { settings } from '../../src/state';
import { PreviewSheet } from '../../src/ui/components/PreviewSheet';

vi.mock('../../src/actions/navigate', () => ({ go: vi.fn() }));

const row = (modname = 'resource', id = 7): RowModel => ({
  cm: { id, courseId: 2, sectionId: 3, sectionNumber: 1, name: 'Lab notes', modname, url: `/mod/${modname}/view.php?id=${id}`, uservisible: true, restricted: false, tracked: false },
  kind: 'material', format: 'PDF', title: 'Lab notes', label: 'PDF', verb: 'open', locked: false, incomplete: false, typeName: 'File', provisional: false,
});

beforeEach(() => {
  previewCmId.value = undefined;
  wsPreview.value = undefined;
  settings.value = { ...settings.value, openInNewTab: 'external' };
});

afterEach(() => {
  const mount = document.getElementById('reader-mount');
  if (mount) act(() => render(null, mount));
  document.body.replaceChildren();
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('material opening', () => {
  it('opens a readable course material immediately without navigation, preserving explicit new tabs and native activities; Continue materials open in the Workspace reader', () => {
    const material = row();
    openCm(material);
    expect(previewCmId.value).toBe(material.cm.id);
    expect(go).not.toHaveBeenCalled();
    openCm(material, true);
    expect(go).toHaveBeenLastCalledWith(material.cm.url, true);
    openCm(row('assign'));
    expect(go).toHaveBeenLastCalledWith('/mod/assign/view.php?id=7', false);
    openCmOriginal(material);
    expect(go).toHaveBeenLastCalledWith(material.cm.url, false);
    vi.mocked(go).mockClear();
    previewCmId.value = undefined;
    openFeedItem({ type: 'continue', key: 'c9', item: { cmid: 9, courseId: 2, courseCode: 'ITI8801', courseName: 'Cloud', title: 'Slides', modname: 'resource', url: '/mod/resource/view.php?id=9', accessedAt: 1 } });
    expect(wsPreview.value?.cm.id).toBe(9);
    expect(previewCmId.value).toBeUndefined();
    expect(go).not.toHaveBeenCalled();
  });
});

describe('fullscreen material reader', () => {
  function fixture() {
    document.body.innerHTML = '<div id="kex-root"><header><button>Menu</button></header><main><button id="origin">Lab notes</button><div id="reader-mount"></div></main></div>';
    const origin = document.getElementById('origin')!;
    origin.focus();
    const mount = document.getElementById('reader-mount')!;
    const onClose = vi.fn(() => render(null, mount));
    const props = { row: row(), pinned: false, onClose, onOpen: vi.fn(), onPin: vi.fn() };
    return { origin, mount, onClose, props };
  }

  it('isolates sibling content, traps focus, closes with Escape, and restores focus and scroll', async () => {
    vi.spyOn(previews, 'loadPreview').mockResolvedValue({ kind: 'article', html: '<h2>Notes</h2><p>Lab instructions</p>' });
    const { origin, mount, onClose, props } = fixture();
    const main = document.querySelector('main')!;
    main.scrollTop = 217;
    document.body.style.overflow = 'clip';
    await act(async () => render(createElement(PreviewSheet, props), mount));
    await act(async () => { await Promise.resolve(); });
    const dialog = document.querySelector<HTMLElement>('[data-kex-test="preview"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(main.contains(dialog)).toBe(false);
    expect(main.hasAttribute('inert')).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(dialog);
    const close = dialog.querySelector<HTMLElement>('.kex-sheet__close')!;
    close.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    close.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(close);
    await act(async () => { dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(onClose).toHaveBeenCalledOnce();
    expect(main.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('clip');
    expect(document.activeElement).toBe(origin);
    expect(main.scrollTop).toBe(217);
  });

  it('keeps a skeleton and busy state until the document frame itself loads', async () => {
    // The DOM runner cannot render a PDF. Ignore its synthetic unsupported-frame error;
    // the load event below is the document becoming available to the user.
    const dispatch = HTMLIFrameElement.prototype.dispatchEvent;
    vi.spyOn(HTMLIFrameElement.prototype, 'dispatchEvent').mockImplementation(function (this: HTMLIFrameElement, event) {
      return event.type === 'error' ? true : dispatch.call(this, event);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(previews, 'loadPreview').mockResolvedValue({ kind: 'frame', src: new URL('/pluginfile.php/notes.pdf', location.href).href, download: '/notes.pdf?forcedownload=1', type: 'application/pdf' });
    const { mount, props } = fixture();
    await act(async () => render(createElement(PreviewSheet, props), mount));
    await act(async () => { await Promise.resolve(); });
    const body = document.querySelector('.kex-sheet__body')!;
    expect(document.querySelector('[data-kex-test="reader-skeleton"]')).not.toBeNull();
    expect(body.getAttribute('aria-busy')).toBe('true');
    const frame = document.querySelector<HTMLIFrameElement>('[data-kex-test="preview-frame"]')!;
    expect(document.activeElement).not.toBe(frame);
    await act(async () => { frame.dispatchEvent(new Event('load')); });
    expect(body.getAttribute('aria-busy')).toBe('false');
    expect(document.querySelector('[data-kex-test="reader-skeleton"]')).toBeNull();
    const original = document.querySelector<HTMLAnchorElement>('.kex-btn--sheet')!;
    expect(original.getAttribute('href')).toBe(props.row.cm.url);
    expect(original.target).toBe('_blank');
  });

  it('keeps the original link available when a material viewer fails', async () => {
    vi.spyOn(previews, 'loadPreview').mockResolvedValue({ kind: 'frame', src: new URL('/pluginfile.php/missing.pdf', location.href).href, download: '/missing.pdf?forcedownload=1', type: 'application/pdf' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { mount, props } = fixture();
    await act(async () => render(createElement(PreviewSheet, props), mount));
    await act(async () => { await Promise.resolve(); });
    // The test DOM emits an iframe error because it cannot render a real document.
    expect(document.querySelector('[data-kex-test="preview-frame"]')).toBeNull();
    expect(document.querySelector('.kex-sheet__body')?.getAttribute('aria-busy')).toBe('false');
    expect(document.querySelector('.kex-sheet__state')).not.toBeNull();
    expect(document.querySelector('.kex-btn--sheet')?.getAttribute('href')).toBe(props.row.cm.url);
  });
});
