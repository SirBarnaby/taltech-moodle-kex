import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Tip {
  text: string;
  top: number;
  left: number;
  on: boolean;
}

const DELAY = 300;

/**
 * The label beside a hovered or focused rail item. One fixed element placed from the item's rectangle, so it
 * never stretches along the rail. Only rendered while the sidebar is the closed 72 px rail.
 */
export function RailTip({ container }: { container: RefObject<HTMLElement> }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const nav = container.current;
    if (!nav) return;
    const hide = (): void => {
      window.clearTimeout(timer.current);
      setTip((cur) => (cur ? { ...cur, on: false } : cur));
    };
    const show = (el: HTMLElement): void => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const text = el.dataset.tip;
        if (!text) return;
        const r = el.getBoundingClientRect();
        setTip({ text, top: r.top + r.height / 2, left: r.right + 8, on: false });
        requestAnimationFrame(() => requestAnimationFrame(() => setTip((cur) => (cur && cur.text === text ? { ...cur, on: true } : cur))));
      }, DELAY);
    };
    const item = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null;
    const over = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') return;
      const el = item(e.target);
      if (!el) return;
      hide();
      show(el);
    };
    const out = (e: PointerEvent): void => {
      const el = item(e.target);
      if (el && !el.contains(e.relatedTarget as Node | null)) hide();
    };
    const focus = (e: FocusEvent): void => {
      const el = item(e.target);
      if (el && el.matches(':focus-visible')) show(el);
    };
    nav.addEventListener('pointerover', over);
    nav.addEventListener('pointerout', out);
    nav.addEventListener('pointerdown', hide);
    nav.addEventListener('focusin', focus);
    nav.addEventListener('focusout', hide);
    nav.addEventListener('scroll', hide, true);
    return () => {
      window.clearTimeout(timer.current);
      nav.removeEventListener('pointerover', over);
      nav.removeEventListener('pointerout', out);
      nav.removeEventListener('pointerdown', hide);
      nav.removeEventListener('focusin', focus);
      nav.removeEventListener('focusout', hide);
      nav.removeEventListener('scroll', hide, true);
    };
  }, [container]);
  if (!tip) return null;
  return (
    <div class={`kex-railtip${tip.on ? ' kex-railtip--on' : ''}`} role="presentation" aria-hidden="true" style={{ top: `${tip.top}px`, left: `${tip.left}px` }}>
      {tip.text}
    </div>
  );
}
