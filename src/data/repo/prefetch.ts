import { signal } from '@preact/signals';
import { cache } from '../cache';
import type { Course } from '../model';
import { courseStateStore, type CourseState } from './coursestate';
import { log } from '../../lib/log';

/**
 * Idle prefetch (architecture §8.6): once per hour, one batched POST with `get_state` for every sidebar course. The cached
 * states feed the palette's topics and materials and the "unavailable pin" check.
 */
const HOUR = 3600 * 1000;

/** Bumped whenever a prefetch finished, so the palette index and pin availability recompute. */
export const statesVersion = signal(0);

let started = false;

const idle = (fn: () => void): void => {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 4000 });
  else window.setTimeout(fn, 800);
};

/** Cached course states for the given course ids (those that have been fetched at least once). */
export function cachedStates(ids: readonly number[]): CourseState[] {
  const out: CourseState[] = [];
  for (const id of ids) {
    const env = cache.peek<CourseState>(`state:${id}`);
    if (env?.data) out.push(env.data);
  }
  return out;
}

/** Start the prefetch for these courses (call once the sidebar list is known). Safe to call repeatedly. */
export function prefetchStates(courses: readonly Pick<Course, 'id'>[], force = false): void {
  if (!courses.length) return;
  const ids = courses.map((c) => c.id);
  const last = cache.peek<number>('prefetch:at')?.data ?? 0;
  const missing = ids.some((id) => !cache.peek(`state:${id}`));
  if (!force && !missing && Date.now() - last < HOUR) {
    statesVersion.value = statesVersion.peek() + 1;
    return;
  }
  if (started && !force) return;
  started = true;
  idle(() => {
    void Promise.all(ids.map((id) => courseStateStore(id).refresh(true)))
      .then(() => cache.write('prefetch:at', Date.now()))
      .catch((e: unknown) => log.warn('prefetch failed', e))
      .finally(() => {
        started = false;
        statesVersion.value = statesVersion.peek() + 1;
      });
  });
}
