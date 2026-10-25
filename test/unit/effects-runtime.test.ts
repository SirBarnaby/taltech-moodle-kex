import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const drivers = vi.hoisted(() => ({ instances: [] as Array<{
  isRunning: boolean; isPending: boolean; ok: boolean; time: number;
  start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frame: ReturnType<typeof vi.fn>;
  renderStatic: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>;
  opts: { onReady?: () => void; onFallback?: (reason: 'lost') => void }; onGiveUp?: () => void;
}> }));

vi.mock('../../src/fx/ribbons', () => ({
  RibbonsRenderer: class {
    isRunning = false;
    isPending = true;
    ok = true;
    time = 7.3;
    onGiveUp?: () => void;
    start = vi.fn(() => { this.isRunning = true; });
    stop = vi.fn(() => { this.isRunning = false; });
    frame = vi.fn(() => true);
    renderStatic = vi.fn(() => true);
    resize = vi.fn();
    dispose = vi.fn(() => { this.isRunning = false; });
    setPointer = vi.fn();
    constructor(_canvas: HTMLCanvasElement, public opts: { onReady?: () => void; onFallback?: (reason: 'lost') => void }) {
      drivers.instances.push(this);
    }
  },
}));

import { EffectsController } from '../../src/fx/effects';

describe('shared effects runtime', () => {
  let runtime: EffectsController;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  const handles: Array<{ dispose(): void }> = [];
  const canvas = (): HTMLCanvasElement => document.createElement('canvas');
  const add = (c = canvas(), onMode = vi.fn()) => {
    const handle = runtime.register(c, {}, onMode);
    handles.push(handle);
    return { c, onMode, handle };
  };
  const init = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(60); };
  const ready = (index: number): void => {
    const driver = drivers.instances[index]!;
    driver.isPending = false;
    driver.opts.onReady?.();
  };
  const frame = (now = 100): void => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((f) => f(now));
  };
  const interaction = (busy: boolean): void => { document.dispatchEvent(new CustomEvent('kex:interaction', { detail: { busy } })); };

  beforeEach(() => {
    vi.useFakeTimers();
    drivers.instances.length = 0;
    frames = new Map();
    nextFrame = 1;
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    runtime = new EffectsController();
  });

  afterEach(() => {
    handles.splice(0).forEach((h) => h.dispose());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not create a WebGL renderer while disabled or during a navigation interaction', async () => {
    runtime.configure({ effects: 'off', motion: 'full' });
    const a = add();
    await init();
    expect(drivers.instances).toHaveLength(0);
    expect(a.c.dataset.fxState).toBe('fallback');
    interaction(true);
    runtime.configure({ effects: 'animated', motion: 'full' });
    await init();
    expect(drivers.instances).toHaveLength(0);
    interaction(false);
    await init();
    expect(drivers.instances).toHaveLength(1);
    expect(a.c.dataset.fxState).toBe('compiling');
    expect(a.onMode).toHaveBeenLastCalledWith('fallback');
  });

  it('paints before revealing and uses one animation frame pump for at most two live canvases', async () => {
    const a = add();
    add();
    add();
    await init();
    ready(0); ready(1); ready(2);
    await Promise.resolve();
    expect(drivers.instances[0]!.renderStatic).toHaveBeenCalledWith(7.3);
    expect(a.onMode).toHaveBeenLastCalledWith('live');
    expect(runtime.liveCount).toBe(2);
    expect(frames.size).toBe(1);
    frame();
    expect(drivers.instances.filter((d) => d.frame.mock.calls.length)).toHaveLength(2);
    expect(frames.size).toBe(1);
  });

  it('reconciles waiting canvases when a live canvas is disposed and stops every draw while busy', async () => {
    const a = add();
    add(); add();
    await init();
    ready(0); ready(1); ready(2);
    await Promise.resolve();
    a.handle.dispose();
    expect(drivers.instances[2]!.isRunning).toBe(true);
    interaction(true);
    expect(runtime.liveCount).toBe(0);
    expect(frames.size).toBe(0);
    const count = drivers.instances.reduce((n, d) => n + d.renderStatic.mock.calls.length + d.frame.mock.calls.length, 0);
    frame(1000);
    expect(drivers.instances.reduce((n, d) => n + d.renderStatic.mock.calls.length + d.frame.mock.calls.length, 0)).toBe(count);
    interaction(false);
    expect(runtime.liveCount).toBe(2);
  });

  it('keeps a ready canvas hidden until its first frame can be painted after an interaction', async () => {
    const a = add();
    await init();
    interaction(true);
    ready(0);
    await Promise.resolve();
    expect(drivers.instances[0]!.renderStatic).not.toHaveBeenCalled();
    expect(a.onMode).toHaveBeenLastCalledWith('fallback');
    interaction(false);
    expect(drivers.instances[0]!.renderStatic).toHaveBeenCalledOnce();
    expect(a.onMode).toHaveBeenLastCalledWith('live');
  });

  it('pauses an existing context while off and ignores late readiness after unmount', async () => {
    const a = add();
    await init();
    const first = drivers.instances[0]!;
    runtime.configure({ effects: 'off', motion: 'full' });
    expect(first.dispose).not.toHaveBeenCalled();
    expect(first.stop).toHaveBeenCalled();
    ready(0);
    await Promise.resolve();
    expect(first.renderStatic).not.toHaveBeenCalled();
    expect(a.onMode).toHaveBeenLastCalledWith('fallback');
    runtime.configure({ effects: 'static', motion: 'reduced' });
    await init();
    expect(drivers.instances).toHaveLength(1);
    await Promise.resolve();
    expect(a.onMode).toHaveBeenLastCalledWith('static');
    expect(runtime.liveCount).toBe(0);
    const paints = first.renderStatic.mock.calls.length;
    a.handle.dispose();
    ready(0);
    await Promise.resolve();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(first.renderStatic).toHaveBeenCalledTimes(paints);
  });

  it('contains only aggregate counts and timings in its diagnostic snapshot', async () => {
    add();
    await init();
    ready(0);
    await Promise.resolve();
    frame();
    const diagnostics = runtime.diagnostics();
    expect(diagnostics.entries).toBe(1);
    expect(diagnostics.live).toBe(1);
    expect(diagnostics.paints).toBeGreaterThan(0);
    expect(Object.values(diagnostics).every((v) => typeof v === 'number' || typeof v === 'boolean')).toBe(true);
  });

  it('pauses hidden documents and repaints a deferred resize only after interaction ends', async () => {
    let resize!: ResizeObserverCallback;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {} disconnect() {}
    });
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const a = add();
    await init(); ready(0); await Promise.resolve();
    const driver = drivers.instances[0]!;
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(driver.isRunning).toBe(false);
    expect(a.c.dataset.fxState).toBe('paused');
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(driver.isRunning).toBe(true);
    interaction(true);
    const paints = driver.renderStatic.mock.calls.length;
    resize([], {} as ResizeObserver);
    expect(driver.renderStatic).toHaveBeenCalledTimes(paints);
    interaction(false);
    expect(driver.renderStatic).toHaveBeenCalledTimes(paints + 1);
    expect(driver.renderStatic).toHaveBeenLastCalledWith(7.3);
    hidden.mockRestore();
  });

  it('limits cadence and alternates the first canvas when a draw consumes the frame budget', async () => {
    add(); add();
    await init(); ready(0); ready(1); await Promise.resolve();
    let elapsed = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
    drivers.instances.forEach((driver) => driver.frame.mockImplementation(() => { elapsed += 5; return true; }));
    frame(100);
    expect(drivers.instances.map((driver) => driver.frame.mock.calls.length)).toEqual([1, 0]);
    frame(110);
    expect(drivers.instances.map((driver) => driver.frame.mock.calls.length)).toEqual([1, 0]);
    frame(134);
    expect(drivers.instances.map((driver) => driver.frame.mock.calls.length)).toEqual([1, 1]);
    expect(runtime.diagnostics()).toMatchObject({ frames: 2, overBudgetFrames: 2 });
    clock.mockRestore();
  });
});
