import type { MessageKey } from '../i18n';
import type { Binding } from '../lib/keys';
import { closePreview, copyLink, currentRow, enterRows, enterTopics, moveRow, moveTopic, openCm, previewCm, setTopic, stepPreview, togglePin, toggleDone, undoLast, topicHash } from './course';
import { stepReaderSize } from './reader';
import { focusZone, previewCmId, topicNumber, topics } from '../state/course';

/** Course-page and preview key bindings (happy-path §3 and §7). Registered while the course view is mounted. */

const d = (k: MessageKey): MessageKey => k;

const interactive = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('a[href], button, summary, iframe, select, [role="tab"]');
const inLists = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('.kex-outline, .kex-cbar__topics, .kex-rows');
const bodyLike = (t: EventTarget | null): boolean => !(t instanceof Element) || t === document.body || t === document.documentElement || t.id === 'kex-root';
const idle = (): boolean => previewCmId.value === undefined;

/** j/k work on the page or in the lists; the arrow keys only inside the lists (they scroll the page otherwise). */
const listKey = (e: KeyboardEvent): boolean => idle() && (e.key.length === 1 ? true : inLists(e.target));

function step(delta: 1 | -1): void {
  if (focusZone.value === 'rows') moveRow(delta);
  else moveTopic(delta);
}

export function courseBindings(): Binding[] {
  const b = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, when: Binding['when'] = idle): Binding => ({
    keys, scope: 'course', group: 'Course', description, run, when,
  });
  return [
    b('j', d('help.course.topics'), () => step(1), listKey),
    b('k', d('help.course.topics'), () => step(-1), listKey),
    b('arrowdown', d('help.course.topics'), () => step(1), listKey),
    b('arrowup', d('help.course.topics'), () => step(-1), listKey),
    b('l', d('help.course.focus'), enterRows, idle),
    b('arrowright', d('help.course.focus'), enterRows, (e) => idle() && inLists(e.target)),
    b('h', d('help.course.focus'), enterTopics, idle),
    b('arrowleft', d('help.course.focus'), enterTopics, (e) => idle() && inLists(e.target)),
    b('g t', d('help.course.gotopics'), enterTopics),
    b('0', d('help.course.info'), () => setTopic(0, { focus: true })),
    b('enter', d('help.course.open'), () => {
      const row = currentRow();
      if (row && !row.locked && row.kind !== 'note') openCm(row);
    }, (e) => idle() && !interactive(e.target) && focusZone.value === 'rows' && !!currentRow()),
    b('ctrl+enter', d('help.course.newtab'), () => {
      const row = currentRow();
      if (row && !row.locked) openCm(row, true);
    }, (e) => idle() && !!currentRow() && (inLists(e.target) || bodyLike(e.target))),
    b('o', d('help.course.newtab'), () => {
      const row = currentRow();
      if (row && !row.locked) openCm(row, true);
    }, (e) => idle() && !!currentRow() && (inLists(e.target) || bodyLike(e.target))),
    b('space', d('help.course.preview'), () => {
      const row = currentRow();
      if (row) previewCm(row);
    }, (e) => idle() && !interactive(e.target) && focusZone.value === 'rows' && !!currentRow()),
    b('p', d('help.course.pin'), () => {
      const row = currentRow();
      if (row) void togglePin(row);
    }, (e) => idle() && !!currentRow() && (inLists(e.target) || bodyLike(e.target))),
    b('x', d('help.course.done'), () => {
      const row = currentRow();
      if (row?.manual) void toggleDone(row);
    }, (e) => idle() && (inLists(e.target) || bodyLike(e.target))),
    b('c', d('help.course.copy'), () => {
      const row = currentRow();
      if (row) void copyLink(row);
    }, (e) => idle() && !!currentRow() && (inLists(e.target) || bodyLike(e.target))),
    b('z', d('help.course.undo'), undoLast, () => true),
    b('[', d('help.course.topicStep'), () => moveTopic(-1), idle),
    b(']', d('help.course.topicStep'), () => moveTopic(1), idle),
  ];
}

/** Keys that belong to a control inside the reader (the Aa menu's radio groups, the resize handle). */
const inReaderControl = (t: EventTarget | null): boolean => t instanceof Element && !!t.closest('.kex-readmenu, .kex-reader__resize, [role="radiogroup"]');

export function previewBindings(): Binding[] {
  const p = (keys: string, description: MessageKey, run: (e: KeyboardEvent) => void, guard: (e: KeyboardEvent) => boolean = () => true): Binding => ({
    keys, scope: 'preview', group: 'Course', description, run, when: (e) => previewCmId.value !== undefined && guard(e),
  });
  return [
    p('j', d('help.preview.step'), () => stepPreview(1), (e) => !inReaderControl(e.target)),
    p('k', d('help.preview.step'), () => stepPreview(-1), (e) => !inReaderControl(e.target)),
    p('arrowdown', d('help.preview.step'), () => stepPreview(1), (e) => !inReaderControl(e.target)),
    p('arrowup', d('help.preview.step'), () => stepPreview(-1), (e) => !inReaderControl(e.target)),
    p('escape', d('help.escape'), closePreview),
    p('[', d('help.preview.size'), () => stepReaderSize(-1), (e) => !inReaderControl(e.target)),
    p(']', d('help.preview.size'), () => stepReaderSize(1), (e) => !inReaderControl(e.target)),
    p('enter', d('help.course.open'), () => {
      const row = currentRow();
      if (row) openCm(row);
    }, (e) => !interactive(e.target)),
    p('p', d('help.course.pin'), () => {
      const row = currentRow();
      if (row) void togglePin(row);
    }),
  ];
}

/** Set the topic from a binding-free place (used by the hero "Recordings" link). */
export function selectTopicByNumber(n: number): void {
  if (topics.value.some((t) => t.section.number === n) && topicNumber.value !== n) setTopic(n, { focus: false });
}

export { topicHash };
