import { signal } from '@preact/signals';
import { log } from '../lib/log';

/** Moodle web-service client over /lib/ajax/service.php with same-macrotask batching (architecture §8.2). */

export class WsError extends Error {
  constructor(
    public readonly errorcode: string,
    message: string,
  ) {
    super(message);
    this.name = 'WsError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** True once Moodle told us the session or sesskey is no longer valid. The shell shows a banner. */
export const sessionExpired = signal(false);

type Http = (url: string, init?: RequestInit) => Promise<Response>;

/** `content.fetch` makes the request as the page (cookies, SameSite=Lax); plain fetch elsewhere (tests). */
function pickHttp(): Http {
  const c = (globalThis as unknown as { content?: { fetch?: Http } }).content;
  if (c && typeof c.fetch === 'function') return c.fetch.bind(c);
  return (url, init) => fetch(url, init);
}

interface Pending {
  methodname: string;
  args: unknown;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

interface WireResult {
  error: boolean;
  data?: unknown;
  exception?: { errorcode?: string; message?: string };
}

const RETRY_DELAYS = [400, 1600];
const SESSION_CODES = new Set(['invalidsesskey', 'servicerequireslogin', 'requireloginerror', 'sessiontimedout']);

export class WsClient {
  private wwwroot = '';
  private sesskey = '';
  private queue: Pending[] = [];
  private scheduled = false;
  private inflight = new Map<string, Promise<unknown>>();
  private ready: Promise<void>;
  private markReady!: () => void;
  private http: Http = pickHttp();
  /** Number of POSTs sent; the request-budget tests read this. */
  public posts = 0;

  constructor() {
    this.ready = new Promise((r) => (this.markReady = r));
  }

  configure(wwwroot: string, sesskey: string): void {
    this.wwwroot = wwwroot.replace(/\/$/, '');
    this.sesskey = sesskey;
    if (wwwroot && sesskey) this.markReady();
  }

  get base(): string {
    return this.wwwroot;
  }

  /** GET a Moodle page as text (same transport as the API, so cookies are the page's). */
  async fetchText(path: string): Promise<string> {
    await this.ready;
    const res = await this.http(this.wwwroot + path, { credentials: 'same-origin' });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return res.text();
  }

  /** GET a URL and report where it ended up: PDFs and images answer with their final pluginfile URL and type, pages with their HTML. */
  async probe(url: string, signal?: AbortSignal): Promise<{ url: string; type: string; html?: string }> {
    await this.ready;
    signal?.throwIfAborted();
    const res = await this.http(url, { credentials: 'same-origin', signal });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (type.includes('html')) return { url: res.url || url, type, html: await res.text() };
    void res.body?.cancel().catch(() => undefined);
    return { url: res.url || url, type };
  }

  /** Test hook: swap the transport. */
  setHttp(h: Http): void {
    this.http = h;
  }

  call<T>(methodname: string, args: Record<string, unknown> = {}): Promise<T> {
    const key = methodname + JSON.stringify(args);
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = new Promise<T>((resolve, reject) => {
      this.queue.push({ methodname, args, resolve: resolve as (v: unknown) => void, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        setTimeout(() => void this.flush(), 0);
      }
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async flush(): Promise<void> {
    this.scheduled = false;
    const batch = this.queue.splice(0);
    if (!batch.length) return;
    try {
      await this.ready;
      const results = await this.post(batch);
      batch.forEach((p, i) => {
        const r = results[i];
        if (!r) return p.reject(new WsError('missingresult', `No result for ${p.methodname}`));
        if (r.error) {
          const code = r.exception?.errorcode ?? 'unknown';
          if (SESSION_CODES.has(code)) sessionExpired.value = true;
          return p.reject(new WsError(code, r.exception?.message ?? code));
        }
        p.resolve(r.data);
      });
    } catch (e) {
      batch.forEach((p) => p.reject(e));
    }
  }

  private async post(batch: Pending[]): Promise<WireResult[]> {
    const info = batch.map((b) => b.methodname).join(',');
    const url = `${this.wwwroot}/lib/ajax/service.php?sesskey=${encodeURIComponent(this.sesskey)}&info=${encodeURIComponent(info)}`;
    const body = JSON.stringify(batch.map((b, index) => ({ index, methodname: b.methodname, args: b.args })));
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        this.posts++;
        const res = await this.http(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          credentials: 'same-origin',
        });
        if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
        const json = (await res.json()) as unknown;
        if (Array.isArray(json)) return json as WireResult[];
        // Whole-request failure: {error: "...", errorcode: "..."}.
        const obj = json as { error?: unknown; errorcode?: string };
        const code = obj.errorcode ?? '';
        if (SESSION_CODES.has(code) || /sesskey|login/i.test(String(obj.error ?? ''))) {
          sessionExpired.value = true;
          throw new WsError(code || 'invalidsesskey', String(obj.error ?? 'Session expired'));
        }
        throw new WsError(code || 'badresponse', String(obj.error ?? 'Unexpected response'));
      } catch (e) {
        if (e instanceof WsError) throw e;
        lastErr = e;
        const delay = RETRY_DELAYS[attempt];
        if (delay === undefined) break;
        log.debug('ws retry', attempt + 1, e);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr instanceof NetworkError ? lastErr : new NetworkError(lastErr instanceof Error ? lastErr.message : String(lastErr));
  }
}

export const ws = new WsClient();
