import { Lock } from 'lucide-preact';
import { ArrowNE } from './Glyphs';
import type { ComponentChildren } from 'preact';

interface ButtonProps {
  children: ComponentChildren;
  variant?: 'filled' | 'outlined';
  href?: string;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  /** Show the ↗ arrow (every resource button has one). */
  arrow?: boolean;
  locked?: boolean;
  testId?: string;
  class?: string;
  tabIndex?: number;
  newTab?: boolean;
}

/** The mock's 148×44 button. Renders a link when `href` is given. */
export function Button({ children, variant = 'outlined', href, onClick, disabled, arrow = true, locked, testId, class: cls, tabIndex, newTab }: ButtonProps) {
  const className = `kex-btn kex-btn--${variant}${cls ? ` ${cls}` : ''}`;
  const inner = (
    <>
      <span class="kex-btn__label">{children}</span>
      {locked ? <Lock size={14} strokeWidth={1.75} aria-hidden="true" /> : arrow ? <ArrowNE size={15} strokeWidth={1.7} /> : null}
    </>
  );
  if (href && !disabled) {
    return (
      <a class={className} href={href} onClick={onClick} data-kex-test={testId} tabIndex={tabIndex} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" class={className} onClick={onClick} disabled={disabled} data-kex-test={testId} tabIndex={tabIndex}>
      {inner}
    </button>
  );
}
