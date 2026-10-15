import { signal } from '@preact/signals';
import type { Pin } from '../data/model';
import { addPin, isPinned, movePin, readPins, removePin, renamePin, replacePins, restorePin, rowPins } from '../data/repo/pins';
import { t } from '../i18n';
import { activeCourseId } from '../state';
import { pushToast } from './toasts';
import { setUndo } from './undo';

/** Pin actions shared by the course page, the Workspace, the Pinned page and the palette. */

/** Edit mode of the PINNED row / Pinned page (`e`). */
export const pinEdit = signal(false);
/** The pin whose title is being renamed inline (F2). */
export const pinRenaming = signal<number | undefined>(undefined);

const withUndo = (message: string, run: () => void): void => {
  setUndo(run);
  pushToast(`${message} · ${t('toast.undo')} (z)`, { actionLabel: t('toast.undo'), onAction: run });
};

export async function pinItem(pin: Pin): Promise<void> {
  if (isPinned(pin.cmid)) return unpinItem(pin.cmid);
  const ok = await addPin(pin);
  if (!ok) return void pushToast(t('toast.pinsFull'));
  withUndo(t('toast.pinned'), () => void removePin(pin.cmid));
}

export async function unpinItem(cmid: number): Promise<void> {
  const pins = readPins();
  const idx = pins.findIndex((p) => p.cmid === cmid);
  const gone = await removePin(cmid);
  if (!gone) return;
  withUndo(t('toast.unpinned'), () => void restorePin(gone, idx));
}

/** The order the PINNED row shows (this course first). */
export const displayOrder = (all: readonly Pin[] = readPins()): Pin[] => rowPins(all, activeCourseId.value, all.length);

export async function reorderPin(cmid: number, delta: -1 | 1, order: readonly Pin[] = displayOrder()): Promise<void> {
  const before = await movePin(cmid, delta, order);
  if (before) withUndo(t('toast.moved'), () => void replacePins(before));
}

export async function retitlePin(cmid: number, title: string): Promise<void> {
  const old = await renamePin(cmid, title);
  if (old !== undefined) withUndo(t('toast.renamed'), () => void renamePin(cmid, old));
}
