import { describe, expect, it } from 'vitest';
import { effectiveMode, resolveRoute, stripBase } from '../../src/content/router';

const r = (path: string, bodyId = 'page-x', classes: string[] = []) => resolveRoute({ path, bodyId, bodyClasses: classes });

describe('resolveRoute', () => {
  it.each([
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
  ])('%s -> %s', (path, body, key, mode) => {
    const route = r(path, body);
    expect(route.key).toBe(key);
    expect(route.mode).toBe(mode);
  });

  it('login is matched by the body id even on odd paths', () => {
    expect(r('/auth/oidc/', 'page-login-index').key).toBe('login');
  });
  it('teacher edit mode is off; embedded layouts are off', () => {
    expect(r('/course/view.php', 'page-course-view-weeks', ['editing']).mode).toBe('off');
    expect(r('/mod/page/view.php', 'page-mod-page-view', ['pagelayout-embedded']).key).toBe('embedded');
    expect(r('/mod/quiz/attempt.php', 'page-x', ['pagelayout-popup']).mode).toBe('off');
  });
  it('documents without a page- id are not routed', () => {
    expect(r('/something.json', '').key).toBe('none');
  });
});

describe('effectiveMode', () => {
  it('renders app routes as skin until their view ships, and respects overrides', () => {
    expect(effectiveMode(r('/my/', 'page-my-index'), {}).effective).toBe('skin');
    expect(effectiveMode(r('/user/profile.php', 'page-user-profile'), { generic: 'off' }).effective).toBe('off');
  });
  it('keeps login and quiz attempts pure Moodle until M5/M4', () => {
    expect(effectiveMode(r('/login/index.php', 'page-login-index'), {}).effective).toBe('off');
    expect(effectiveMode(r('/mod/quiz/attempt.php', 'page-mod-quiz-attempt'), {}).effective).toBe('off');
  });
});

describe('stripBase', () => {
  it('removes a sub-directory install prefix', () => {
    expect(stripBase('/moodle/my/', 'https://x.ee/moodle')).toBe('/my/');
    expect(stripBase('/my/', 'https://moodle.taltech.ee')).toBe('/my/');
  });
});
