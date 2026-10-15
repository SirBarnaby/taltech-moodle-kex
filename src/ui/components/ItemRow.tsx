import type { ComponentChildren } from 'preact';
import { Button } from './Button';

export interface RowAction {
  key: string;
  label: string;
  icon: ComponentChildren;
  onClick: () => void;
  /** Pressed / active look. */
  on?: boolean;
  testId?: string;
}

interface ItemRowProps {
  /** `data-kex-item` value (unique in the list). */
  id: string;
  testId?: string;
  thumb: ComponentChildren;
  /** Mono label line. */
  label: ComponentChildren;
  tone?: 'normal' | 'overdue' | 'gone';
  title: ComponentChildren;
  titleHref?: string;
  onTitle?: (e: MouseEvent) => void;
  subtitle?: ComponentChildren;
  actions?: RowAction[];
  button?: { label: string; href?: string; onClick?: (e: MouseEvent) => void; variant: 'filled' | 'outlined'; testId?: string; newTab?: boolean };
  selected?: boolean;
  unread?: boolean;
  enter?: number;
  onSelect?: (id: string) => void;
  ariaLabel?: string;
  /** Extra class names (row variants). */
  class?: string;
  /** Rendered inside the text column (inline editor etc.). */
  extra?: ComponentChildren;
}

const isModified = (e: MouseEvent): boolean => e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;

/** The resource-row anatomy (design-spec §4.9) for the Workspace feed, the Pinned page and search results. */
export function ItemRow(p: ItemRowProps) {
  const enter = p.enter !== undefined && p.enter < 8;
  return (
    <li
      class={`kex-row kex-row--item${p.tone === 'gone' ? ' kex-row--locked' : ''}${p.selected ? ' kex-row--selected' : ''}${enter ? ' kex-row--enter' : ''}${p.subtitle ? ' kex-row--sub' : ''}${p.unread ? ' kex-row--unread' : ''}${p.class ? ` ${p.class}` : ''}`}
      style={enter ? { '--kex-enter': String(p.enter) } : undefined}
      tabIndex={p.selected ? 0 : -1}
      data-kex-item={p.id}
      data-kex-test={p.testId}
      aria-label={p.ariaLabel}
      onFocus={() => p.onSelect?.(p.id)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button, input')) return;
        p.onSelect?.(p.id);
      }}
    >
      {p.thumb}
      <div class="kex-row__text">
        <p class={`kex-row__label kex-mono${p.tone === 'overdue' ? ' kex-row__label--overdue' : ''}`}>{p.label}</p>
        <h4 class="kex-row__title">
          {p.titleHref ? (
            <a
              href={p.titleHref}
              tabIndex={-1}
              onClick={(e) => {
                if (isModified(e)) return;
                if (p.onTitle) {
                  e.preventDefault();
                  p.onTitle(e);
                }
              }}
            >
              {p.title}
            </a>
          ) : (
            <span>{p.title}</span>
          )}
        </h4>
        {p.subtitle && <p class="kex-row__sub">{p.subtitle}</p>}
        {p.extra}
        {p.actions && p.actions.length > 0 && (
          <div class="kex-row__actions" role="group" aria-label={p.ariaLabel}>
            {p.actions.map((a) => (
              <button key={a.key} type="button" class={`kex-act${a.on ? ' kex-act--on' : ''}`} data-act={a.key} data-kex-test={a.testId} aria-pressed={a.on} onClick={a.onClick}>
                {a.icon}
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {p.button && (
        <Button variant={p.button.variant} href={p.button.href} newTab={p.button.newTab} testId={p.button.testId} onClick={p.button.onClick}>
          {p.button.label}
        </Button>
      )}
    </li>
  );
}
