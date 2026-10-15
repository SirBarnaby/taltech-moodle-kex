/** One level of Undo (`z`), valid for 5.5 s after the action (pin, unpin, done, reorder, remove, rename, hide). */
let undoFn: { run: () => void; at: number } | undefined;

export function setUndo(run: () => void): void {
  undoFn = { run, at: Date.now() };
}

export function undoLast(): void {
  if (!undoFn || Date.now() - undoFn.at > 5500) return;
  const u = undoFn;
  undoFn = undefined;
  u.run();
}
