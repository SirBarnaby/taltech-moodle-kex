import { animSettle, animTrack } from './anim';
import { MOTION } from './navigation';
import { motionTier } from './motion';

/** The title moves only with full effects; with effects off or reduced motion it is simply there. */
const titleMoves = (): boolean => motionTier() === 'full';

/** Longest slide of one piece and longest total stagger (seconds): a title never takes longer than a page change. */
const MAX_DURATION = 0.3;
const MAX_STAGGER = 0.25;

/** Slide Up Text (architecture §15): masked pieces slide up with a stagger. Screen readers get the full text once. */

export interface SlideUpOptions {
  split?: 'words' | 'characters' | 'lines';
  /** Seconds between pieces. */
  stagger?: number;
  /** Cap for the whole stagger across all pieces (seconds); default 0.25. */
  maxStagger?: number;
  delay?: number;
  /** Extra delay (seconds) per line index: the coloured second line can arrive after the first and still slide in. */
  lineDelay?: number[];
  from?: 'first' | 'last' | 'center';
  duration?: number;
  ease?: string;
  autoStart?: boolean;
  /** Start when the element first enters the viewport (once). */
  inView?: boolean;
  /** `explicit` splits on "\n"; `auto` keeps one flow and animates by rendered line. */
  lines?: 'explicit' | 'auto';
  /** Paint these lines (0-based; `true` = all) with the hero gradient across the whole line (hero line 2). */
  gradient?: boolean | number[];
  /** No animation: render the final text immediately. */
  reduced?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
}

export interface SlideUpHandle {
  play(): void;
  cancel(): void;
  /** Resolves when the animation finished (immediately when reduced). */
  finished: Promise<void>;
}

export const DEFAULT_EASE = MOTION.ease;

/** Words of a string (whitespace separated). */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Grapheme clusters (Intl.Segmenter, falling back to code points). */
export function splitGraphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  return Array.from(text);
}

