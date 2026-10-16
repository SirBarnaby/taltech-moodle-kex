import { signal } from '@preact/signals';
import { cache } from '../cache';
import { ws } from '../ws';
import { log } from '../../lib/log';

/**
 * Moodle's own, localised module names ("File", "Fail", "Assignment", "Ülesanne") for the row eyebrows.
 * They come from `core_get_strings` (`modulename` of `mod_<name>`), once per language, cached with the other course data.
 */

/** modname -> Moodle's name for the module type, in the page language. */
export const modTypeNames = signal<ReadonlyMap<string, string>>(new Map());

const langOf = (): string => (typeof document === 'undefined' ? '' : document.documentElement.lang || '').toLowerCase().slice(0, 2) || 'en';
const keyFor = (lang: string): string => `modnames:${lang}`;

/** Last resort while nothing from Moodle is known yet: the plugin name, capitalised. */
export const humanModname = (modname: string): string => (modname ? modname.charAt(0).toUpperCase() + modname.slice(1) : '');

/** Load the cached names of this language into the signal (synchronous). */
export function hydrateModNames(): void {
  const env = cache.peek<Record<string, string>>(keyFor(langOf()));
  if (env) modTypeNames.value = new Map(Object.entries(env.data));
}

/** Ask Moodle for the names of the modules in `modnames` that are not known yet. Never throws. */
export async function loadModNames(modnames: readonly string[]): Promise<void> {
  const lang = langOf();
  const env = cache.peek<Record<string, string>>(keyFor(lang));
  const known = new Map(Object.entries(env?.data ?? {}));
  const need = [...new Set(modnames)].filter((m) => m && !known.has(m));
  if (!need.length) return;
  try {
    const out = await ws.call<string[]>('core_get_strings', {
      strings: need.map((m) => ({ stringid: 'modulename', component: `mod_${m}` })),
    });
    need.forEach((m, i) => {
      const name = typeof out[i] === 'string' ? out[i]!.trim() : '';
      // Moodle answers "[[modulename]]" for a string it does not have.
      if (name && !name.startsWith('[[')) known.set(m, name);
    });
    modTypeNames.value = known;
    await cache.write(keyFor(lang), Object.fromEntries(known));
  } catch (e) {
    log.warn('modnames', e);
  }
}
