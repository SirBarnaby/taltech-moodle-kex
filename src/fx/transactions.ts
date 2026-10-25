import { beginViewTransition, cancelViewTransitions, focusWithoutJump } from './navigation';

export type NavigationIntent = 'page' | 'topic' | 'filter' | 'history' | 'reader';
export interface NavigationState { kexScroll?: number; kexTopic?: number; kexFocus?: string }
interface Options { selector: string; top?: number; scroll?: 'top' | 'anchor' | 'preserve' }
export interface NavigationTransaction {
  signal: AbortSignal;
  current(): boolean;
  cancel(): void;
  finish(options?: { ready?: () => boolean; focus?: string }): Promise<void>;
}
const aborted = (): DOMException => new DOMException('Navigation superseded', 'AbortError');

/** One token owns loading, readiness, viewport, focus and the decorative-work budget. */
class NavigationCoordinator {
  private owner?: AbortController;
  private latest?: AbortController;
  private destination?: AbortController;

  /** Topic, filter and reader changes still need the same destination's pending HTML. */
  openDestination(): { signal: AbortSignal; current(): boolean } {
    this.destination?.abort();
    const destination = new AbortController();
    this.destination = destination;
    return { signal: destination.signal, current: () => this.destination === destination && !destination.signal.aborted };
  }

  private busy(value: boolean): void {
    if (value) document.documentElement.dataset.kexInteraction = 'busy';
    else delete document.documentElement.dataset.kexInteraction;
    document.dispatchEvent(new CustomEvent('kex:interaction', { detail: { busy: value } }));
  }

  begin(intent: NavigationIntent, options: Options): NavigationTransaction {
    const previous = this.latest;
    const owner = new AbortController();
    this.latest = owner;
    this.owner = owner;
    previous?.abort();
    this.busy(true);
    cancelViewTransitions();
    // The reader owns its overlay animation; cloning it would create a second modal.
    const reveal = intent === 'reader' ? () => Promise.resolve() : beginViewTransition(document.querySelector(options.selector), intent === 'page' || intent === 'history' ? 'page' : 'topic', options);
    const current = (): boolean => this.latest === owner && !owner.signal.aborted;
    return {
      signal: owner.signal, current,
      cancel: () => { if (current()) this.cancelView(); },
      finish: async ({ ready = () => true, focus } = {}) => {
        try {
          // Two ready paints let Preact commit data before measuring a cold destination.
          await this.ready(owner.signal, ready);
          if (!current()) return;
          await reveal(options.selector);
          if (!current()) return;
          if (focus) {
            const element = document.querySelector<HTMLElement>(focus);
            if (element && !element.hasAttribute('tabindex')) element.tabIndex = -1;
            focusWithoutJump(element);
          }
          if (intent !== 'reader') this.remember();
        } catch (error) {
          if (current()) this.cancelView();
          throw error;
        } finally {
          if (this.owner === owner) { this.owner = undefined; this.busy(false); }
        }
      },
    };
  }

  private ready(signal: AbortSignal, predicate: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      let frame = 0;
      let count = 0;
      const end = (error?: Error): void => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      };
      const abort = (): void => end(aborted());
      const timer = window.setTimeout(() => end(new Error('Destination readiness timed out')), 8000);
      const tick = (): void => {
        if (signal.aborted) return abort();
        try { count = predicate() ? count + 1 : 0; }
        catch (error) { end(error instanceof Error ? error : new Error(String(error))); return; }
        if (count === 2) end();
        else frame = requestAnimationFrame(tick);
      };
      signal.addEventListener('abort', abort, { once: true });
      frame = requestAnimationFrame(tick);
    });
  }

  remember(): void {
    history.scrollRestoration = 'manual';
    const active = document.activeElement;
    const topic = /^#topic-(\d+)$/.exec(location.hash);
    const selected = document.querySelector<HTMLElement>('[data-kex-topic][aria-current="true"]')?.dataset.kexTopic;
    const topicNumber = topic ? Number(topic[1]) : selected !== undefined ? Number(selected) : undefined;
    const focus = active instanceof HTMLElement && active.id ? `#${CSS.escape(active.id)}` : undefined;
    history.replaceState({ ...history.state, kexScroll: window.scrollY, kexTopic: topicNumber, kexFocus: focus }, '');
  }

  write(url: URL, mode: 'push' | 'replace', state: NavigationState = {}): void {
    this.remember();
    const next = { ...history.state, kexScroll: 0, kexFocus: undefined, kexTopic: undefined, ...state };
    if (mode === 'push') history.pushState(next, '', url);
    else history.replaceState(next, '', url);
  }

  /** Record manual scrolling before Back changes which history entry is current. */
  attachHistory(): () => void {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    this.remember();
    let timer = 0;
    const record = (): void => {
      clearTimeout(timer);
      timer = window.setTimeout(() => { if (!this.owner) this.remember(); }, 80);
    };
    // A full load to another page (an activity, Participants) must find this entry's position when Back returns to it.
    const leave = (): void => { if (!this.owner) this.remember(); };
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('pagehide', leave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', record);
      window.removeEventListener('pagehide', leave);
      history.scrollRestoration = previous;
    };
  }

  cancel(): void {
    this.destination?.abort();
    this.destination = undefined;
    this.cancelView();
  }

  private cancelView(): void {
    const previous = this.latest;
    this.latest = undefined;
    this.owner = undefined;
    previous?.abort();
    cancelViewTransitions();
    this.busy(false);
  }
}

export const navigation = new NavigationCoordinator();

/** A synchronous state mutation still uses the same cancellation and viewport policy. */
export function changeView(intent: NavigationIntent, selector: string, mutate: () => void, options: Omit<Options, 'selector'> & { ready?: () => boolean; focus?: string } = {}): void {
  const tx = navigation.begin(intent, { selector, ...options });
  mutate();
  void tx.finish(options).catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('[KEX] view readiness', error);
  });
}
