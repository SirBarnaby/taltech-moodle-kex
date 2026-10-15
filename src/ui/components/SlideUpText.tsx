import { h, type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { slideUp, type SlideUpOptions } from '../../fx/slideup';
import { resolvedMotion } from '../../state';

interface Props extends Omit<SlideUpOptions, 'reduced'> {
  text: string;
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'p';
  class?: string;
  id?: string;
  testId?: string;
}

/**
 * Slide Up Text. The element is owned by `slideUp` after mount (Preact renders no children), so the full text
 * lives once in a visually hidden span and the animated pieces are aria-hidden.
 */
export function SlideUpText({ text, as = 'span', class: cls, id, testId, ...opts }: Props): ComponentChildren {
  const ref = useRef<HTMLElement>(null);
  const reduced = resolvedMotion.value === 'reduced';
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = slideUp(el, text, { ...optsRef.current, reduced });
    return () => handle.cancel();
  }, [text, reduced]);
  return h(as, { ref, class: `kex-su-host${cls ? ` ${cls}` : ''}`, id, 'data-kex-test': testId });
}
