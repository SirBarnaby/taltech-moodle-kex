import { scrapeDashboard } from './scrape/dashboard';
import { scrapeGradeOverview } from './scrape/grades';
import { scrapeSecondaryNav } from './scrape/secondarynav';
import { scrapeSummaries } from './scrape/summaries';
import { sourced, sourceFor } from './sources';

/** Normalize detached and live Moodle documents through the same typed boundary. */
export function readMoodleContent(doc: Document, url: URL, observedAt = Date.now()) {
  const id = Number(url.searchParams.get('id')) || 0;
  const base = url.origin;
  return {
    notices: sourced(scrapeDashboard(doc, base), sourceFor('dashboard:editorial', 600_000), observedAt),
    summaries: sourced(scrapeSummaries(doc), sourceFor(`sums:${id}`, 600_000), observedAt),
    navigation: sourced(scrapeSecondaryNav(doc), sourceFor(`snav:${id}`, 600_000), observedAt),
    grades: sourced(scrapeGradeOverview(doc), sourceFor('grades:overview', 1_800_000), observedAt),
  };
}
