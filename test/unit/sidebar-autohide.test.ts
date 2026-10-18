import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toggleSidebar } from '../../src/actions/theme';
import { DEFAULT_SETTINGS } from '../../src/lib/settings';
import { quickSettingsOpen, settings, sidebarInstant, sidebarOverlay, userMenuOpen, viewportWidth } from '../../src/state';
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

describe('sidebar auto-hide (round 4 rules)', () => {
  it('auto-hide off at 960 px is the fixed rail: no edge zone, no hover expansion, the tip sits beside the hovered item', () => {
    settings.value = { ...DEFAULT_SETTINGS, sidebarAutoHide: false };
    viewportWidth.value = 960;
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('data-mode')).toBe('rail');
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(host.querySelector('[data-kex-test="sidebar-edge"]')).toBeNull();
    pointer(sidebar(), 'pointerenter');
    expect(sidebarOverlay.value).toBe(false);
    expect(host.querySelector('.kex-railtip')).toBeNull();
    const item = sidebar().querySelector<HTMLElement>('[data-kex-test="sb-workspace"]')!;
    pointer(item, 'pointerover');
    act(() => { vi.advanceTimersByTime(350); });
    expect(host.querySelector('.kex-railtip')?.textContent).toBe(item.dataset.tip);
    pointer(item, 'pointerout');
    expect(host.querySelector('.kex-railtip--on')).toBeNull();
  });

  it('below 760 px the sidebar is a drawer opened only from the menu button, with a backdrop', () => {
    for (const autoHide of [false, true]) {
      settings.value = { ...DEFAULT_SETTINGS, sidebarAutoHide: autoHide };
      viewportWidth.value = 700;
      act(() => render(h(Sidebar, {}), host));
      expect(sidebar().getAttribute('data-mode')).toBe('drawer');
      expect(sidebar().hasAttribute('inert')).toBe(true);
      expect(host.querySelector('[data-kex-test="sidebar-edge"]')).toBeNull();
      act(() => toggleSidebar(false));
      expect(host.querySelector('.kex-sb-backdrop')).not.toBeNull();
      act(() => toggleSidebar(false));
      act(() => render(null, host));
    }
  });

  it('a pointer reveal peeks over the page without dimming it and closes shortly after the pointer leaves', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter');
    expect(sidebar().getAttribute('data-open')).toBe('true');
    expect(sidebar().getAttribute('data-peek')).toBe('true');
    expect(host.querySelector('.kex-sb-backdrop')).toBeNull();
    pointer(sidebar(), 'pointerleave');
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(false);
  });

  it('a menu-button or Ctrl+B open dims the page with a backdrop and moves focus into the menu', () => {
    act(() => render(h(Sidebar, {}), host));
    act(() => toggleSidebar(true));
    expect(sidebar().getAttribute('data-peek')).toBeNull();
    expect(host.querySelector('.kex-sb-backdrop')).not.toBeNull();
    expect(sidebar().contains(document.activeElement)).toBe(true);
    act(() => { (host.querySelector('.kex-sb-backdrop') as HTMLElement).click(); });
    expect(sidebarOverlay.value).toBe(false);
  });

  it('turning auto-hide off from its own quick settings closes the peek once the popover closes', () => {
    act(() => render(h(Sidebar, {}), host));
    pointer(edge(), 'pointerenter');
    act(() => { quickSettingsOpen.value = true; });
    act(() => { settings.value = { ...settings.value, sidebarAutoHide: false }; });
    expect(sidebarOverlay.value).toBe(true);
    act(() => { quickSettingsOpen.value = false; });
    act(() => { vi.advanceTimersByTime(300); });
    expect(sidebarOverlay.value).toBe(false);
    expect(sidebar().getAttribute('data-peek')).toBeNull();
  });
});
