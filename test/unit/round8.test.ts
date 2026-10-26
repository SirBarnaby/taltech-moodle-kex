import { describe, expect, it } from 'vitest';
import { contrast, inkPage, parseColor, resolved } from '../../src/content/darkink';

const DARK = { r: 15, g: 11, b: 31, a: 1 };

describe('round 8', () => {
  it('teacher colours read in the dark theme, keep the original, and never touch an editor', () => {
    document.body.innerHTML = `
      <div class="no-overflow">
        <p><span id="black" style="color:#000000">black</span> <span id="red" style="color: rgb(153, 0, 0)">dark red</span>
          <font id="font" color="navy">navy</font> <span id="ok" style="color:#e0e0ff">already light</span></p>
        <table><tr><td id="white" style="background-color:#ffffff">cell</td><td id="note" style="background:#fffbcc"><b id="inner" style="color:#333">note</b></td>
          <td id="mid" style="background:#3366cc"><span id="onmid" style="color:#000">designed pairing</span></td></tr></table>
        <span id="marker" style="background-color: yellow">marker</span>
      </div>
      <div class="no-overflow"><div contenteditable="true"><span id="edit" style="color:#000">draft</span></div></div>`;
    inkPage(document);
    const ink = (id: string): string | undefined => document.getElementById(id)?.style.getPropertyValue('--kex-ink') || undefined;
    const paint = (id: string): string | undefined => document.getElementById(id)?.style.getPropertyValue('--kex-paint') || undefined;
    // Neutral dark text becomes body text; coloured text keeps its hue and reaches 4.5:1; light text is left alone.
    expect(ink('black')).toBe('var(--kex-text-2)');
    for (const id of ['red', 'font']) {
      const c = resolved(ink(id) ?? '');
      expect(c && contrast(c, DARK)).toBeGreaterThanOrEqual(4.5);
    }
    const red = parseColor(ink('red'));
    expect(red && red.r > red.g && red.r > red.b).toBe(true);
    expect(ink('ok')).toBeUndefined();
    // White dissolves, pastel and highlighter turn into a dark tint; a dark-on-mid pairing the teacher chose stays as it is.
    expect(paint('white')).toBe('transparent');
    const TEXT = resolved('var(--kex-text-2)') ?? DARK;
    for (const id of ['note', 'marker']) expect(contrast(TEXT, resolved(paint(id) ?? '') ?? DARK)).toBeGreaterThanOrEqual(4.5);
    const marker = parseColor(paint('marker'));
    expect(marker && marker.r > marker.b && marker.g > marker.b).toBe(true);
    expect(paint('mid')).toBeUndefined();
    expect(ink('onmid')).toBeUndefined();
    expect(ink('inner')).toBe('var(--kex-text-2)');
    // The teacher's own value stays in place (the light theme shows it), and an editable region is never marked.
    expect(parseColor(document.getElementById('black')?.style.color)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(document.getElementById('edit')?.dataset.kexInk).toBeUndefined();
    expect(ink('edit')).toBeUndefined();
  });
});
