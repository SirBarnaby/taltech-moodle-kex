export type DataDomain = 'notices' | 'summaries' | 'deadlines' | 'grades' | 'navigation' | 'calendar' | 'courses' | 'other';
export interface SourceDescriptor { domain: DataDomain; kind: 'api' | 'document' | 'published'; originalPath: string; ttlMs: number }
export interface SourceMetadata extends SourceDescriptor { observedAt?: number; freshness: 'fresh' | 'stale' | 'missing'; refreshing: boolean; failed: boolean }
export interface Sourced<T> { data: T; source: SourceMetadata }

/** Each cached Moodle surface declares its authority and original-page escape. */
export function sourceFor(name: string, ttlMs: number): SourceDescriptor {
  const id = /:(\d+)$/.exec(name)?.[1];
  if (name.startsWith('dashboard:')) return { domain: 'notices', kind: 'document', originalPath: '/my/?kex=off', ttlMs };
  if (name.startsWith('sums:')) return { domain: 'summaries', kind: 'document', originalPath: `/course/view.php?id=${id}&kex=off`, ttlMs };
  if (name === 'events' || name.startsWith('events:course:')) return { domain: 'deadlines', kind: 'api', originalPath: '/calendar/view.php?view=month&kex=off', ttlMs };
  if (name.startsWith('grades:')) return { domain: 'grades', kind: 'document', originalPath: id ? `/grade/report/user/index.php?id=${id}&kex=off` : '/grade/report/overview/index.php?kex=off', ttlMs };
  if (name.startsWith('snav:')) return { domain: 'navigation', kind: 'document', originalPath: `/course/view.php?id=${id}&kex=off`, ttlMs };
  if (/^(courses|mycourses|state:)/.test(name)) return { domain: 'courses', kind: 'api', originalPath: id ? `/course/view.php?id=${id}&kex=off` : '/my/courses.php?kex=off', ttlMs };
  return { domain: 'other', kind: 'api', originalPath: '/my/?kex=off', ttlMs };
}

export function sourceMetadata(source: SourceDescriptor, observedAt: number | undefined, refreshing = false, failed = false, now = Date.now()): SourceMetadata {
  return { ...source, observedAt, freshness: observedAt === undefined ? 'missing' : now - observedAt >= source.ttlMs ? 'stale' : 'fresh', refreshing, failed };
}

export function sourced<T>(data: T, source: SourceDescriptor, observedAt = Date.now()): Sourced<T> {
  return { data, source: sourceMetadata(source, observedAt) };
}
