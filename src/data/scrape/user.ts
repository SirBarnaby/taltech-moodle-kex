import { SEL } from '../selectors';
import { cleanText, qs } from '../../lib/dom';
import type { UserInfo } from '../model';

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || first.slice(0, 2).toUpperCase();
}

/** Name, initials and avatar of the signed-in user from the page's own navbar. */
export function scrapeUser(root: ParentNode, userId: number): UserInfo | null {
  const nameEl = qs(root, SEL.userName);
  let fullname = '';
  if (nameEl) fullname = nameEl.getAttribute('title') || nameEl.getAttribute('alt') || cleanText(nameEl);
  if (!fullname) return null;
  const img = qs<HTMLImageElement>(root, SEL.userAvatar);
  const src = img?.getAttribute('src') ?? '';
  const initialsEl = qs(root, SEL.userInitials);
  return {
    id: userId,
    fullname,
    initials: cleanText(initialsEl) || initialsOf(fullname),
    avatar: src && !/\/u\/f\d/.test(src) ? src : undefined,
  };
}

/** TalTech's own utility bar (nav.tt-level1) carries the real OIS and mail URLs. */
export function scrapeTtLinks(root: ParentNode): { ois?: string; mail?: string } {
  const out: { ois?: string; mail?: string } = {};
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>(SEL.ttLinks[0]))) {
    const text = cleanText(a);
    const href = a.getAttribute('href') ?? '';
    if (/^ÕIS$/i.test(text) || /ois\d?\.ttu\.ee/.test(href)) out.ois = href;
    else if (/e-?mail|meil/i.test(text) || /mail\.ttu\.ee/.test(href)) out.mail = href;
  }
  return out;
}
