// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { effectiveMode, resolveRoute, stripBase } from '../../src/content/router';

const r = (path: string, bodyId = 'page-x', classes: string[] = []) => resolveRoute({ path, bodyId, bodyClasses: classes });

describe('router', () => {
  it('resolves every route key and mode', () => {
    const table: [string, string, string, string][] = [
      ['/login/index.php', 'page-login-index', 'login', 'app'],
      ['/my/', 'page-my-index', 'workspace', 'app'],
      ['/my/index.php', 'page-my-index', 'workspace', 'app'],
      ['/my/courses.php', 'page-my-index', 'mycourses', 'app'],
      ['/course/view.php', 'page-course-view-weeks', 'course', 'app'],
      ['/course/section.php', 'page-course-section', 'section', 'app'],
      ['/grade/report/overview/index.php', 'page-grade-report-overview-index', 'grades', 'app'],
      ['/message/output/popup/notifications.php', 'page-message-output-popup-notifications', 'notifications', 'app'],
      ['/mod/quiz/attempt.php', 'page-mod-quiz-attempt', 'quiz-focus', 'skin'],
      ['/mod/forum/view.php', 'page-mod-forum-view', 'activity', 'skin'],
      ['/grade/report/user/index.php', 'page-grade-report-user-index', 'grade-user', 'skin'],
      ['/user/profile.php', 'page-user-profile', 'generic', 'skin'],
      ['/user/index.php', 'page-course-view-participants', 'generic', 'skin'],
      ['/auth/oidc/', 'page-login-index', 'login', 'app'], // the login view is matched by the body id even on odd paths
    ];
    for (const [path, body, key, mode] of table) {
      const route = r(path, body);
      expect([route.key, route.mode], path).toEqual([key, mode]);
    }
  });

  it('keeps teacher edit mode, embedded layouts, popups and id-less documents out', () => {
    expect(r('/course/view.php', 'page-course-view-weeks', ['editing']).mode).toBe('off');
    expect(r('/mod/page/view.php', 'page-mod-page-view', ['pagelayout-embedded']).key).toBe('embedded');
    expect(r('/mod/quiz/attempt.php', 'page-x', ['pagelayout-popup']).mode).toBe('off');
    expect(r('/something.json', '').key).toBe('none');
  });

  it('applies the user\'s per-route override and strips a sub-directory install prefix', () => {
    expect(effectiveMode(r('/my/', 'page-my-index'), {}).effective).toBe('app');
    expect(effectiveMode(r('/my/', 'page-my-index'), { workspace: 'skin' }).effective).toBe('skin');
    expect(effectiveMode(r('/user/profile.php', 'page-user-profile'), { generic: 'off' }).effective).toBe('off');
    expect(effectiveMode(r('/login/index.php', 'page-login-index'), {}).effective).toBe('app');
    expect(effectiveMode(r('/mod/quiz/attempt.php', 'page-mod-quiz-attempt'), {}).effective).toBe('skin');
    expect(stripBase('/moodle/my/', 'https://x.ee/moodle')).toBe('/my/');
    expect(stripBase('/my/', 'https://moodle.taltech.ee')).toBe('/my/');
  });
});
