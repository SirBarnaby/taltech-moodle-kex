/** Pieces shared by the topic outline and the topic bar: the series badge and the title a topic is shown under. */
import { Check } from 'lucide-preact';
import type { LabState } from '../../data/labtrack';
import type { TopicModel } from '../../data/topics';
import { t } from '../../i18n';
import { STATE_LABEL } from './SubsectionCard';

/** A topic's place in its series, as a small badge on the chip's corner (it never moves the title). */
export function TopicMark({ state }: { state?: LabState }) {
  if (!state || state === 'todo') return null;
  return (
    <span class={`kex-topic__mark kex-topic__mark--${state}`} role="img" aria-label={t(STATE_LABEL[state])} title={t(STATE_LABEL[state])}>
      {state === 'done' ? <Check size={10} strokeWidth={3.2} aria-hidden="true" /> : state === 'overdue' ? '!' : null}
    </span>
  );
}

export const topicDisplayTitle = (tp: Pick<TopicModel, 'isRange' | 'title' | 'section'>): string =>
  tp.isRange ? t('course.weekN', { n: tp.section.number }) : tp.title;