export function staggerDelay(i: number, n: number, from: 'first' | 'last' | 'center', stagger: number): number {
  if (from === 'last') return (n - 1 - i) * stagger;
  if (from === 'center') return Math.abs(Math.floor(n / 2) - i) * stagger;
  return i * stagger;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function piece(text: string): { clip: HTMLElement; item: HTMLElement } {
  const clip = el('span', 'kex-su-clip');
  const item = el('span', 'kex-su-item', text);
  clip.appendChild(item);
  return { clip, item };
}

/** Build the DOM for `text` inside `target` and return the animatable items (in reading order). */
export interface SlideUpBuild {
  items: HTMLElement[];
  /** Items per line (one entry when the text is a single flow). */
  lineItems: HTMLElement[][];
}

export function buildSlideUp(target: HTMLElement, text: string, opts: Pick<SlideUpOptions, 'split' | 'lines'> = {}): SlideUpBuild {
  const split = opts.split ?? 'words';
  target.replaceChildren();
  const sr = el('span', 'kex-sr', text.replace(/\s*\n\s*/g, ' ').trim());
  const visual = el('span', 'kex-su');
  visual.setAttribute('aria-hidden', 'true');
  const items: HTMLElement[] = [];
  const lineItems: HTMLElement[][] = [];

  const lineTexts = (opts.lines ?? 'explicit') === 'explicit' ? text.split('\n') : [text];
  lineTexts.forEach((line, li) => {
    const box = lineTexts.length > 1 ? el('span', 'kex-su-line') : visual;
    const mine: HTMLElement[] = [];
    lineItems.push(mine);
    const words = splitWords(line);
    words.forEach((w, wi) => {
      if (split === 'characters') {
        const word = el('span', 'kex-su-word');
        for (const g of splitGraphemes(w)) {
          const p = piece(g);
          items.push(p.item);
          mine.push(p.item);
          word.appendChild(p.clip);
        }
        box.appendChild(word);
      } else {
        const p = piece(w);
        items.push(p.item);
        mine.push(p.item);
        box.appendChild(p.clip);
      }
      if (wi < words.length - 1) box.appendChild(document.createTextNode(' '));
    });
    if (box !== visual) visual.appendChild(box);
    else if (li < lineTexts.length - 1) visual.appendChild(document.createTextNode(' '));
  });
  target.append(sr, visual);
  return { items, lineItems };
}

/**
 * After layout, make each item show its slice of one gradient spanning the whole line. The gradient lives on a static inner
 * `span.kex-su-ink`: the element that moves carries no background (background-clip:text on a moving layer is not reliably painted).
 */
function applyGradient(target: HTMLElement, lines: HTMLElement[][], which: true | number[]): void {
  const origin = target.getBoundingClientRect().left;
  lines.forEach((items, li) => {
    if (which !== true && !which.includes(li)) return;
    const rects = items.map((i) => i.getBoundingClientRect());
    const lineWidth = Math.max(1, ...rects.map((r) => r.right - origin));
    items.forEach((item, idx) => {
      let ink = item.firstElementChild as HTMLElement | null;
      if (!ink?.classList.contains('kex-su-ink')) {
        ink = el('span', 'kex-su-ink', item.textContent ?? '');
        item.replaceChildren(ink);
      }
      ink.style.backgroundSize = `${lineWidth}px 100%`;
      ink.style.backgroundPosition = `-${Math.max(0, (rects[idx]?.left ?? origin) - origin)}px 0`;
    });
  });
}

export function slideUp(target: HTMLElement, text: string, opts: SlideUpOptions = {}): SlideUpHandle {
  const o = { stagger: 0.1, delay: 0, from: 'first', duration: 0.3, ease: DEFAULT_EASE, autoStart: true, ...opts } as Required<Pick<SlideUpOptions, 'stagger' | 'delay' | 'from' | 'duration' | 'ease' | 'autoStart'>> & SlideUpOptions;
  o.duration = Math.min(o.duration, MAX_DURATION);
  const { items, lineItems } = buildSlideUp(target, text, o);
  let animations: Animation[] = [];
  let observer: IntersectionObserver | undefined;
  let started = false;
  let resolve!: () => void;
  const finished = new Promise<void>((r) => (resolve = r));
  if (o.gradient) {
    const gradient = o.gradient;
    applyGradient(target, lineItems, gradient);
    // Measured again once the web font is in (widths change) and when the box is resized.
    const again = (): void => {
      if (target.isConnected) applyGradient(target, lineItems, gradient);
    };
    void document.fonts?.ready.then(again);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(again);
      ro.observe(target);
      void finished.then(() => window.setTimeout(() => ro.disconnect(), 2000));
    }
  }


  const done = (): void => {
    o.onComplete?.();
    resolve();
  };

  const play = (): void => {
    if (started) return;
    started = true;
    observer?.disconnect();
    o.onStart?.();
    if (o.reduced || !titleMoves() || typeof items[0]?.animate !== 'function' || items.length === 0) {
      items.forEach((item) => { item.style.transform = ''; });
      done();
      return;
    }
    const n = items.length;
    // The whole stagger fits in the cap, however many pieces there are.
    const gap = n > 1 ? Math.min(o.stagger, (o.maxStagger ?? MAX_STAGGER) / (n - 1)) : 0;
    const lineOf = new Map<HTMLElement, number>();
    lineItems.forEach((line, li) => line.forEach((item) => lineOf.set(item, li)));
    animations = items.map((item, i) =>
      item.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
        duration: o.duration * 1000,
        delay: (o.delay + staggerDelay(i, n, o.from, gap) + (o.lineDelay?.[lineOf.get(item) ?? 0] ?? 0)) * 1000,
        easing: o.ease,
        fill: 'both',
      }),
    );
    const all = Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(() => {
      // Drop the fill so the text can reflow or be selected without a leftover transform layer.
      animations.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* already gone */
        }
      });
      items.forEach((i) => (i.style.transform = ''));
      done();
    });
    animTrack(all);
  };

  const cancel = (): void => {
    observer?.disconnect();
    animations.forEach((a) => a.cancel());
    animations = [];
    started = true;
    resolve();
  };

  if (o.reduced || !titleMoves()) {
    done();
    started = true;
  } else if (o.inView && typeof IntersectionObserver !== 'undefined') {
    // Hold the pieces below their masks until visible.
    items.forEach((i) => (i.style.transform = 'translateY(110%)'));
    observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && play(), { threshold: 0.1 });
    observer.observe(target);
  } else if (o.autoStart) {
    play();
  } else {
    items.forEach((i) => (i.style.transform = 'translateY(110%)'));
  }
  // Nothing animating (reduced motion, held until in view): the page is settled for tests and screenshots.
  animSettle();
  return { play, cancel, finished };
}
