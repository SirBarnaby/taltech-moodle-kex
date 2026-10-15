import { SEL } from '../selectors';
import { qs } from '../../lib/dom';

export interface MyoverviewGrouping {
  grouping: string;
  customfieldname?: string;
  customfieldvalue?: string;
}

/** Reads the myoverview block's current grouping from /my/ or /my/courses.php markup (TalTech 4.5 and Moodle 5.x). */
export function scrapeMyoverview(root: ParentNode): MyoverviewGrouping | null {
  const el = qs<HTMLElement>(root, SEL.myoverviewGrouping);
  const view = el?.closest<HTMLElement>('[data-region="courses-view"]') ?? root.querySelector<HTMLElement>('[data-region="courses-view"]');
  if (!view) return null;
  const grouping = view.dataset.grouping ?? '';
  if (!grouping) return null;
  return {
    grouping,
    customfieldname: view.dataset.customfieldname || undefined,
    customfieldvalue: view.dataset.customfieldvalue || undefined,
  };
}
