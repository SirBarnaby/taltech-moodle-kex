import type { Cm, Section } from './model';
import { classifyKind } from './classify';
import { cmsOfSection, section0, topicSections, type CourseState } from './repo/coursestate';
import { pad2 } from './topics';

/** Previous and next activity of a course in reading order (section 0 first, then topics), for the activity pages' bottom bar. */

export interface Placed {
  cm: Cm;
  section: Section;
}

export interface Neighbours {
  current: Placed;
  prev?: Placed;
  next?: Placed;
}

/** Every visible activity that is a page of its own (labels and subsection containers are not). */
export function readingOrder(state: CourseState): Placed[] {
  const out: Placed[] = [];
  const sections = [section0(state), ...topicSections(state)].filter((s): s is Section => !!s);
  for (const section of sections) {
    for (const cm of cmsOfSection(state, section)) {
      if (cm.modname === 'label' || cm.modname === 'subsection' || classifyKind({ modname: cm.modname, name: cm.name }) === 'note') continue;
      out.push({ cm, section });
    }
  }
  return out;
}

export function neighboursOf(state: CourseState, cmId: number): Neighbours | undefined {
  const order = readingOrder(state);
  const i = order.findIndex((p) => p.cm.id === cmId);
  const current = order[i];
  if (!current) return undefined;
  return { current, prev: order[i - 1], next: order[i + 1] };
}

/** "05 · Containers & Docker": the topic number and the activity name (section 0 has no number). */
export function placedLabel(p: Placed): string {
  return p.section.number > 0 ? `${pad2(p.section.number)} · ${p.cm.name}` : p.cm.name;
}
