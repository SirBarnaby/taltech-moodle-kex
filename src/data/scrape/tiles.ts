import { SEL } from '../selectors';
import { cleanText, qsa } from '../../lib/dom';

export interface Tile {
  sectionId: number;
  /** data-section: the section number. */
  number: number;
  title: string;
  /** Photo URL from the tile's inline background-image (absolute), if any. */
  image?: string;
  href?: string;
}

const URL_RE = /url\(\s*(["']?)(.*?)\1\s*\)/i;

/** Tiles-format course page: one entry per `li.tile` (architecture §8.4 `tile`). */
export function scrapeTiles(root: ParentNode): Tile[] {
  const out: Tile[] = [];
  for (const li of qsa<HTMLElement>(root, SEL.tile)) {
    const sectionId = Number(li.getAttribute('data-true-sectionid'));
    if (!Number.isFinite(sectionId) || sectionId <= 0) continue;
    const bg = li.getAttribute('style') ?? '';
    const image = URL_RE.exec(bg)?.[2]?.replace(/&amp;/g, '&');
    out.push({
      sectionId,
      number: Number(li.getAttribute('data-section')) || 0,
      title: cleanText(li.querySelector('h3')),
      image: image || undefined,
      href: li.querySelector<HTMLAnchorElement>('a.tile-link')?.getAttribute('href') ?? undefined,
    });
  }
  return out;
}
