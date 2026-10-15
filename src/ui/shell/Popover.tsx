import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

interface PopoverProps {
  /** Element the popover is anchored to; focus returns to it on close. */
  anchor: HTMLElement | null;
  label: string;
  onClose: () => void;
  children: ComponentChildren;
  /** "menu" gets arrow-key navigation between [role=menuitem]; "dialog" does not. */
  role?: 'menu' | 'dialog';
  class?: string;
  testId?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [role="menuitem"], [role="radio"][tabindex="0"], [role="switch"]';

/** Dark panel anchored to a sidebar item, opening to the right (design-spec §7). */
export function Popover({ anchor, label, onClose, children, role = 'dialog', class: cls, testId }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const sb = anchor.closest('.kex-sidebar')?.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    setPos({ left: (sb?.right ?? a.right) + 8, bottom: Math.max(8, window.innerHeight - a.bottom) });
  }, [anchor]);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onDown = (e: PointerEvent): void => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        anchor?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (role !== 'menu' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End')) return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={ref}
      class={`kex-popover ${cls ?? ''}`.trim()}
      role={role}
      aria-label={label}
      data-kex-test={testId}
      style={pos ? { left: `${pos.left}px`, bottom: `${pos.bottom}px` } : { visibility: 'hidden' }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
