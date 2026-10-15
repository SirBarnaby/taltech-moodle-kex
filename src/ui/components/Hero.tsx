import { useEffect, useRef } from 'preact/hooks';
import { effects } from '../../fx/effects';
import { heroEffectMode } from '../../state/effects';
import { ArrowNE } from './Glyphs';
import { SlideUpText } from './SlideUpText';

export interface HeroLink {
  key: string;
  label: string;
  href?: string;
  onClick?: (e: MouseEvent) => void;
}

interface HeroProps {
  /** "ITI8801 / AUTUMN 2026" */
  label: string;
  /** Title lines (the second one is painted with the gradient). */
  lines: [string, string?];
  links: HeroLink[];
  /** Seed for the shader (course id), so each course has its own phase. */
  seed?: number;
  intensity?: number;
  /** Extra class on the section (page variants). */
  class?: string;
}

/** A single "+" mark (25x25, 1px lines). */
export function Crosshair({ class: cls }: { class: string }) {
  return (
    <svg class={`kex-cross ${cls}`} width="25" height="25" viewBox="0 0 25 25" aria-hidden="true" focusable="false">
      <path d="M12.5 0v25M0 12.5h25" stroke="currentColor" stroke-width="1" fill="none" />
      <rect x="12" y="12" width="1" height="1" fill="currentColor" class="kex-cross__dot" />
    </svg>
  );
}

export function Hero({ label, lines, links, seed = 0, intensity = 1, class: cls }: HeroProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLElement>(null);
  const mode = heroEffectMode.value;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const handle = effects.register(c, { seed, intensity, leftFade: 0.46 }, (m) => (heroEffectMode.value = m));
    const el = root.current;
    const onMove = (e: PointerEvent): void => {
      const r = c.getBoundingClientRect();
      handle.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    el?.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      el?.removeEventListener('pointermove', onMove);
      handle.dispose();
    };
  }, [seed, intensity]);

  const text = lines[1] ? `${lines[0]}\n${lines[1]}` : lines[0];
  return (
    <section class={`kex-hero${cls ? ` ${cls}` : ''}`} ref={root} data-kex-test="hero" data-mode={mode}>
      <canvas class="kex-hero__canvas" ref={canvas} aria-hidden="true" />
      <Crosshair class="kex-cross--a" />
      <Crosshair class="kex-cross--b" />
      <div class="kex-hero__inner">
        <p class="kex-hero__label kex-mono" data-kex-test="hero-label">{label}</p>
        <SlideUpText
          as="h1"
          class="kex-hero__title"
          testId="hero-title"
          text={text}
          split="words"
          stagger={0.06}
          duration={0.7}
          delay={0.05}
          gradient={lines[1] ? [1] : [0]}
        />
        <nav class="kex-hero__links" aria-label={label}>
          {links.map((l) => (
            <a key={l.key} class="kex-hero__link" href={l.href ?? '#'} onClick={l.onClick}>
              <span>{l.label}</span>
              <ArrowNE size={13} strokeWidth={1.5} />
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
