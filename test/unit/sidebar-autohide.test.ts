import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toggleSidebar } from '../../src/actions/theme';
import { DEFAULT_SETTINGS, normalizeSettings, readBootMirror, toBootMirror, writeBootMirror } from '../../src/lib/settings';
import { applyShellAttrs, shellAttrs, sidebarModeFor } from '../../src/lib/theme';
import { quickSettingsOpen, settings, sidebarInstant, sidebarOverlay, userMenuOpen, viewportWidth } from '../../src/state';
import { Header } from '../../src/ui/shell/Header';
import { Sidebar } from '../../src/ui/shell/Sidebar';

vi.mock('../../src/data/repo/counts', () => ({ countsStore: () => ({ value: { value: null } }) }));

let host: HTMLDivElement;
const sidebar = (): HTMLElement => host.querySelector('[data-kex-test="sidebar"]')!;
const edge = (): HTMLElement => host.querySelector('[data-kex-test="sidebar-edge"]')!;
const pointer = (node: HTMLElement, type: string, pointerType = 'mouse'): void => {
  act(() => { node.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: true })); });
};

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  settings.value = { ...DEFAULT_SETTINGS, sidebarAutoHide: true };
  viewportWidth.value = 1440;
  sidebarOverlay.value = false;
  sidebarInstant.value = false;
  quickSettingsOpen.value = false;
  userMenuOpen.value = false;
});

