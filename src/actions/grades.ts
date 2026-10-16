import type { MessageKey } from '../i18n';
import type { Binding } from '../lib/keys';
import { hash } from '../state';
import { grSel, grTab, visibleGrades, type GradesTab } from '../state/grades';
import { go } from './navigate';

/** Grade overview actions and keys (page-designs §8). */

const d = (k: MessageKey): MessageKey => k;
const interactive = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('a[href], button, summary, select, input, textarea, [role="tab"]');

export function setGradesTab(tab: GradesTab): void {
  const url = new URL(location.href);
  url.hash = tab === 'current' ? '' : `#${tab}`;
  history.replaceState(null, '', url);
  hash.value = location.hash;
  grSel.value = undefined;
}

function move(delta: 1 | -1): void {
  const list = visibleGrades.value;
  if (!list.length) return;
  const i = list.findIndex((r) => r.courseId === grSel.value);
  const next = list[Math.max(0, Math.min(list.length - 1, i < 0 ? 0 : i + delta))];
  if (!next) return;
  grSel.value = next.courseId;
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-gr="${next.courseId}"]`)?.focus());
}

const current = () => visibleGrades.value.find((r) => r.courseId === grSel.value) ?? visibleGrades.value[0];

export function gradesBindings(): Binding[] {
  const b = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, when: Binding['when'] = () => true): Binding => ({
    keys, scope: 'workspace', group: 'Workspace', description, run, when,
  });
  const onRow = (e: KeyboardEvent): boolean => !interactive(e.target) && !!(e.target as Element | null)?.closest?.('.kex-gr');
  return [
    b('j', d('help.ws.move'), () => move(1)),
    b('k', d('help.ws.move'), () => move(-1)),
    b('arrowdown', d('help.ws.move'), () => move(1), onRow),
    b('arrowup', d('help.ws.move'), () => move(-1), onRow),
    b('enter', d('help.ws.open'), () => {
      const r = current();
      if (r) go(r.href);
    }, (e) => !interactive(e.target) && !!current()),
    b('ctrl+enter', d('help.course.newtab'), () => {
      const r = current();
      if (r) go(r.href, true);
    }, (e) => !!current() && !(e.target instanceof HTMLInputElement)),
    b('o', d('help.course.newtab'), () => {
      const r = current();
      if (r) go(r.href, true);
    }, () => !!current()),
    b('1', d('help.gr.tabs'), () => setGradesTab('current')),
    b('2', d('help.gr.tabs'), () => setGradesTab('all')),
  ];
}

export { grTab };
