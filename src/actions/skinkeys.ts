import type { MessageKey } from '../i18n';
import type { Binding } from '../lib/keys';
import { copyUrlTarget, gotoNeighbour, pinPage, toggleDonePage } from './skin';
import { undoLast } from './undo';
import { skinPage } from '../state/skin';

/** Key bindings of activity pages (`[` `]` previous and next, `p`, `x`). Quiz attempts register none (focus mode). */

const d = (k: MessageKey): MessageKey => k;
const idle = (e: KeyboardEvent): boolean => !(e.target instanceof Element && e.target.closest('a[href], button, summary, iframe, select, [role="tab"]'));

/** The primary submit button of the page's Moodle form (assignment submission, forum post, ...). */
const submitButton = (): HTMLElement | null => document.querySelector<HTMLElement>('form.mform #id_submitbutton, form.mform input[type="submit"].btn-primary, form.mform button[type="submit"].btn-primary');
const isBook = (): boolean => document.body.classList.contains('path-mod-book');
const clickBookNav = (sel: string): void => document.querySelector<HTMLElement>(sel)?.click();

export function activityBindings(): Binding[] {
  const b = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, when: Binding['when'] = () => true): Binding => ({
    keys, scope: 'activity', group: 'Course', description, run, when,
  });
  return [
    b('[', d('help.act.prev'), () => gotoNeighbour(-1)),
    b(']', d('help.act.next'), () => gotoNeighbour(1)),
    b('p', d('help.course.pin'), pinPage, idle),
    b('x', d('help.course.done'), toggleDonePage, (e) => idle(e) && !!skinPage.value?.manual),
    b('c', d('help.act.copy'), () => void copyUrlTarget(), (e) => idle(e) && !!skinPage.value?.urlTarget),
    b('arrowleft', d('help.act.chapterPrev'), () => clickBookNav('.tertiary-navigation a.btn-previous'), (e) => idle(e) && isBook()),
    b('arrowright', d('help.act.chapterNext'), () => clickBookNav('.tertiary-navigation a.btn-next'), (e) => idle(e) && isBook()),
    {
      keys: 'ctrl+enter', scope: 'activity', group: 'Course', description: d('help.act.submit'), allowInInput: true,
      when: () => !!submitButton(), run: () => submitButton()?.click(),
    },
    b('z', d('help.course.undo'), undoLast),
  ];
}

/** Focus mode keeps only the always-on keys (Ctrl+K and Alt+Shift+O are handled elsewhere). */
export function focusBindings(): Binding[] {
  return [];
}

/**
 * The TinyMCE and Atto editors type inside their own (same-origin) iframe, where the page-level key listener does not see events.
 * Ctrl+Enter in such a frame submits the form too. Returns a disposer.
 */
export function attachEditorFrameKeys(): () => void {
  const attached = new WeakSet<Document>();
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const btn = submitButton();
    if (!btn) return;
    e.preventDefault();
    btn.click();
  };
  const hook = (frame: HTMLIFrameElement): void => {
    try {
      const doc = frame.contentDocument;
      if (doc && !attached.has(doc)) {
        attached.add(doc);
        doc.addEventListener('keydown', onKey, true);
      }
    } catch {
      /* cross-origin frame: nothing to do */
    }
  };
  const scan = (): void => document.querySelectorAll<HTMLIFrameElement>('form.mform iframe').forEach((f) => {
    hook(f);
    f.addEventListener('load', () => hook(f), { once: true });
  });
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}
