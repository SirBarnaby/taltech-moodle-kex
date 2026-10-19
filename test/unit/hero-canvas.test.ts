import { describe, expect, it, vi } from 'vitest';

// No WebGL (and no .glsl loader) in the unit environment: the renderer is a stub that reports itself unusable.
vi.mock('../../src/fx/ribbons', () => ({ RibbonsRenderer: class { ok = false; setOptions(): void {} } }));

import { heroCanvas } from '../../src/fx/heroCanvas';

// Shipped bug: every course switch built a new WebGL context, so the shader compiled again and popped in a second after the text.
describe('hero canvas', () => {
  it('is one canvas that moves from hero to hero', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    document.body.append(a, b);
    const offA = heroCanvas.attach(a, { seed: 1 });
    const canvas = a.querySelector('canvas');
    expect(canvas).toBeTruthy();
    offA();
    expect(a.querySelector('canvas')).toBeNull();
    const offB = heroCanvas.attach(b, { seed: 2 });
    expect(b.querySelector('canvas')).toBe(canvas);
    offB();
  });
});
