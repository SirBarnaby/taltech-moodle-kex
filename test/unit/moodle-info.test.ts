import { signal } from '@preact/signals';
import { createElement, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { MoodleInfo } from '../../src/ui/components/MoodleInfo';
import type { DashboardContent } from '../../src/data/repo/dashboard';

const state = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('../../src/data/repo/dashboard', () => ({ dashboardStore: () => state.store }));
afterEach(() => { render(null, document.body); document.body.innerHTML = ''; });

it.each([false, true])('retains original Moodle widgets with notice present=%s', async (notice) => {
  state.store = {
    value: signal<DashboardContent>({
      blocks: notice ? [{ title: 'University notice', notice: true, html: '<p>Read this</p>' }] : [],
      inventory: [{ key: 'new_widget', title: 'New university service', disposition: 'original', path: '/my/?kex=off' }],
    }),
    status: signal('idle'), refresh: vi.fn().mockResolvedValue(undefined),
  };
  await act(async () => render(createElement(MoodleInfo, {}), document.body));
  const link = [...document.querySelectorAll('a')].find((a) => a.textContent === 'New university service');
  expect(link?.getAttribute('href')).toContain('/my/?kex=off');
  expect(document.querySelector('details')).not.toBeNull();
});
