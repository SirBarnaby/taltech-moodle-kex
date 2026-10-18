import type { GradeStat } from '../../data/scrape/grades';
import { lang, t } from '../../i18n';

interface GradeMeterProps {
  grade: GradeStat;
  label?: string;
  /** Course overview already prints Moodle's raw grade beside this compact statistic. */
  compact?: boolean;
}

/** A grade is a score, never the course's activity-completion percentage. */
export function GradeMeter({ grade, label, compact = false }: GradeMeterProps) {
  const percent = grade.percentage;
  if (percent === undefined || !Number.isFinite(percent)) return null;
  const format = new Intl.NumberFormat(lang.value, { maximumFractionDigits: 1 });
  const percentage = `${format.format(percent)}%`;
  const pointFormat = new Intl.NumberFormat(lang.value, { maximumFractionDigits: 10 });
  const points = grade.maximum !== undefined && !/[/%]/.test(grade.grade) ? `${grade.grade} / ${pointFormat.format(grade.maximum)}` : grade.grade;
  return (
    <span
      class={`kex-grade-meter${compact ? ' kex-grade-meter--compact' : ''}`}
      role="meter"
      aria-label={label ?? grade.label ?? t('gr.title')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.max(0, percent))}
      aria-valuetext={`${points}, ${percentage}`}
    >
      <span class="kex-grade-meter__values kex-mono" aria-hidden="true">
        {!compact && <span class="kex-grade-meter__points">{points}</span>}
        <span class="kex-grade-meter__percent">{percentage}</span>
      </span>
      <span class="kex-grade-meter__track" aria-hidden="true">
        <span class="kex-grade-meter__fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </span>
    </span>
  );
}
