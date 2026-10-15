import type { ComponentChildren } from 'preact';

interface IconButtonProps {
  label: string;
  onClick: (e: MouseEvent) => void;
  children: ComponentChildren;
  testId?: string;
  class?: string;
  pressed?: boolean;
  expanded?: boolean;
}

export function IconButton({ label, onClick, children, testId, class: cls, pressed, expanded }: IconButtonProps) {
  return (
    <button
      type="button"
      class={`kex-iconbtn ${cls ?? ''}`.trim()}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      data-kex-test={testId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
