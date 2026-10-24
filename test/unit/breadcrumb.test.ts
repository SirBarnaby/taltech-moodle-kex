import { describe, expect, it } from 'vitest';
import { parsePageInfo } from '../../src/content/pageinfo';
import { buildBreadcrumb, collapseBreadcrumb } from '../../src/ui/shell/breadcrumb';
import { captureDoc } from '../fixtures/load';

const labels = { home: 'Home', workspace: 'Workspace', mycourses: 'My courses', grades: 'Grades', notifications: 'Notifications' };
const root = 'https://moodle.taltech.ee';
const courses = [{ id: 37829, code: 'ITB8833', url: `${root}/course/view.php?id=37829` }];

describe('buildBreadcrumb', () => {
  it('workspace, my courses and a course page: home, My courses, code (current)', () => {
    const base = { courseId: 1, breadcrumb: [], heading: '', wwwroot: root };
    expect(buildBreadcrumb({ ...base, path: '/my/' }, courses, labels).map((c) => c.text)).toEqual(['Home', 'Workspace']);
    expect(buildBreadcrumb({ ...base, path: '/my/courses.php' }, courses, labels).map((c) => c.text)).toEqual(['Home', 'My courses']);
    const grades = { ...base, breadcrumb: [{ text: 'Student Two', href: `${root}/user/profile.php` }, { text: 'Grades', href: null }], path: '/grade/report/overview/index.php' };
    expect(buildBreadcrumb(grades, courses, labels).map((c) => c.text)).toEqual(['Home', 'Grades']);
    expect(buildBreadcrumb({ ...base, path: '/message/output/popup/notifications.php' }, courses, labels).map((c) => c.text)).toEqual(['Home', 'Notifications']);
    const c = buildBreadcrumb({ courseId: 37829, breadcrumb: [], heading: 'ITB8833 whatever', path: '/course/view.php', wwwroot: root }, courses, labels);
    expect(c.map((x) => x.text)).toEqual(['Home', 'My courses', 'ITB8833']);
    expect(c[2]?.href).toBeNull();
    expect(c[0]?.home).toBe(true);
  });
  it('activity page from the real forum capture: the course crumb becomes the code, the tail is kept', () => {
    const doc = captureDoc('mod_forum_view__id-981476');
    const info = parsePageInfo({ doc, pathname: '/mod/forum/view.php', search: '?id=981476' });
    const c = buildBreadcrumb({ ...info, path: '/mod/forum/view.php' }, courses, labels);
    expect(c.map((x) => x.text)).toEqual(['Home', 'My courses', 'ITB8833', 'Announcements']);
    expect(c[2]?.href).toContain('id=37829');
    expect(c[3]?.href).toBeNull();
  });
  it('falls back to the heading without Moodle crumbs, keeps Moodle crumbs outside a course minus Dashboard, and collapses long trails', () => {
    const c = buildBreadcrumb({ courseId: 2, breadcrumb: [], heading: 'Participants', path: '/user/index.php', wwwroot: root }, [{ id: 2, code: 'ITI8801', url: `${root}/course/view.php?id=2` }], labels);
    expect(c.map((x) => x.text)).toEqual(['Home', 'My courses', 'ITI8801', 'Participants']);
    const outside = buildBreadcrumb(
      { courseId: 1, breadcrumb: [{ text: 'Dashboard', href: `${root}/my/` }, { text: 'Preferences', href: `${root}/user/preferences.php` }, { text: 'Edit profile', href: null }], heading: 'x', path: '/user/edit.php', wwwroot: root },
      [], labels,
    );
    expect(outside.map((x) => x.text)).toEqual(['Home', 'Preferences', 'Edit profile']);
    const crumbs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((t) => ({ text: t, href: '/' + t }));
    const r = collapseBreadcrumb(crumbs);
    expect(r.visible.map((x) => x.text)).toEqual(['a', 'b', 'f', 'g']);
    expect(r.hidden.map((x) => x.text)).toEqual(['c', 'd', 'e']);
    expect(collapseBreadcrumb(crumbs.slice(0, 4)).hidden).toEqual([]);
  });
});
