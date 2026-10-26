/**
 * After a sign-in, the ribbons drawn on the first page start fast and bright and settle (fx/handoff). Surfaces created while
 * the hand-off is still waiting for the shell (the shell renders before the arrival starts) wait for the start.
 */
const RUSH_MS = 1600;
let armed = false;
let since = -Infinity;

/** The hand-off is waiting: surfaces created now follow the rush once it starts. */
export function armArrivalRush(on: boolean): void {
  armed = on;
}

export function startArrivalRush(): void {
  armed = false;
  since = performance.now();
}

/** Drive `set` (a surface's rush setter) through the arrival's rush, if one is armed or running. Returns the stop function. */
export function followArrivalRush(set: (r: number) => void): () => void {
  let raf = 0;
  let stopped = false;
  const step = (now: number): void => {
    if (stopped) return;
    if (armed) {
      raf = requestAnimationFrame(step);
      return;
    }
    const k = (now - since) / RUSH_MS;
    if (k >= 1) {
      set(0);
      return;
    }
    if (k >= 0) set((1 - k) ** 2);
    raf = requestAnimationFrame(step);
  };
  if (armed || performance.now() - since < RUSH_MS) raf = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
