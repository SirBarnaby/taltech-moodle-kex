/** Custom portrait document and push-pin glyphs from the mock (Lucide's are square / diagonal). */

/** `label` (PDF, PPT, ...) replaces the last text line with the file type in small mono capitals. */
export function DocGlyph({ width = 27, height = 36, label }: { width?: number; height?: number; label?: string }) {
  return (
    <svg class="kex-glyph kex-glyph--doc" width={width} height={height} viewBox="0 0 24 30" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 1.2h12.6l6.9 6.9v19.5a1.2 1.2 0 0 1-1.2 1.2H3a1.2 1.2 0 0 1-1.2-1.2V2.4A1.2 1.2 0 0 1 3 1.2z" />
      <path d="M15.4 1.4v6.8h6.8" />
      {label ? (
        <>
          <path d="M6.5 12.5h11M6.5 17h8" />
          <text x="12.2" y="25.6" text-anchor="middle" class="kex-glyph__label" fill="currentColor" stroke="none">{label}</text>
        </>
      ) : (
        <path d="M6.5 14h11M6.5 19h11M6.5 24h6.5" />
      )}
    </svg>
  );
}

/** Filled upright push-pin. */
export function PinGlyph({ width = 12, height = 18, filled = true }: { width?: number; height?: number; filled?: boolean }) {
  return (
    <svg class="kex-glyph kex-glyph--pin" width={width} height={height} viewBox="0 0 12 18" aria-hidden="true" focusable="false">
      <path
        d="M2.3 .8h7.4v2.3l-1.4.9v4.2l2.6 3.4H1.1l2.6-3.4V4L2.3 3.1z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width={filled ? 0.6 : 1.1}
        stroke-linejoin="round"
      />
      <path d="M6 11.6v5.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  );
}

/** Tight "↗" arrow: the ink fills the box (Lucide's sits inside a 24px box with padding). */
export function ArrowNE({ size = 14, strokeWidth = 1.6, class: cls }: { size?: number; strokeWidth?: number; class?: string }) {
  return (
    <svg class={cls} width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M1.8 12.2L12.2 1.8M4.2 1.8h8v8" />
    </svg>
  );
}

/** Tight "→" arrow (width x width*2/3). */
export function ArrowEast({ size = 17, strokeWidth = 1.6, class: cls }: { size?: number; strokeWidth?: number; class?: string }) {
  return (
    <svg class={cls} width={size} height={Math.round(size * 0.7)} viewBox="0 0 17 12" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M1 6h15M11 1l5 5-5 5" />
    </svg>
  );
}
