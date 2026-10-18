// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { motionTier, scrollBehavior } from '../../src/fx/motion';
import { MOTION } from '../../src/fx/navigation';

const set = (data: Record<string, string>): void => {
  for (const k of ['kexMotion', 'kexInput', 'kexEffects']) delete document.documentElement.dataset[k];
  Object.assign(document.documentElement.dataset, data);
};
afterEach(() => set({}));

describe('navigation motion', () => {
  it('motion tier: none for reduced motion and keyboard use, subtle with effects off, full otherwise', () => {
    set({});
    expect(motionTier()).toBe('full');
    set({ kexEffects: 'off' });
    expect(motionTier()).toBe('subtle');
    set({ kexMotion: 'reduced', kexEffects: 'off' });
    expect(motionTier()).toBe('none');
    set({ kexInput: 'keyboard' });
    expect(motionTier()).toBe('none');
  });

  it('smooth scrolling only when the tier allows motion', () => {
    set({});
    expect(scrollBehavior()).toBe('smooth');
    set({ kexEffects: 'off' });
    expect(scrollBehavior()).toBe('smooth');
    set({ kexMotion: 'reduced' });
    expect(scrollBehavior()).toBe('auto');
  });

  it('every step of the page change stays under 300 ms and the title starts early', () => {
    const steps = [MOTION.exit, MOTION.enter, MOTION.title, MOTION.meta, MOTION.topic, MOTION.subtle, MOTION.topicExit, MOTION.topicEnter];
    for (const ms of steps) expect(ms).toBeLessThanOrEqual(300);
    expect(MOTION.topicStagger).toBeLessThanOrEqual(120);
    // The last title piece (three words, one stagger apart) has started within 200 ms of the click.
    expect(MOTION.titleDelay + 2 * MOTION.titleStagger).toBeLessThanOrEqual(200);
    expect(MOTION.ease).toBe('cubic-bezier(.23, 1, .32, 1)');
  });
});
