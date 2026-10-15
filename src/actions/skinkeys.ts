import type { MessageKey } from '../i18n';
import type { Binding } from '../lib/keys';
import { gotoNeighbour, pinPage, toggleDonePage } from './skin';
import { undoLast } from './undo';
import { skinPage } from '../state/skin';

/** Key bindings of activity pages (`[` `]` previous and next, `p`, `x`). Quiz attempts register none (focus mode). */

const d = (k: MessageKey): MessageKey => k;
const idle = (e: KeyboardEvent): boolean => !(e.target instanceof Element && e.target.closest('a[href], button, summary, iframe, select, [role="tab"]'));

export function activityBindings(): Binding[] {
  const b = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, when: Binding['when'] = () => true): Binding => ({
    keys, scope: 'activity', group: 'Course', description, run, when,
  });
  return [
    b('[', d('help.act.prev'), () => gotoNeighbour(-1)),
    b(']', d('help.act.next'), () => gotoNeighbour(1)),
    b('p', d('help.course.pin'), pinPage, idle),
    b('x', d('help.course.done'), toggleDonePage, (e) => idle(e) && !!skinPage.value?.manual),
    b('z', d('help.course.undo'), undoLast),
  ];
}

/** Focus mode keeps only the always-on keys (Ctrl+K and Alt+Shift+O are handled elsewhere). */
export function focusBindings(): Binding[] {
  return [];
}
