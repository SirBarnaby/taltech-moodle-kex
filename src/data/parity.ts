export interface ParityItem { key: string; title: string; disposition: 'shown' | 'mapped' | 'original'; path: string }
const DESTINATIONS: Record<string, string> = {
  myoverview: '/my/courses.php', timeline: '/my/?view=dossier#deadlines',
  recentlyaccessedcourses: '/my/courses.php#all', calendar_month: '/calendar/view.php?view=month',
  searchcourses: '/course/search.php',
};
const EDITORIAL = new Set(['html', 'advnotifications', 'news_items']);

/** Unknown blocks remain discoverable, even when their interactive Moodle widget cannot be copied. */
export function inventoryMoodleBlocks(doc: Document): ParityItem[] {
  return [...doc.querySelectorAll<HTMLElement>('[data-block]')].map((block) => {
    const key = block.dataset.block ?? '';
    const title = block.querySelector('h2, h3, .card-title')?.textContent?.trim() || key;
    return { key, title, disposition: EDITORIAL.has(key) ? 'shown' : DESTINATIONS[key] ? 'mapped' : 'original', path: DESTINATIONS[key] ?? '/my/?kex=off' };
  });
}
