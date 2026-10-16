import { signal } from '@preact/signals';
import { cache } from '../cache';
import type { CmDetails } from '../model';
import { parseCmItems, parseModuleHtml } from '../scrape/cm';
import { ws } from '../ws';
import { log } from '../../lib/log';

/** Rendered-activity details per cm (icon, dates, completion button, description), 30 min TTL (architecture §8.5). */
export const CMD_TTL_MS = 30 * 60 * 1000;

/** All known details, by cmid. Replaced (not mutated) so signal readers re-render. */
export const cmDetails = signal<ReadonlyMap<number, CmDetails>>(new Map());

type Persisted = Record<string, CmDetails>;
const keyFor = (courseId: number): string => `cmd:${courseId}`;
const loaded = new Set<number>();

/** Load the persisted details of a course into memory (synchronously from the preloaded cache). */
export function hydrateDetails(courseId: number): void {
  if (loaded.has(courseId)) return;
  loaded.add(courseId);
  const env = cache.peek<Persisted>(keyFor(courseId));
  if (!env) return;
  const next = new Map(cmDetails.value);
  for (const [id, d] of Object.entries(env.data)) next.set(Number(id), d);
  cmDetails.value = next;
}

const isFresh = (d: CmDetails | undefined): boolean => !!d && Date.now() - d.at < CMD_TTL_MS;

let persistTimer: number | undefined;
function persist(courseId: number, ids: Iterable<number>): void {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const out: Persisted = {};
    const wanted = new Set(ids);
    for (const [id, d] of cmDetails.value) if (wanted.has(id)) out[String(id)] = d;
    void cache.write(keyFor(courseId), { ...(cache.peek<Persisted>(keyFor(courseId))?.data ?? {}), ...out });
  }, 400);
}

/** cmids that need a fetch right now. */
export function staleIds(ids: readonly number[], force = false): number[] {
  return ids.filter((id) => force || !isFresh(cmDetails.value.get(id)));
}

const inflight = new Map<number, Promise<void>>();

/**
 * Fetch details for `ids` (batched into one POST by the ws client). Failures fall back to the section page.
 * `sectionIds` maps cmid -> section id for that fallback.
 */
export async function loadDetails(courseId: number, ids: readonly number[], sectionOf: (cmid: number) => number | undefined, force = false): Promise<void> {
  hydrateDetails(courseId);
  const need = staleIds(ids, force).filter((id) => !inflight.has(id));
  const waiting = ids.map((id) => inflight.get(id)).filter((p): p is Promise<void> => !!p);
  if (need.length) {
    const job = (async (): Promise<void> => {
      const got = new Map<number, CmDetails>();
      const failed: number[] = [];
      await Promise.all(
        need.map(async (id) => {
          try {
            const html = await ws.call<string>('core_course_get_module', { id });
            const p = parseModuleHtml(html);
            if (p) got.set(id, p.details);
            else failed.push(id);
          } catch (e) {
            log.warn('get_module failed', id, e);
            failed.push(id);
          }
        }),
      );
      if (failed.length) {
        const sections = new Set(failed.map(sectionOf).filter((s): s is number => !!s));
        for (const sid of sections) {
          try {
            const html = await ws.fetchText(`/course/section.php?id=${sid}`);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            for (const p of parseCmItems(doc)) if (failed.includes(p.id)) got.set(p.id, p.details);
          } catch (e) {
            log.warn('section.php fallback failed', sid, e);
          }
        }
      }
      if (got.size) {
        const next = new Map(cmDetails.value);
        for (const [id, d] of got) next.set(id, d);
        cmDetails.value = next;
        persist(courseId, got.keys());
      }
    })().finally(() => need.forEach((id) => inflight.delete(id)));
    need.forEach((id) => inflight.set(id, job));
    waiting.push(job);
  }
  await Promise.all(waiting);
}

/** Optimistic completion flip (the real state is re-read from the server on the next load). */
export function setManualDone(cmid: number, done: boolean): void {
  const d = cmDetails.value.get(cmid);
  if (!d?.manual) return;
  const next = new Map(cmDetails.value);
  next.set(cmid, { ...d, manual: { done } });
  cmDetails.value = next;
}

/** Seed details parsed from the page's own markup (no request); never overwrites fresher details. */
export function seedDetails(courseId: number, parsed: readonly { id: number; modname: string; details: CmDetails }[]): void {
  const next = new Map(cmDetails.value);
  const ids: number[] = [];
  for (const p of parsed) {
    if (p.modname === 'subsection') continue;
    if (isFresh(next.get(p.id))) continue;
    next.set(p.id, p.details);
    ids.push(p.id);
  }
  if (!ids.length) return;
  cmDetails.value = next;
  persist(courseId, ids);
}
