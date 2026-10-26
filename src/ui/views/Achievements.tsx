import { useEffect, useLayoutEffect } from 'preact/hooks';
import { go } from '../../actions/navigate';
import { updateSettings } from '../../actions/settings';
import { ACH_GROUPS, CATALOG, type AchDef } from '../../achievements/catalog';
import { achCount, earned, evaluateNow, focusAch, statuses, type Earned } from '../../achievements/engine';
import type { Status } from '../../achievements/rules';
import { formatDate, t, type MessageKey } from '../../i18n';
import { pageInfo, settings } from '../../state';
import { Band } from '../components/Band';
import { Button } from '../components/Button';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { Medallion } from '../components/Medallion';
import { EmptyState } from '../components/States';

const isModified = (e: MouseEvent): boolean => e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;

/** Where an achievement was earned: the course, at its topic when there is one. */
function whereHref(got: Earned | undefined): string | undefined {
  if (!got?.courseId) return undefined;
  return `${pageInfo.value?.wwwroot ?? ''}/course/view.php?id=${got.courseId}${got.topic ? `#topic-${got.topic}` : ''}`;
}

function Card({ def, got, status }: { def: AchDef; got?: Earned; status?: Status }) {
  const secret = !!def.hidden && !got;
  const name = secret ? t('ach.hidden') : t(`ach.${def.id}.name` as MessageKey);
  const line = secret ? t('ach.hiddenLine') : t(`ach.${def.id}.line` as MessageKey);
  // Progress towards the next tier only: an earned tier whose count later dropped (a new semester, a tick taken back) shows none.
  const reached = got?.tier && def.tiers ? def.tiers[got.tier - 1] : undefined;
  const p = status?.progress && (!got || (reached !== undefined && got.tier! < 3 && status.progress.of > reached)) ? status.progress : undefined;
  const href = whereHref(got);
  const focused = focusAch.value === def.id;
  const body = (
    <>
      <Medallion id={def.id} earned={!!got} tier={got?.tier} secret={secret} size={60} />
      <span class="kex-ach__text">
        <span class="kex-ach__name">
          {name}
          {got?.tier && def.tiers && <span class="kex-ach__tier kex-mono">{['', 'I', 'II', 'III'][got.tier]}</span>}
        </span>
        <span class="kex-ach__line">{line}</span>
        {got ? (
          <span class="kex-ach__meta kex-mono">{t('ach.earned', { date: formatDate(got.at, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>
        ) : null}
        {p && !secret ? (
          <span class="kex-ach__progress" role="progressbar" aria-valuemin={0} aria-valuemax={p.of} aria-valuenow={p.n} aria-label={name}>
            <span class="kex-ach__bar"><span style={{ width: `${Math.round((p.n / p.of) * 100)}%` }} /></span>
            <span class="kex-mono">{t('ach.progress', { n: p.n, of: p.of })}</span>
          </span>
        ) : null}
      </span>
    </>
  );
  const cls = `kex-ach${got ? ' kex-ach--earned' : ''}${secret ? ' kex-ach--secret' : ''}${focused ? ' kex-ach--focus' : ''}`;
  return (
    <li class={cls} data-group={def.group} data-kex-ach={def.id} data-kex-test={`ach-${def.id}`}>
      {href ? (
        <a class="kex-ach__card" href={href} title={t('ach.where')} onClick={(e) => { if (isModified(e)) return; e.preventDefault(); go(href); }}>{body}</a>
      ) : (
        <div class="kex-ach__card">{body}</div>
      )}
    </li>
  );
}

/** Saavutused: every achievement by group, earned ones with their date, the rest with how far along they are. */
export function AchievementsView() {
  useEffectsConfig();
  useQuietFocus();
  const s = settings.value;
  const got = earned.value;
  const st = statuses.value;
  const count = achCount();
  // Before the first paint (a state change here re-renders in a microtask).
  useLayoutEffect(() => { if (settings.peek().achievements) evaluateNow(); }, []);

  useEffect(() => {
    const id = focusAch.value;
    if (!id) return;
    document.querySelector(`[data-kex-ach="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const off = window.setTimeout(() => (focusAch.value = null), 2400);
    return () => window.clearTimeout(off);
  }, [focusAch.value]);

  return (
    <main class="kex-main kex-achpage" id="kex-main" data-kex-test="achievements-page">
      <Band label={t('ach.label', { n: count.n, of: count.of })} title={t('ach.title')} testId="band" />
      <div class="kex-content">
        {!s.achievements ? (
          <EmptyState kicker={t('ach.label', { n: 0, of: count.of })} title={t('ach.off')} text={t('ach.offText')}>
            <Button variant="outlined" arrow={false} onClick={() => updateSettings({ achievements: true })}>{t('ach.turnOn')}</Button>
          </EmptyState>
        ) : (
          ACH_GROUPS.filter((g) => g !== 'grades' || s.achievementGrades).map((g) => (
            <section class="kex-achgroup" key={g} aria-labelledby={`kex-ach-${g}`}>
              <h2 class="kex-achgroup__kicker kex-mono" id={`kex-ach-${g}`}>{t(`ach.group.${g}` as MessageKey)}</h2>
              <ul class="kex-achgrid">
                {CATALOG.filter((d) => d.group === g).map((d) => <Card key={d.id} def={d} got={got[d.id]} status={st[d.id]} />)}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
