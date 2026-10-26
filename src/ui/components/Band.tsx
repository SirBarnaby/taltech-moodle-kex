import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { arrivalWelcome, WELCOME_MS } from '../../fx/handoff';
import { t } from '../../i18n';
import { firstName } from '../../lib/contacts';
import { SCHOOLS } from '../../lib/school';
import { activeSchool, user } from '../../state';
import { useRibbons } from './useRibbons';
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
  testId?: string;
}

/**
 * PageChrome / ActivityChrome band (page-designs §0): the hero treatment at 40% shader intensity, one crosshair, a mono label,
 * a slide-up title and optional actions.
 */
export function Band({ label, title, size = 'page', actions, meta, testId = 'band' }: BandProps) {
  const school = activeSchool.value;
  const { canvas, mode } = useRibbons({ seed: 0, intensity: 0.4, leftFade: 0.46, style: SCHOOLS[school].ribbons });
  // Just signed in: Moodle's own dashboard greeting stands where the label is, for a few seconds.
  const name = arrivalWelcome.value && size === 'page' ? firstName(user.value?.fullname) : '';
  useEffect(() => {
    if (!name) return;
    const id = window.setTimeout(() => (arrivalWelcome.value = false), WELCOME_MS);
    return () => window.clearTimeout(id);
  }, [!!name]);
  return (
    <section class={`kex-band kex-band--${size}${title.length > 44 ? ' kex-band--long' : ''}`} data-kex-test={testId} data-mode={mode}>
      <canvas key={school} class="kex-hero__canvas" ref={canvas} aria-hidden="true" />
      <Crosshair class="kex-cross--b" />
      <div class="kex-band__inner">
        <div class="kex-band__text">
          {name ? (
            <p class="kex-band__label kex-band__hello" key="hello" data-kex-test={`${testId}-hello`}>{t('handoff.welcome', { $a: name })}</p>
          ) : (
            <p class="kex-band__label kex-mono" key="label" data-kex-test={`${testId}-label`}>{label}</p>
          )}
          <SlideUpText as="h1" class="kex-band__title" testId={`${testId}-title`} text={title} split="words" stagger={0.06} duration={0.7} delay={0.05} />
          {meta && <div class="kex-band__meta" data-kex-test={`${testId}-meta`}>{meta}</div>}
        </div>
        {actions && <div class="kex-band__actions">{actions}</div>}
      </div>
    </section>
  );
}
