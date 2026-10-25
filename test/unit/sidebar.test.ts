import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toggleSidebar } from '../../src/actions/theme';
import { DEFAULT_SETTINGS } from '../../src/lib/settings';
import type { EffectiveRoute } from '../../src/content/router';
import { quickSettingsOpen, route, settings, sidebarInstant, sidebarOverlay, userMenuOpen, viewportWidth } from '../../src/state';
import { Sidebar } from '../../src/ui/shell/Sidebar';

vi.mock('../../src/data/repo/counts', () => ({ countsStore: () => ({ value: { value: null } }) }));

let host: HTMLDivElement;
const sidebar = (): HTMLElement => host.querySelector('[data-kex-test="sidebar"]')!;
const pointer = (node: HTMLElement, type: string, pointerType = 'mouse'): void => {
  act(() => { node.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: true })); });
};

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  settings.value = { ...DEFAULT_SETTINGS };
  viewportWidth.value = 1440;
  sidebarOverlay.value = false;
  sidebarInstant.value = false;
  quickSettingsOpen.value = false;
  userMenuOpen.value = false;
});

afterEach(() => {
  route.value = null;
  act(() => render(null, host));
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

describe('sidebar (round 7: no auto-hide)', () => {
  it('the full sidebar is always there: no edge zone, the pointer never opens an overlay, the menu button collapses it to the rail', () => {
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('data-mode')).toBe('full');
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(sidebar().hasAttribute('data-auto-hide')).toBe(false);
    expect(host.querySelector('[data-kex-test="sidebar-edge"]')).toBeNull();
    pointer(sidebar(), 'pointerenter');
    expect(sidebarOverlay.value).toBe(false);
    act(() => toggleSidebar(false));
    expect(settings.value.sidebarCollapsed).toBe(true);
    expect(sidebar().getAttribute('data-mode')).toBe('rail');
    expect(host.querySelector('.kex-sb-backdrop')).toBeNull();
    act(() => toggleSidebar(false));
    expect(settings.value.sidebarCollapsed).toBe(false);
    expect(sidebar().getAttribute('data-mode')).toBe('full');
  });

  it('an old stored auto-hide value is dropped', async () => {
    const { normalizeSettings } = await import('../../src/lib/settings');
    expect('sidebarAutoHide' in normalizeSettings({ sidebarAutoHide: true })).toBe(false);
  });

  it('at 960 px it is the fixed rail: no hover expansion, the tip sits beside the hovered item', () => {
    viewportWidth.value = 960;
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('data-mode')).toBe('rail');
    expect(sidebar().hasAttribute('inert')).toBe(false);
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

  it('the rail menu button or Ctrl+B opens the full menu over the page with a backdrop and moves focus into it', () => {
    viewportWidth.value = 960;
    act(() => render(h(Sidebar, {}), host));
    act(() => toggleSidebar(true));
    expect(sidebar().getAttribute('data-open')).toBe('true');
    expect(host.querySelector('.kex-sb-backdrop')).not.toBeNull();
    expect(sidebar().contains(document.activeElement)).toBe(true);
    expect(host.querySelector('.kex-railtip')).toBeNull();
    act(() => { (host.querySelector('.kex-sb-backdrop') as HTMLElement).click(); });
    expect(sidebarOverlay.value).toBe(false);
  });

  it('below 760 px the sidebar is a drawer opened only from the menu button, with a backdrop', () => {
    viewportWidth.value = 700;
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('data-mode')).toBe('drawer');
    expect(sidebar().hasAttribute('inert')).toBe(true);
    pointer(sidebar(), 'pointerenter');
    expect(sidebarOverlay.value).toBe(false);
    act(() => toggleSidebar(false));
    expect(host.querySelector('.kex-sb-backdrop')).not.toBeNull();
    expect(sidebar().hasAttribute('inert')).toBe(false);
    act(() => toggleSidebar(false));
    expect(sidebarOverlay.value).toBe(false);
  });

  it('on a quiz attempt (rail forced) the menu button opens the menu over the page and leaves the saved setting alone', () => {
    route.value = { key: 'quiz-focus', mode: 'skin', effective: 'skin' } as EffectiveRoute;
    settings.value = { ...DEFAULT_SETTINGS, sidebarCollapsed: true };
    act(() => render(h(Sidebar, {}), host));
    expect(sidebar().getAttribute('data-mode')).toBe('rail');
    act(() => toggleSidebar(false));
    expect(sidebarOverlay.value).toBe(true);
    expect(settings.value.sidebarCollapsed).toBe(true);
    act(() => toggleSidebar(false));
    expect(sidebarOverlay.value).toBe(false);
    expect(settings.value.sidebarCollapsed).toBe(true);
  });
});
