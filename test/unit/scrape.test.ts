import { describe, expect, it } from 'vitest';
import { scrapeMyoverview } from '../../src/data/scrape/myoverview';
import { scrapeTtLinks, scrapeUser } from '../../src/data/scrape/user';
import { findLogoutHref, scrapeUserMenu } from '../../src/data/scrape/usermenu';
import { loadCapture } from '../fixtures/load';

describe('scrapers on TalTech captures', () => {
  it('user menu: items in order with the logout link flagged', () => {
    const doc = loadCapture('my_');
    const items = scrapeUserMenu(doc);
    expect(items.length).toBeGreaterThan(4);
    expect(items[0]).toMatchObject({ label: 'Profiil', kind: 'link' });
    expect(items.some((i) => i.divider)).toBe(true);
    expect(items.filter((i) => i.kind === 'logout')).toHaveLength(1);
    expect(findLogoutHref(doc)).toContain('/login/logout.php');
  });
  it('user: name from #topbar-username, avatar image', () => {
    const u = scrapeUser(loadCapture('my_'), 333286);
    expect(u?.fullname).toBe('Marten Saluste');
    expect(u?.initials).toBe('MS');
    expect(u?.avatar).toContain('/user/icon/');
  });
  it('tt-level1 links give the real OIS and mail URLs', () => {
    const l = scrapeTtLinks(loadCapture('my_'));
    expect(l.ois).toBe('https://ois2.ttu.ee');
    expect(l.mail).toBe('https://mail.ttu.ee');
  });
  it('myoverview grouping: customfield is_archived = -1', () => {
    const g = scrapeMyoverview(loadCapture('my_courses'));
    expect(g).toEqual({ grouping: 'customfield', customfieldname: 'is_archived', customfieldvalue: '-1' });
  });
});
