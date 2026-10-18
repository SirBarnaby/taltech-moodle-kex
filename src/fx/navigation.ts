/** Short, interruptible view changes. Visual copies never delay the real route or receive input. */
const running = new Map<string, () => void>();

export function viewMotionAllowed(): boolean {
  const { kexMotion, kexInput } = document.documentElement.dataset;
  return kexMotion !== 'reduced' && kexInput !== 'keyboard';
}

export function cancelViewTransitions(): void {
  for (const stop of [...running.values()]) stop();
  running.clear();
}

/** Capture before changing state; call the returned function immediately after the change to reveal its destination. */
export function beginViewTransition(element: HTMLElement | null, scope: 'page' | 'topic'): (selector: string) => void {
  if (scope === 'page') cancelViewTransitions();
  else running.get(scope)?.();
  if (!element || !viewMotionAllowed() || typeof element.animate !== 'function') return () => undefined;
  const root = document.getElementById('kex-root');
  if (!root) return () => undefined;
  const bounds = element.getBoundingClientRect();
  const ghost = element.cloneNode(true) as HTMLElement;
  ghost.classList.add('kex-transition-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  for (const node of [ghost, ...Array.from(ghost.querySelectorAll<HTMLElement>('*'))]) {
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name === 'id' || attribute.name.startsWith('data-kex-')) node.removeAttribute(attribute.name);
    }
  }
  // Copies of interactive media do not preserve a running viewer and should not start a second request.
  ghost.querySelectorAll('iframe, video, audio, canvas').forEach((node) => node.remove());
  Object.assign(ghost.style, { position: 'fixed', top: `${bounds.top}px`, left: `${bounds.left}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', pointerEvents: 'none', zIndex: '24', overflow: 'hidden', background: 'var(--kex-bg)' });
  root.appendChild(ghost);
  const exit = ghost.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-14px)' }], { duration: 110, easing: 'cubic-bezier(.23,1,.32,1)' });
  let frame = 0;
  let enter: Animation | undefined;
  const stop = (): void => {
    cancelAnimationFrame(frame);
    exit.cancel();
    enter?.cancel();
    ghost.remove();
    if (running.get(scope) === stop) running.delete(scope);
  };
  running.set(scope, stop);
  void exit.finished.then(() => ghost.remove(), () => ghost.remove());
  return (selector) => {
    frame = requestAnimationFrame(() => {
      if (running.get(scope) !== stop || !viewMotionAllowed()) return stop();
      const incoming = root.querySelector<HTMLElement>(selector);
      if (!incoming || incoming === element && !incoming.isConnected) return stop();
      enter = incoming.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 190, easing: 'cubic-bezier(.23,1,.32,1)' });
      void enter.finished.then(stop, stop);
    });
  };
}
