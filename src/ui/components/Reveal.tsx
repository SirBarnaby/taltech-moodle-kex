import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { MOTION } from '../../fx/navigation';
import { motionTier } from '../../fx/motion';

const DURATION = 280;

/**
 * A slot for blocks that can arrive (or go) after the page is on screen: Moodle's notices and the dashboard info, read from a
 * cache or a fetch. Once the view has been drawn the slot holds its height, so a block that lands later never pushes the page
 * down in one frame; the slot then opens (or closes) to the new height smoothly and what is below glides with it. A disclosure
 * opened inside it glides the same way. The inner box is a block formatting context, so the blocks' own margins are inside it.
 */
export function Reveal({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i || typeof ResizeObserver === 'undefined') return;
    let held = false;
    let last = i.offsetHeight;
    // The window's width, not the slot's: a scrollbar that appears because the slot grew must not count as a resize.
    let width = window.innerWidth;
    let running: Animation | undefined;
    const hold = (h: number): void => {
      o.style.height = `${h}px`;
    };
    // What is there by the first frame is part of the view's first look; from then on the slot holds its height.
    const raf = requestAnimationFrame(() => {
      held = true;
      last = i.offsetHeight;
      width = window.innerWidth;
      hold(last);
      o.classList.add('kex-reveal--held');
    });
    const ro = new ResizeObserver(() => {
      const h = i.offsetHeight;
      const w = window.innerWidth;
      if (h === last) return;
      const from = running ? o.getBoundingClientRect().height : last;
      const resized = w !== width;
      last = h;
      width = w;
      running?.cancel();
      running = undefined;
      if (!held) return;
      hold(h);
      // A window resize re-wraps the text: that follows the window, it does not glide.
      if (resized || motionTier() !== 'full' || typeof o.animate !== 'function') return;
      const anim = o.animate([{ height: `${from}px` }, { height: `${h}px` }], { duration: DURATION, easing: MOTION.ease });
      if (from === 0) i.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: DURATION, easing: MOTION.ease });
      running = anim;
      anim.onfinish = () => {
        if (running === anim) running = undefined;
      };
    });
    ro.observe(i);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      running?.cancel();
    };
  }, []);
  return (
    <div ref={outer} class={cls ? `kex-reveal ${cls}` : 'kex-reveal'}>
      <div ref={inner} class="kex-reveal__in">{children}</div>
    </div>
  );
}
