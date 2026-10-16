/** No-flash probe (debug builds only, plan M6). From the moment `<body>` exists until KEX has settled, every animation frame
 *  checks whether Moodle's own navbar is visible. The result goes to `sessionStorage['kex.firstFrame']` for the Firefox smoke test:
 *  `{ first: { bodyVisibility, navbarVisible }, navbarSeen, frames, settled }`.
 *  `first` is the first frame after the body exists; `navbarSeen` is true if any frame up to two frames after the mode settled
 *  showed the navbar (it is hidden in app and skin modes, and by the gate in between). */
export interface FirstFrame {
  first: { bodyVisibility: string; navbarVisible: boolean };
  navbarSeen: boolean;
  frames: number;
  settled: string;
}

function navbarVisible(): boolean {
  const nav = document.querySelector<HTMLElement>('nav.navbar');
  if (!nav) return false;
  const c = getComputedStyle(nav);
  const r = nav.getBoundingClientRect();
  return c.visibility === 'visible' && c.display !== 'none' && r.width > 0 && r.height > 0;
}

export function startFirstFrameProbe(html: HTMLElement): void {
  let result: FirstFrame | undefined;
  let after = 0;
  const save = (): void => {
    try {
      sessionStorage.setItem('kex.firstFrame', JSON.stringify(result));
    } catch {
      /* storage blocked: the probe is optional */
    }
  };
  const tick = (): void => {
    const body = document.body;
    if (!body) {
      requestAnimationFrame(tick);
      return;
    }
    const visible = navbarVisible();
    if (!result) {
      result = { first: { bodyVisibility: getComputedStyle(body).visibility, navbarVisible: visible }, navbarSeen: visible, frames: 0, settled: 'boot' };
    }
    result.frames += 1;
    if (visible) result.navbarSeen = true;
    const mode = html.dataset.kex ?? 'boot';
    if (mode !== 'boot') {
      result.settled = mode;
      after += 1;
    }
    save();
    if (after < 3 && result.frames < 400) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
