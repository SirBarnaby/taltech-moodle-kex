import { signal, type Signal } from '@preact/signals';
import { log } from '../lib/log';
import { onStorageChanged, storageGetAll, storageSet } from '../lib/storage';

/**
 * Stale-while-revalidate cache over browser.storage.local (architecture §8.5).
 * Keys are namespaced per host and user: `kex:v1:{host}:{userId}:{name}`.
 */

export interface Envelope<T> {
  v: 1;
  at: number;
  data: T;
}

const DROP_KEYS = new Set(['editurl', 'deleteurl', 'sesskey', 'token']);

export function stripSesskey(s: string): string {
  if (!/sesskey=/i.test(s)) return s;
  return s
    .replace(/([?&])sesskey=[^&#\s"']*/gi, '$1')
    .replace(/\?&/, '?')
    .replace(/&&+/g, '&')
    .replace(/[?&](?=#|$)/, '');
}

/** Remove sesskey query params and sensitive keys from anything we are about to persist. */
export function scrub<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (v.startsWith('data:')) return undefined; // generated images are large and re-derivable
      return stripSesskey(v);
    }
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== undefined);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (DROP_KEYS.has(k.toLowerCase())) continue;
        const w = walk(val);
        if (w !== undefined) out[k] = w;
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

export type Status = 'idle' | 'loading' | 'error';

export interface Store<T> {
  value: Signal<T | undefined>;
  status: Signal<Status>;
  error: Signal<Error | undefined>;
  /** Epoch ms of the cached value, when there is one. */
  at: Signal<number | undefined>;
  /** Revalidate now (or only when older than the TTL unless `force`). */
  refresh(force?: boolean): Promise<void>;
}

class Cache {
  private prefix = '';
  private mem = new Map<string, Envelope<unknown>>();
  private raw: Record<string, unknown> = {};
  private stores = new Map<string, { apply: (env: Envelope<unknown>) => void }>();
  private unwatch: (() => void) | undefined;
  private ready = false;

  /** Read everything once; filtered by user in `bind`. Call early (before the user id is known). */
  async preload(): Promise<void> {
    this.raw = await storageGetAll();
    this.index();
  }

  /** Bind to a host and user. Cheap; call once pageinfo is known. */
  bind(host: string, userId: number): void {
    this.prefix = `kex:v1:${host}:${userId}:`;
    this.index();
    this.ready = true;
    this.unwatch?.();
    this.unwatch = onStorageChanged((changes) => {
      for (const [key, c] of Object.entries(changes)) {
        if (!key.startsWith(this.prefix)) continue;
        const env = c.newValue as Envelope<unknown> | undefined;
        if (!env) {
          this.mem.delete(key);
          continue;
        }
        const cur = this.mem.get(key);
        if (cur && cur.at >= env.at) continue;
        this.mem.set(key, env);
        this.stores.get(key)?.apply(env);
      }
    });
  }

  get isReady(): boolean {
    return this.ready;
  }

  private index(): void {
    this.mem.clear();
    if (!this.prefix) return;
    for (const [k, v] of Object.entries(this.raw)) {
      if (k.startsWith(this.prefix) && v && typeof v === 'object' && (v as Envelope<unknown>).v === 1) this.mem.set(k, v as Envelope<unknown>);
    }
  }

  key(name: string): string {
    return this.prefix + name;
  }

  peek<T>(name: string): Envelope<T> | undefined {
    return this.mem.get(this.key(name)) as Envelope<T> | undefined;
  }

  async write<T>(name: string, data: T): Promise<Envelope<T>> {
    const env: Envelope<T> = { v: 1, at: Date.now(), data: scrub(data) };
    this.mem.set(this.key(name), env);
    try {
      await storageSet({ [this.key(name)]: env });
    } catch (e) {
      log.warn('cache write failed', name, e);
    }
    return env;
  }

  swr<T>(name: string, ttlMs: number, fetcher: () => Promise<T>): Store<T> {
    const key = this.key(name);
    const cached = this.mem.get(key) as Envelope<T> | undefined;
    const value = signal<T | undefined>(cached?.data);
    const at = signal<number | undefined>(cached?.at);
    const status = signal<Status>('idle');
    const error = signal<Error | undefined>(undefined);
    let inflight: Promise<void> | null = null;

    this.stores.set(key, {
      apply: (env) => {
        value.value = env.data as T;
        at.value = env.at;
      },
    });

    const refresh = (force = false): Promise<void> => {
      if (inflight) return inflight;
      const age = at.value === undefined ? Infinity : Date.now() - at.value;
      if (!force && age < ttlMs) return Promise.resolve();
      status.value = 'loading';
      inflight = fetcher()
        .then(async (data) => {
          const env = await this.write(name, data);
          value.value = env.data;
          at.value = env.at;
          error.value = undefined;
          status.value = 'idle';
        })
        .catch((e: unknown) => {
          error.value = e instanceof Error ? e : new Error(String(e));
          status.value = 'error';
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    };
    return { value, status, error, at, refresh };
  }

  /** Test helper. */
  reset(): void {
    this.mem.clear();
    this.stores.clear();
    this.raw = {};
    this.prefix = '';
    this.ready = false;
    this.unwatch?.();
  }
}

export const cache = new Cache();
