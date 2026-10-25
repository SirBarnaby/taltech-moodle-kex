import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigation } from '../../src/fx/transactions';
import { PageLoader } from '../../src/content/softnav';

afterEach(() => { navigation.cancel(); document.body.innerHTML = ''; vi.useRealTimers(); vi.restoreAllMocks(); });

describe('navigation transactions', () => {
  it('records an implicitly selected topic even when the URL has no topic hash', () => {
    history.replaceState({}, '', '/course/view.php?id=2');
    document.body.innerHTML = '<button data-kex-topic="4" aria-current="true">Current topic</button>';
    const replace = vi.spyOn(history, 'replaceState');
    navigation.write(new URL('/course/view.php?id=2#topic-5', location.href), 'push', { kexTopic: 5 });
    expect(replace.mock.calls[0]?.[0]).toMatchObject({ kexTopic: 4 });
  });
  it('keeps destination HTML alive across local interactions and aborts it on route replacement', () => {
    const destination = navigation.openDestination();
    navigation.begin('page', { selector: '.kex-main' });
    navigation.begin('topic', { selector: '.kex-detail' });
    navigation.begin('reader', { selector: '.kex-sheet' }).cancel();
    expect(destination.signal.aborted).toBe(false);
    expect(destination.current()).toBe(true);
    navigation.openDestination();
    expect(destination.signal.aborted).toBe(true);
    expect(destination.current()).toBe(false);
  });
  it('releases the transition immediately when readiness fails', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="kex-root"><main class="kex-main">Previous page</main></div>';
    const tx = navigation.begin('page', { selector: '.kex-main' });
    const done = expect(tx.finish({ ready: () => false })).rejects.toThrow('readiness timed out');
    await vi.advanceTimersByTimeAsync(8001);
    await done;
    expect(document.getElementById('kex-root')?.style.minHeight).toBe('');
    expect(document.querySelector('.kex-view-ghost')).toBeNull();
    expect(document.documentElement.dataset.kexInteraction).toBeUndefined();
    expect(tx.signal.aborted).toBe(true);
  });

  it('keeps a completed reader token valid until another navigation supersedes it', async () => {
    const reader = navigation.begin('reader', { selector: '.kex-sheet', scroll: 'preserve' });
    await reader.finish();
    expect(reader.current()).toBe(true);
    const next = navigation.begin('page', { selector: '.kex-main' });
    expect(reader.signal.aborted).toBe(true);
    expect(next.current()).toBe(true);
  });

  it('aborts an obsolete destination and retains unrelated history state', () => {
    history.replaceState({ moodle: 'kept', kexScroll: 420 }, '', '/course/view.php?id=2#topic-1');
    const first = navigation.begin('page', { selector: '.kex-main' });
    const second = navigation.begin('topic', { selector: '.kex-detail' });
    expect(first.signal.aborted).toBe(true);
    expect(first.current()).toBe(false);
    expect(second.current()).toBe(true);
    navigation.write(new URL('/course/view.php?id=2#topic-2', location.href), 'push', { kexTopic: 2 });
    expect(history.state).toMatchObject({ moodle: 'kept', kexTopic: 2 });
    expect(history.scrollRestoration).toBe('manual');
  });

  it('holds the interaction budget until destination readiness and reveal finish', async () => {
    document.body.innerHTML = '<div id="kex-root"><main class="kex-main"></main></div>';
    let ready = false;
    const tx = navigation.begin('history', { selector: '.kex-main', top: 250 });
    const done = tx.finish({ ready: () => ready });
    expect(document.documentElement.dataset.kexInteraction).toBe('busy');
    await new Promise((r) => setTimeout(r, 40));
    expect(document.documentElement.dataset.kexInteraction).toBe('busy');
    ready = true;
    await done;
    expect(document.documentElement.dataset.kexInteraction).toBeUndefined();
    expect(document.getElementById('kex-root')?.style.minHeight).toBe('');
  });

  it('cancels an in-flight page read and does not retain its failed cache entry', async () => {
    const fetcher = vi.fn((_url: string, signal?: AbortSignal) => new Promise<string>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const loader = new PageLoader(fetcher);
    const abort = new AbortController();
    const pending = loader.load(new URL('https://moodle.taltech.ee/my/'), abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const next = new AbortController();
    const again = loader.load(new URL('https://moodle.taltech.ee/my/'), next.signal);
    next.abort();
    await expect(again).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