afterEach(() => {
  act(() => render(null, host));
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

describe('sidebar auto-hide', () => {
  it('defaults to auto-hide, persists the preference in the first-paint mirror, and rejects invalid values', () => {
    expect(normalizeSettings({}).sidebarAutoHide).toBe(true);
    expect(normalizeSettings({ sidebarAutoHide: 'false' }).sidebarAutoHide).toBe(true);
    const saved = normalizeSettings({ sidebarAutoHide: false });
    writeBootMirror(toBootMirror(saved));
    expect(readBootMirror().sidebarAutoHide).toBe(false);
  });

  it('sets the zero-width layout attribute and retains the original responsive modes', () => {
    const attrs = shellAttrs({ ...DEFAULT_SETTINGS, sidebarAutoHide: true }, 960);
    applyShellAttrs(document.documentElement, attrs);
    expect(document.documentElement.dataset.kexSidebarAutoHide).toBe('true');
    expect([759, 760, 1099, 1100].map((width) => sidebarModeFor(width, false))).toEqual(['drawer', 'rail', 'rail', 'full']);
  });

  it('keeps the hidden sidebar inert and reveals its full menu from the pointer edge without changing the layout mode', () => {
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('aria-hidden')).toBe('true');
    expect(sidebar().hasAttribute('inert')).toBe(true);
    pointer(edge(), 'pointerenter');
    expect(sidebarOverlay.value).toBe(true);
    expect(sidebar().getAttribute('data-open')).toBe('true');
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(sidebar().getAttribute('data-mode')).toBe('full');
  });

  it('does not dim the page for a pointer reveal, but does for a click or keyboard open', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter');
    expect(sidebarOverlay.value).toBe(true);
    expect(host.querySelector('.kex-sb-backdrop')).toBeNull();
    expect(sidebar().getAttribute('data-peek')).toBe('true');
    pointer(sidebar(), 'pointerleave');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(false);
    act(() => { sidebarOverlay.value = true; });
    expect(host.querySelector('.kex-sb-backdrop')).not.toBeNull();
    expect(sidebar().getAttribute('data-peek')).toBeNull();
  });

  it('keeps the dim backdrop in drawer mode even for a pointer reveal', () => {
    viewportWidth.value = 600;
    act(() => render(h(Sidebar, {}), host));
    act(() => { sidebarOverlay.value = true; });
    expect(host.querySelector('.kex-sb-backdrop')).not.toBeNull();
  });

  it('gives every nav row the compact style and lays the footer links out in one row before the user row', () => {
    act(() => render(h(Sidebar, {}), host));
    const rows = [...sidebar().querySelectorAll<HTMLElement>('.kex-sb__nav .kex-sb__row')];
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.classList.contains('kex-sb__row--sub'))).toBe(true);
    const links = sidebar().querySelectorAll('.kex-sb__foot > .kex-sb__links > li');
    expect(links).toHaveLength(3);
    expect(sidebar().querySelector('.kex-sb__foot > .kex-sb__links + .kex-sb__user')).not.toBeNull();
  });

  it('lets a touch user open the menu explicitly instead of treating a tap as hover', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter', 'touch');
    expect(sidebarOverlay.value).toBe(false);
    act(() => { sidebarOverlay.value = true; });
    pointer(sidebar(), 'pointerleave', 'touch');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(true);
  });

  it('waits briefly after pointer leave and cancels the close when the pointer comes back', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter');
    pointer(sidebar(), 'pointerenter');
    pointer(sidebar(), 'pointerleave');
    act(() => { vi.advanceTimersByTime(100); });
    expect(sidebarOverlay.value).toBe(true);
    pointer(sidebar(), 'pointerenter');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(true);
    pointer(sidebar(), 'pointerleave');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(false);
  });

  it('holds the menu while keyboard focus is inside it, then closes after focus leaves', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter');
    const link = sidebar().querySelector<HTMLAnchorElement>('a')!;
    act(() => link.focus());
    pointer(sidebar(), 'pointerleave');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(true);
    act(() => link.blur());
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(false);
  });

  it('holds the menu while a sidebar popover is open and closes when that interaction ends', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter');
    act(() => { quickSettingsOpen.value = true; });
    pointer(sidebar(), 'pointerleave');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(true);
    act(() => { quickSettingsOpen.value = false; });
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(false);
  });

  it('provides a visible header toggle on wide screens for touch and keyboard users', () => {
    act(() => render(h(Header, {}), host));
    const toggle = host.querySelector<HTMLButtonElement>('[data-kex-test="sidebar-toggle"]');
    expect(toggle).not.toBeNull();
    act(() => toggle!.click());
    expect(sidebarOverlay.value).toBe(true);
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    act(() => toggle!.click());
    expect(sidebarOverlay.value).toBe(false);
  });

  it('keeps a pinned full sidebar visible when auto-hide is disabled', () => {
    settings.value = { ...DEFAULT_SETTINGS, sidebarAutoHide: false };
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('aria-hidden')).toBeNull();
    expect(host.querySelector('[data-kex-test="sidebar-edge"]')).toBeNull();
  });

  it('keeps the menu available when auto-hide is enabled from its own quick settings', () => {
    settings.value = { ...DEFAULT_SETTINGS, sidebarAutoHide: false };
    act(() => render(h(Sidebar, {}), host));
    act(() => { quickSettingsOpen.value = true; });
    act(() => { settings.value = { ...settings.value, sidebarAutoHide: true }; });
    expect(sidebarOverlay.value).toBe(true);
    expect(sidebar().getAttribute('aria-hidden')).toBeNull();
  });

  it('opens immediately for a keyboard action, moves focus into the menu, and restores it when closed', () => {
    act(() => render(h('div', {}, h(Sidebar, {}), h(Header, {})), host));
    act(() => toggleSidebar(true));
    expect(sidebar().getAttribute('data-instant')).toBe('true');
    expect(sidebar().contains(document.activeElement)).toBe(true);
    act(() => toggleSidebar(true));
    expect(document.activeElement).toBe(host.querySelector('[data-kex-test="sidebar-toggle"]'));
    expect(sidebar().hasAttribute('inert')).toBe(true);
  });

  it('retains full/rail pinning controls when auto-hide is disabled', () => {
    settings.value = { ...DEFAULT_SETTINGS, sidebarAutoHide: false };
    act(() => toggleSidebar(true));
    expect(settings.value.sidebarCollapsed).toBe(true);
    act(() => toggleSidebar(true));
    expect(settings.value.sidebarCollapsed).toBe(false);
    viewportWidth.value = 960;
    act(() => toggleSidebar(true));
    expect(sidebarOverlay.value).toBe(true);
  });
});
