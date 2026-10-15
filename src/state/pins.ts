import { computed } from '@preact/signals';
import { cachedStates, statesVersion } from '../data/repo/prefetch';
import { pinsStore } from '../data/repo/pins';

/** cmids of pins whose activity is gone from a course whose state we have cached (page-designs §3, happy-path §1). */
export const unavailablePins = computed<ReadonlySet<number>>(() => {
  void statesVersion.value;
  const pins = pinsStore().value.value ?? [];
  const byCourse = new Map<number, number[]>();
  for (const p of pins) byCourse.set(p.courseId, [...(byCourse.get(p.courseId) ?? []), p.cmid]);
  const gone = new Set<number>();
  for (const st of cachedStates([...byCourse.keys()])) {
    const alive = new Set(st.cms.filter((c) => c.uservisible).map((c) => c.id));
    for (const cmid of byCourse.get(st.courseId) ?? []) if (!alive.has(cmid)) gone.add(cmid);
  }
  return gone;
});
