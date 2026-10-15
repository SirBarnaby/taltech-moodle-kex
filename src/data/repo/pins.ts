import { cache, type Store } from '../cache';
import type { Pin } from '../model';

/** Pins live in `browser.storage.local` under `kex:v1:{host}:{userId}:pins` (never synced). Full CRUD UI arrives in M3. */
export const MAX_PINS = 50;

let store: Store<Pin[]> | undefined;

/** The pins store; created lazily because it needs the cache to be bound to a user first. */
export function pinsStore(): Store<Pin[]> {
  store ??= cache.swr<Pin[]>('pins', Number.MAX_SAFE_INTEGER, () => Promise.resolve(cache.peek<Pin[]>('pins')?.data ?? []));
  return store;
}

export function readPins(): Pin[] {
  return pinsStore().value.value ?? cache.peek<Pin[]>('pins')?.data ?? [];
}

async function savePins(next: Pin[]): Promise<void> {
  const env = await cache.write('pins', next);
  pinsStore().value.value = env.data;
}

export const isPinned = (cmid: number, pins: readonly Pin[] = readPins()): boolean => pins.some((p) => p.cmid === cmid);

export async function addPin(pin: Pin): Promise<boolean> {
  const cur = readPins();
  if (isPinned(pin.cmid, cur)) return true;
  if (cur.length >= MAX_PINS) return false;
  await savePins([...cur, pin]);
  return true;
}

export async function removePin(cmid: number): Promise<Pin | undefined> {
  const cur = readPins();
  const gone = cur.find((p) => p.cmid === cmid);
  if (gone) await savePins(cur.filter((p) => p.cmid !== cmid));
  return gone;
}

/** Re-insert a pin at its old index (Undo). */
export async function restorePin(pin: Pin, index: number): Promise<void> {
  const cur = readPins().filter((p) => p.cmid !== pin.cmid);
  cur.splice(Math.min(index, cur.length), 0, pin);
  await savePins(cur);
}

/** The PINNED row shows 3 cells: pins of the current course first (in pin order), then the others in pin order. */
export function rowPins(all: readonly Pin[], courseId: number | null, n = 3): Pin[] {
  const here = all.filter((p) => p.courseId === courseId);
  const rest = all.filter((p) => p.courseId !== courseId);
  return [...here, ...rest].slice(0, n);
}
