/**
 * Selector registry (architecture §8.4). Every list is "first match wins" and must work on both
 * TalTech (Moodle 4.5 / Bootstrap 4) and the lab (Moodle 5.3 / Bootstrap 5). Scrapers never
 * hard-code selectors; they import from here.
 */
export const SEL = {
  cmItem: ['li[data-for="cmitem"][data-id]', 'li.activity[id^="module-"]'],
  cmName: ['.activityname .instancename', '[data-activityname]'],
  cmIcon: ['img.activityicon[src]'],
  cmBadge: ['.activitybadge'],
  cmDates: ['[data-region="activity-dates"] .date-item'],
  cmManualDone: ['button[data-action="toggle-manual-completion"]'],
  cmAutoCompletion: ['[data-region="completion-info"] .badge, [data-region="completion-info"] .completion-info'],
  cmDescription: ['.activity-altcontent .no-overflow, .activity-description .no-overflow, .contentafterlink'],
  cmAvailability: ['.availabilityinfo, [data-region="availabilityinfo"]'],
  cmResourceDetails: ['.resourcelinkdetails'],
  secondaryNav: ['.secondary-navigation li[data-key]', 'nav.moremenu li[data-key]'],
  tile: ['ul.tiles li.tile[data-true-sectionid]'],
  sectionSummary: ['[data-for="sectioninfo"] .summarytext, .summarytext'],
  breadcrumb: ['#page-navbar ol.breadcrumb li'],
  userName: ['#topbar-username', '.usermenu .usertext', '.userinitials[title]', '#user-menu-toggle img.userpicture[alt]', '.logininfo a[href*="/user/profile.php"]'],
  userAvatar: ['#user-menu-toggle img.userpicture', '.usermenu .avatar img'],
  userInitials: ['#user-menu-toggle .userinitials', '.usermenu .userinitials'],
  userMenu: ['#user-action-menu a.dropdown-item'],
  logo: ['.navbar-brand img.logo', '[data-region="site-home-link"] img.logo', '.brand img.brand-img'],
  ttLinks: ['nav.tt-level1 a.tt-level1__link'],
  myoverviewGrouping: ['[data-region="myoverview"] [data-customfieldname]', '#groupingdropdown + .dropdown-menu [aria-current="true"]'],
  loginIdps: ['.potentialidplist .potentialidp a', '.login-identityproviders a'],
  loginForm: ['form#login'],
  loginLang: ['#lang-dropdown .dropdown-item', '.langmenu a'],
  srOnly: ['.sr-only', '.visually-hidden'],
  gradesOverview: ['#overview-grade tbody tr', 'table.generaltable tbody tr'],
  gradeReportTable: ['table.user-grade', 'table#user-grade', 'table[id^="user-grade"]'],
  gradesReportRows: ['.user-grade tbody tr', '#user-grade tbody tr', 'table[id^="user-grade"] tbody tr'],
  gradeValue: ['td.column-grade', 'td.grade'],
  gradeRange: ['td.column-range', 'td.range'],
  gradePercentage: ['td.column-percentage', 'td.percentage'],
  gradeItem: ['th.column-itemname', 'td.column-itemname', '.itemname'],
  gradeActivity: ['a[href*="/mod/"]'],
  gradeCourseTotal: ['.courseitem', '[data-itemtype="course"]'],
  gradeReportLabel: ['thead .column-grade', 'thead th.grade'],
  gradeUnavailable: ['[hidden]', '[aria-hidden="true"]', '.gradehidden', '.hiddenrow', '.hidden', '.dimmed_text'],
  forumDiscussions: ['table.discussion-list tbody tr[data-region="discussion-list-item"]'],
  moodleNavbar: ['nav.navbar.fixed-top', 'nav.navbar'],
} as const satisfies Record<string, readonly string[]>;

export type SelectorName = keyof typeof SEL;
