import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { effects } from '../../fx/effects';
import { SCHOOLS } from '../../lib/school';
import { activeSchool } from '../../state';
import { heroEffectMode } from '../../state/effects';
import { Crosshair } from './Hero';
import { SlideUpText } from './SlideUpText';

interface BandProps {
  /** Mono label: "GRADES / ITI8801". */
  label: string;
  title: string;
  /** 132px page band, or the 168px activity band. */
  size?: 'page' | 'activity';
  /** Right-aligned outlined-light buttons. */
  actions?: ComponentChildren;
  /** Line under the title (activity meta: due date, completion). */
  meta?: ComponentChildren;
  seed?: number;
  testId?: string;
}

/**
 * PageChrome / ActivityChrome band (page-designs §0): the hero treatment at 40% shader intensity, one crosshair, a mono label,
 * a slide-up title and optional actions.
 */
export function Band({ label, title, size = 'page', actions, meta, seed = 0, testId = 'band' }: BandProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mode = heroEffectMode.value;
  const school = activeSchool.value;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const handle = effects.register(c, { seed, intensity: 0.4, leftFade: 0.46, style: SCHOOLS[school].ribbons }, (m) => (heroEffectMode.value = m));
    return () => handle.dispose();
  }, [seed, school]);
  return (
    <section class={`kex-band kex-band--${size}${title.length > 44 ? ' kex-band--long' : ''}`} data-kex-test={testId} data-mode={mode}>
      <canvas class="kex-hero__canvas" ref={canvas} aria-hidden="true" />
      <Crosshair class="kex-cross--b" />
      <div class="kex-band__inner">
        <div class="kex-band__text">
          <p class="kex-band__label kex-mono" data-kex-test={`${testId}-label`}>{label}</p>
          <SlideUpText as="h1" class="kex-band__title" testId={`${testId}-title`} text={title} split="words" stagger={0.06} duration={0.7} delay={0.05} />
          {meta && <div class="kex-band__meta" data-kex-test={`${testId}-meta`}>{meta}</div>}
        </div>
        {actions && <div class="kex-band__actions">{actions}</div>}
      </div>
    </section>
  );
}
