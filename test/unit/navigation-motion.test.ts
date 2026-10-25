import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginViewTransition, cancelViewTransitions, focusWithoutJump, scrollViewport } from '../../src/fx/navigation';

afterEach(() => {
  cancelViewTransitions();
  document.body.innerHTML = '';
  delete document.documentElement.dataset.kexMotion;
  delete document.documentElement.dataset.kexInput;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function content(): HTMLElement {
  document.body.innerHTML = '<div id="kex-root"><section id="detail" data-kex-test="detail"><button id="original">Material</button></section></div>';
  return document.getElementById('detail')!;
}

describe('navigation motion', () => {
  it('bounds scroll progress after a long frame and cancels when the user takes over', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 4000 });
    let tick!: FrameRequestCallback;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { tick = cb; return 1; }));
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const handle = scrollViewport(0);
    tick(performance.now() + 1000);
    const value = scroll.mock.calls[0]?.[0] as ScrollToOptions;
    expect(4000 - value.top!).toBeLessThanOrEqual(window.innerHeight * 0.18);
    window.dispatchEvent(new Event('wheel'));
    await handle.finished;
    const count = scroll.mock.calls.length;
    tick(performance.now() + 2000);
    expect(scroll).toHaveBeenCalledTimes(count);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });
  it('holds document height before replacing long content, even without animation', () => {
    const el = content();
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2600 });
    document.documentElement.dataset.kexMotion = 'reduced';
    const enter = beginViewTransition(el, 'topic');
    expect(document.getElementById('kex-root')?.style.minHeight).toBe('2600px');
    enter('#detail');
    cancelViewTransitions();
    expect(document.getElementById('kex-root')?.style.minHeight).toBe('');
  });

  it('focuses topics without delegating scrolling to the browser', () => {
    content();
    const button = document.getElementById('original')!;
    const focus = vi.spyOn(button, 'focus');
    focusWithoutJump(button);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('keeps a noninteractive outgoing visual while the real destination can update immediately', async () => {
    const el = content();
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    vi.spyOn(Element.prototype, 'animate').mockReturnValue({ finished, cancel: vi.fn() } as unknown as Animation);
    beginViewTransition(el, 'topic');
    const ghost = document.querySelector<HTMLElement>('.kex-transition-ghost');
    expect(ghost?.textContent).toContain('Material');
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
    expect(ghost?.inert).toBe(true);
    expect(ghost?.querySelector('[id], [data-kex-test]')).toBeNull();
    expect(document.getElementById('original')?.closest('.kex-transition-ghost')).toBeNull();
    el.textContent = 'Next topic';
    expect(ghost?.textContent).toContain('Material');
    finish();
    await finished;
    await Promise.resolve();
    expect(document.querySelector('.kex-transition-ghost')).toBeNull();
  });

  it.each(['reduced', 'keyboard'])('does not delay or clone %s navigation', (mode) => {
    const el = content();
    if (mode === 'reduced') document.documentElement.dataset.kexMotion = mode;
    else document.documentElement.dataset.kexInput = mode;
    const animate = vi.spyOn(Element.prototype, 'animate');
    beginViewTransition(el, 'topic');
    expect(animate).not.toHaveBeenCalled();
    expect(document.querySelector('.kex-transition-ghost')).toBeNull();
  });

  it('removes an interrupted outgoing page instead of accumulating stale snapshots', () => {
    const el = content();
    vi.spyOn(Element.prototype, 'animate').mockReturnValue({ finished: new Promise(() => undefined), cancel: vi.fn() } as unknown as Animation);
    beginViewTransition(el, 'page');
    beginViewTransition(el, 'page');
    expect(document.querySelectorAll('.kex-transition-ghost')).toHaveLength(1);
    cancelViewTransitions();
    expect(document.querySelectorAll('.kex-transition-ghost')).toHaveLength(0);
  });
});
