import type { Crumb, PageInfo } from '../../content/pageinfo';
import type { Course } from '../../data/model';

export interface ShellCrumb {
  text: string;
  href: string | null;
  /** Rendered as the home icon. */
  home?: boolean;
}

export interface BreadcrumbLabels {
  home: string;
  workspace: string;
  mycourses: string;
  grades?: string;
  notifications?: string;
}

const courseIdOf = (href: string | null): number | null => {
  const m = href ? /\/course\/view\.php\?(?:[^#]*&)?id=(\d+)/.exec(href) : null;
  return m ? Number(m[1]) : null;
};

/**
 * Normalised breadcrumb: ⌂ → My courses → <course code> → …rest of Moodle's crumbs.
 * Moodle's first crumb differs per version (a Dashboard/Home crumb, or the course itself), so we rebuild the prefix
 * from the page context and keep only the tail that follows the course crumb.
 */
export function buildBreadcrumb(
  info: Pick<PageInfo, 'courseId' | 'breadcrumb' | 'heading'> & { path: string; wwwroot: string },
  courses: readonly Pick<Course, 'id' | 'code' | 'url'>[],
  labels: BreadcrumbLabels,
): ShellCrumb[] {
  const root = info.wwwroot;
  const home: ShellCrumb = { text: labels.home, href: `${root}/my/courses.php`, home: true };
  const { path } = info;

  if (path === '/my/' || path === '/my/index.php') return [home, { text: labels.workspace, href: null }];
  if (path === '/my/courses.php') return [home, { text: labels.mycourses, href: null }];
  // Moodle titles these pages with the user's name; the shell names the page itself.
  if (labels.grades && path === '/grade/report/overview/index.php' && info.courseId <= 1) return [home, { text: labels.grades, href: null }];
  if (labels.notifications && path === '/message/output/popup/notifications.php') return [home, { text: labels.notifications, href: null }];

  const out: ShellCrumb[] = [home];
  if (info.courseId > 1) {
    out.push({ text: labels.mycourses, href: `${root}/my/courses.php` });
    const known = courses.find((c) => c.id === info.courseId);
    const courseIdx = info.breadcrumb.findIndex((c) => courseIdOf(c.href) === info.courseId);
    const courseCrumb = courseIdx >= 0 ? info.breadcrumb[courseIdx] : undefined;
    const code = known?.code ?? courseCodeFromText(courseCrumb?.text) ?? courseCodeFromText(info.heading);
    const url = known?.url ?? courseCrumb?.href ?? `${root}/course/view.php?id=${info.courseId}`;
    const tail: Crumb[] = courseIdx >= 0 ? info.breadcrumb.slice(courseIdx + 1) : [];
    const isCoursePage = path === '/course/view.php';
    out.push({ text: code ?? courseCrumb?.text ?? info.heading, href: isCoursePage ? null : url });
    if (!isCoursePage) {
      if (tail.length) tail.forEach((c, i) => out.push({ text: c.text, href: i === tail.length - 1 ? null : c.href }));
      else if (info.heading && info.heading !== code) out.push({ text: info.heading, href: null });
    }
    return out;
  }

  // Pages outside any course: keep Moodle's own trail (minus a leading Home/Dashboard crumb) or fall back to the heading.
  const trail = info.breadcrumb.filter((c) => !/\/my\/?$/.test(c.href ?? '') && !/^(home|dashboard|töölaud|avaleht)$/i.test(c.text));
  if (trail.length) trail.forEach((c, i) => out.push({ text: c.text, href: i === trail.length - 1 ? null : c.href }));
  else if (info.heading) out.push({ text: info.heading, href: null });
  return out;
}

function courseCodeFromText(text: string | undefined): string | null {
  return text ? (/\b[A-Z]{3}\d{4}\b/.exec(text)?.[0] ?? null) : null;
}

/** Collapse the middle of a long trail into an ellipsis group: keep home, the second crumb, and the last two. */
export function collapseBreadcrumb(crumbs: ShellCrumb[], max = 5): { visible: ShellCrumb[]; hidden: ShellCrumb[]; at: number } {
  if (crumbs.length <= max) return { visible: crumbs, hidden: [], at: -1 };
  const keepHead = 2;
  const keepTail = 2;
  const hidden = crumbs.slice(keepHead, crumbs.length - keepTail);
  return { visible: [...crumbs.slice(0, keepHead), ...crumbs.slice(crumbs.length - keepTail)], hidden, at: keepHead };
}
