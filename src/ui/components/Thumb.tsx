import { CircleHelp, Folder, Link as LinkIcon, MessagesSquare, Upload } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import type { Format, Kind } from '../../data/model';
import { videoThumb } from '../../fx/thumbs';
import { heroEffectMode } from '../../state/effects';

export type ThumbVariant = 'doc' | 'code' | 'video' | 'quiz' | 'link' | 'forum' | 'folder' | 'assignment';

export function thumbVariant(kind: Kind, format: Format): ThumbVariant {
  if (kind === 'recording' || format === 'VIDEO') return 'video';
  if (kind === 'assignment') return 'assignment';
  if (kind === 'quiz') return 'quiz';
  if (kind === 'practical') return 'code';
  if (kind === 'discussion') return 'forum';
  if (format === 'FOLDER') return 'folder';
  if (format === 'LINK') return 'link';
  return 'doc';
}

interface ThumbProps {
  variant: ThumbVariant;
  /** Section number shown in doc thumbs ("06"). */
  number?: string;
  format?: Format;
  /** Seed for video frames (the cmid). */
  seed?: number;
  testId?: string;
  size?: 'row' | 'small';
}

function Doc({ number, format }: { number?: string; format?: Format }) {
  const textual = format === 'DOC' || format === 'TEXT' || format === 'PAGE' || format === 'BOOK';
  return (
    <svg class="kex-thumb__svg" viewBox="0 0 134 92" aria-hidden="true" focusable="false" fill="none" stroke="#3b28c4" stroke-width="1.8">
      {number && <text x="16" y="29.5" class="kex-thumb__num" stroke="none">{number}</text>}
      {textual ? (
        <g stroke-linecap="round" stroke-width="1.7">
          {[46, 56, 66, 76].map((y, i) => (
            <path key={y} d={`M36 ${y}H${[104, 92, 100, 70][i]}`} />
          ))}
          <path d="M16 46h5M16 56h5M16 66h5M16 76h5" opacity=".55" />
        </g>
      ) : (
        <g stroke-linejoin="round" stroke-linecap="round">
          <rect x="65.5" y="29.5" width="21.5" height="14.5" rx="1" />
          {format === 'SLIDES' && <path d="M66 48.5h20" stroke-width="2.2" />}
          <path d="M72 44.8L61.5 58" />
          <path d="M80.5 44.8L92.5 58" opacity=".5" stroke-dasharray="3.5 3" />
          <rect x="42.5" y="58.5" width="21" height="14.5" rx="1" />
          <rect x="89.5" y="58.5" width="21" height="14.5" rx="1" />
          <path d="M16 58.5h5.5M16 73h5.5" stroke-width="1.5" opacity=".5" />
          <path d="M16 66h24" stroke-width="1.5" opacity=".6" stroke-dasharray="5 4" />
          <path d="M64 66h25" stroke-width="1.2" opacity=".18" />
        </g>
      )}
    </svg>
  );
}

function Code() {
  return (
    <svg class="kex-thumb__svg" viewBox="0 0 134 92" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="#2d1a96" stroke-width="2">
        <path d="M23 18.6L16.8 24.6L23 30.6" />
        <path d="M29.6 30.8L36 18.4" />
        <path d="M42.6 18.6L48.6 24.6L42.6 30.6" />
      </g>
      {[43, 55, 67, 79].map((y, i) => (
        <g key={y}>
          <path d={`M38 ${y}h${[74, 74, 50, 28][i]}`} stroke="#5f1a98" stroke-width="1.7" />
          <path d={`M16.5 ${y}h5.5`} stroke="#e26dc4" stroke-width="1.5" />
        </g>
      ))}
    </svg>
  );
}

function Video({ seed }: { seed?: number }) {
  const [src, setSrc] = useState<string | undefined>();
  const mode = heroEffectMode.value;
  useEffect(() => {
    let live = true;
    if (seed !== undefined && mode !== 'fallback') void videoThumb(seed).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [seed, mode]);
  return (
    <>
      {src && <img class="kex-thumb__img" src={src} alt="" width="134" height="92" />}
      <svg class="kex-thumb__svg" viewBox="0 0 134 92" aria-hidden="true" focusable="false">
        <circle cx="67" cy="46" r="25" fill="rgba(20,10,52,.38)" stroke="rgba(255,255,255,.62)" stroke-width="1.6" />
        <path d="M63 38.5v15l12.5-7.5z" fill="#fff" />
      </svg>
    </>
  );
}

const GLYPH = { quiz: CircleHelp, link: LinkIcon, forum: MessagesSquare, folder: Folder, assignment: Upload } as const;

export function Thumb({ variant, number, format, seed, testId, size = 'row' }: ThumbProps) {
  let body;
  if (variant === 'doc') body = <Doc number={number} format={format} />;
  else if (variant === 'code') body = <Code />;
  else if (variant === 'video') body = <Video seed={seed} />;
  else {
    const G = GLYPH[variant];
    body = <G class="kex-thumb__glyph" size={28} strokeWidth={1.75} aria-hidden="true" />;
  }
  return (
    <div class={`kex-thumb kex-thumb--${variant} kex-thumb--${size}`} data-kex-test={testId} aria-hidden="true">
      {body}
    </div>
  );
}

/** Date tile for deadline rows (page-designs §2): mono month over a big two-digit day, then the weekday, or an
 *  OVERDUE flag. Magenta when overdue or due within 48 h. */
export function DateTile({ mon, day, sub, overdue, soon, testId }: { mon: string; day: string; sub: string; overdue?: boolean; soon?: boolean; testId?: string }) {
  return (
    <div class={`kex-thumb kex-thumb--date${overdue ? ' kex-thumb--overdue' : ''}${soon ? ' kex-thumb--soon' : ''}`} data-kex-test={testId} aria-hidden="true">
      <span class="kex-thumb__mon kex-mono">{mon}</span>
      <span class="kex-thumb__day">{day}</span>
      <span class={`kex-thumb__sub kex-mono${overdue ? ' kex-thumb__sub--flag' : ''}`}>{sub}</span>
    </div>
  );
}

/** A glyph tile (announcement megaphone, notification bell): doc background with one 28px icon. */
export function GlyphTile({ children, testId }: { children: preact.ComponentChildren; testId?: string }) {
  return (
    <div class="kex-thumb kex-thumb--doc kex-thumb--glyph" data-kex-test={testId} aria-hidden="true">
      {children}
    </div>
  );
}
