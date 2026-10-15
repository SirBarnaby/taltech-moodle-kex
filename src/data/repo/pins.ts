import { cache } from '../cache';
import type { Pin } from '../model';

/** Read-only in M1 (the palette lists pins). CRUD, ordering and sync arrive in M3. */
export function readPins(): Pin[] {
  return cache.peek<Pin[]>('pins')?.data ?? [];
}
