import { cache, type Store } from '../cache';
import type { Pin } from '../model';

/**
 * Pins live in `browser.storage.local` under `kex:v1:{host}:{userId}:pins` (never synced across devices). Other tabs of the same
 * profile see changes through `storage.onChanged`, which the cache routes into this store (architecture §8.5).
 */
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

export async function savePins(next: Pin[]): Promise<void> {
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

/** Put the pin at `to` (clamped). Returns the old index, or -1 when nothing moved. */
export function movedTo(list: readonly Pin[], cmid: number, to: number): { next: Pin[]; from: number } {
  const from = list.findIndex((p) => p.cmid === cmid);
  if (from < 0) return { next: [...list], from: -1 };
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return { next: [...list], from: -1 };
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item) next.splice(target, 0, item);
  return { next, from };
}

/** Move a pin by one place within `order` (the order the user sees); the stored order follows. Returns the previous stored order for Undo. */
export async function movePin(cmid: number, delta: -1 | 1, order: readonly Pin[] = readPins()): Promise<Pin[] | undefined> {
  const all = readPins();
  const i = order.findIndex((p) => p.cmid === cmid);
  const neighbour = order[i + delta];
  if (i < 0 || !neighbour) return undefined;
  const a = all.findIndex((p) => p.cmid === cmid);
  const b = all.findIndex((p) => p.cmid === neighbour.cmid);
  if (a < 0 || b < 0) return undefined;
  const next = [...all];
  const [item] = next.splice(a, 1);
  if (!item) return undefined;
  // Insert before or after the neighbour so the pair swaps places.
  const nb = next.findIndex((p) => p.cmid === neighbour.cmid);
  next.splice(delta === 1 ? nb + 1 : nb, 0, item);
  await savePins(next);
  return all;
}

export async function renamePin(cmid: number, title: string): Promise<string | undefined> {
  const all = readPins();
  const cur = all.find((p) => p.cmid === cmid);
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!cur || !clean || clean === cur.title) return undefined;
  await savePins(all.map((p) => (p.cmid === cmid ? { ...p, title: clean } : p)));
  return cur.title;
}

/** Replace the whole list (Undo of a reorder, or an import). */
export async function replacePins(list: readonly Pin[]): Promise<void> {
  await savePins(list.slice(0, MAX_PINS));
}

/** The PINNED row shows 3 cells: pins of the current course first (in pin order), then the others in pin order. */
export function rowPins(all: readonly Pin[], courseId: number | null, n = 3): Pin[] {
  const here = all.filter((p) => p.courseId === courseId);
  const rest = all.filter((p) => p.courseId !== courseId);
  return [...here, ...rest].slice(0, n);
}

// ---------------------------------------------------------------------- export / import

const isKind = (v: unknown): v is Pin['kind'] => typeof v === 'string';

/** Parse and validate a pins JSON file (`{version:1, pins:[…]}` or a bare array). Invalid entries are dropped. */
export function parsePinsJson(text: string, wwwroot = ''): { pins: Pin[]; dropped: number } {
  const data: unknown = JSON.parse(text);
  const list: unknown[] = Array.isArray(data) ? data : Array.isArray((data as { pins?: unknown })?.pins) ? (data as { pins: unknown[] }).pins : [];
  const pins: Pin[] = [];
  let dropped = 0;
  const seen = new Set<number>();
  for (const raw of list) {
    const p = raw as Partial<Pin> | null;
    const ok =
      !!p && Number.isInteger(p.cmid) && (p.cmid as number) > 0 && Number.isInteger(p.courseId) && typeof p.title === 'string' && p.title.trim() !== '' &&
      typeof p.url === 'string' && /^https?:\/\//.test(p.url) && (!wwwroot || p.url.startsWith(wwwroot));
    if (!ok || !p || seen.has(p.cmid as number)) {
      dropped++;
      continue;
    }
    seen.add(p.cmid as number);
    pins.push({
      cmid: p.cmid as number,
      courseId: p.courseId as number,
      courseCode: typeof p.courseCode === 'string' ? p.courseCode : '',
      title: (p.title as string).trim().slice(0, 120),
      modname: typeof p.modname === 'string' ? p.modname : 'resource',
      kind: isKind(p.kind) ? p.kind : 'material',
      format: (typeof p.format === 'string' ? p.format : 'FILE') as Pin['format'],
      url: p.url as string,
      addedAt: typeof p.addedAt === 'number' ? p.addedAt : Date.now(),
    });
  }
  return { pins: pins.slice(0, MAX_PINS), dropped };
}

export function pinsToJson(pins: readonly Pin[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), pins }, null, 2);
}
