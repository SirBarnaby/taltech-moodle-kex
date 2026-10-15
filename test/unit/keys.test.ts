import { describe, expect, it, vi } from 'vitest';
import { KeyManager, keyLabel } from '../../src/lib/keys';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('KeyManager', () => {
  it('fires single keys, modifiers and chords; ignores typing targets except allowInInput', () => {
    const km = new KeyManager(window);
    const t = vi.fn(), k = vi.fn(), gw = vi.fn(), q = vi.fn();
    km.register([
      { keys: 't', scope: 'global', group: 'General', description: 'x', run: t },
      { keys: 'ctrl+k', scope: 'global', group: 'General', description: 'x', allowInInput: true, run: k },
      { keys: 'g w', scope: 'global', group: 'Navigate', description: 'x', run: gw },
      { keys: '?', scope: 'global', group: 'General', description: 'x', run: q },
    ]);
    km.attach();
    press('t');
    expect(t).toHaveBeenCalledTimes(1);
    press('t', { ctrlKey: true });
    expect(t).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.append(input);
    press('t', {}, input);
    expect(t).toHaveBeenCalledTimes(1);
    expect(press('k', { ctrlKey: true }, input).defaultPrevented).toBe(true);
    expect(k).toHaveBeenCalledTimes(1);
    press('g');
    press('w');
    expect(gw).toHaveBeenCalledTimes(1);
    press('?', { shiftKey: true });
    expect(q).toHaveBeenCalledTimes(1);
    km.detach();
  });
  it('chord times out and unrelated keys reset it', () => {
    vi.useFakeTimers();
    const km = new KeyManager(window);
    const gw = vi.fn(), t = vi.fn();
    km.register([
      { keys: 'g w', scope: 'global', group: 'Navigate', description: 'x', run: gw },
      { keys: 't', scope: 'global', group: 'General', description: 'x', run: t },
    ]);
    km.attach();
    press('g');
    vi.advanceTimersByTime(1100);
    press('w');
    expect(gw).not.toHaveBeenCalled();
    press('g');
    press('t'); // resets the chord and fires t
    expect(t).toHaveBeenCalledTimes(1);
    km.detach();
    vi.useRealTimers();
  });
  it('labels', () => {
    expect(keyLabel('ctrl+k')).toEqual(['Ctrl', 'K']);
    expect(keyLabel('g w')).toEqual(['G', 'then', 'W']);
  });
});
