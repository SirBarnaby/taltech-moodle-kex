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
