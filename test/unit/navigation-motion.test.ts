import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginViewTransition, cancelViewTransitions } from '../../src/fx/navigation';

afterEach(() => {
  cancelViewTransitions();
  document.body.innerHTML = '';
  delete document.documentElement.dataset.kexMotion;
  delete document.documentElement.dataset.kexInput;
  vi.restoreAllMocks();
});

function content(): HTMLElement {
  document.body.innerHTML = '<div id="kex-root"><section id="detail" data-kex-test="detail"><button id="original">Material</button></section></div>';
  return document.getElementById('detail')!;
}

describe('navigation motion', () => {
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
