/** One place that decides how much motion a view change gets. */
export type MotionTier = 'none' | 'subtle' | 'full';

export function motionTier(): MotionTier {
  const { kexMotion, kexInput, kexEffects } = document.documentElement.dataset;
  if (kexMotion === 'reduced' || kexInput === 'keyboard') return 'none';
  return kexEffects === 'off' ? 'subtle' : 'full';
}

export function scrollBehavior(): ScrollBehavior {
  return motionTier() === 'none' ? 'auto' : 'smooth';
}

/** Shared timing policy. Decorative work yields to the same interactions as navigation. */
export const MOTION = {
  exit: 110,
  enter: 190,
  accentDelay: 700,
  ease: 'cubic-bezier(.23,1,.32,1)',
  press: 120,
  focus: 160,
  overlayEnter: 220,
  overlayExit: 140,
  effectsFrameInterval: 1000 / 30,
  effectsFrameBudget: 4,
  effectsIdleDelay: 50,
  effectsMaxDelta: 50,
  effectsMaxLive: 2,
} as const;

/** CSS and JavaScript consume the same durations, including overlay teardown. */
export function applyMotionTokens(root: HTMLElement): void {
  for (const key of ['exit', 'enter', 'accentDelay', 'press', 'focus', 'overlayEnter', 'overlayExit'] as const) {
    root.style.setProperty(`--kex-motion-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, `${MOTION[key]}ms`);
  }
  root.style.setProperty('--kex-ease-out', MOTION.ease);
}

export function motionAllowed(): boolean {
  const root = document.documentElement;
  return root.dataset.kexMotion !== 'reduced' && root.dataset.kexInput !== 'keyboard'
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
