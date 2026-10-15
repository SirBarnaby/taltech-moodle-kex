import type { ComponentChildren } from 'preact';
import { keyLabel } from '../../lib/keys';

export function Kbd({ children }: { children: ComponentChildren }) {
  return <kbd class="kex-kbd">{children}</kbd>;
}

/** Render a key spec ("ctrl+k", "g w") as kbd chips. */
export function KeySpec({ spec, thenLabel = 'then' }: { spec: string; thenLabel?: string }) {
  return (
    <span class="kex-keyspec">
      {keyLabel(spec).map((k, i) => (k === 'then' ? <span key={i} class="kex-keyspec__then">{thenLabel}</span> : <Kbd key={i}>{k}</Kbd>))}
    </span>
  );
}
