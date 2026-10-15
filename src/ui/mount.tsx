import { render } from 'preact';
import { ErrorBoundary, Shell } from './shell/Shell';

/** Render the shell into `root`. Errors thrown while rendering go to `onError` (the controller fails open). */
export function mountShell(root: HTMLElement, onError: (e: unknown) => void): void {
  render(
    // Deferred: unmounting from inside Preact's commit phase corrupts the tree.
    <ErrorBoundary onError={(e) => queueMicrotask(() => onError(e))}>
      <Shell />
    </ErrorBoundary>,
    root,
  );
}

export function unmountShell(root: HTMLElement): void {
  render(null, root);
}
