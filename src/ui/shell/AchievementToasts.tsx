import { X } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { go, PAGES } from '../../actions/navigate';
import { defOf } from '../../achievements/catalog';
import { backfilled, dropUnlock, focusAch, unlocks, type Unlock } from '../../achievements/engine';
import { playSparks, type Spark } from '../../fx/particles';
import { t, type MessageKey } from '../../i18n';
import { settings } from '../../state';
import { Medallion } from '../components/Medallion';

const SHOW_MS = 6000;
const MAX = 3;

/** About sixty points of light from the medallion, in its group's ink (light on dark pages, flecks on light ones). */
function burst(el: HTMLElement): void {
  const html = document.documentElement;
  if (html.dataset.kexMotion === 'reduced' || html.dataset.kexEffects === 'off' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const ink = getComputedStyle(el).getPropertyValue('--kex-ach-rgb').trim() || '193,20,254';
  const dark = html.dataset.kexTheme === 'dark';
  const sparks: Spark[] = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 110 + Math.random() * 230;
    return {
      x: cx + Math.cos(a) * r.width * 0.36,
      y: cy + Math.sin(a) * r.height * 0.36,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 40,
      r: 0.9 + Math.random() * 1.6,
      delay: 160 + Math.random() * 90,
      life: 520 + Math.random() * 560,
      rgb: i % 4 === 0 ? (dark ? '255,255,255' : '120,90,200') : ink,
    };
  });
  playSparks(sparks, { drag: 0.3, gravity: 220, blend: dark ? 'light' : 'ink' });
}

function open(id?: Unlock['id']): void {
  focusAch.value = id ?? null;
  go(PAGES.achievements);
}

function Toast({ u, hold }: { u: Unlock; hold: boolean }) {
  const def = defOf(u.id);
  const medal = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (medal.current) burst(medal.current);
  }, []);
  useEffect(() => {
    if (hold) return;
    const id = window.setTimeout(() => dropUnlock(u.key), SHOW_MS);
    return () => window.clearTimeout(id);
  }, [hold]);
  const name = t(`ach.${u.id}.name` as MessageKey);
  return (
    <div class="kex-achtoast" data-group={def.group} data-kex-test="ach-toast">
      <span class="kex-achtoast__medal" ref={medal}>
        <Medallion id={u.id} earned tier={u.tier} size={64} unlocking />
      </span>
      <span class="kex-achtoast__text">
        <span class="kex-achtoast__kicker kex-mono">{t('ach.unlocked')}</span>
        <span class="kex-achtoast__name">
          {name}
          {u.tier && def.tiers ? <span class="kex-ach__tier kex-mono">{['', 'I', 'II', 'III'][u.tier]}</span> : null}
        </span>
        <span class="kex-achtoast__line">{t(`ach.${u.id}.line` as MessageKey)}</span>
      </span>
      <span class="kex-achtoast__actions">
        <button type="button" class="kex-achtoast__view" onClick={() => { dropUnlock(u.key); open(u.id); }}>{t('ach.view')}</button>
        <button type="button" class="kex-achtoast__close" aria-label={t('ach.close')} onClick={() => dropUnlock(u.key)}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/** The first run found what was already done: one message says how many, instead of a toast for each. */
function Found({ n, hold }: { n: number; hold: boolean }) {
  const medal = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (medal.current) burst(medal.current);
  }, []);
  useEffect(() => {
    if (hold) return;
    const id = window.setTimeout(() => (backfilled.value = 0), SHOW_MS + 2000);
    return () => window.clearTimeout(id);
  }, [hold]);
  return (
    <div class="kex-achtoast" data-group="habits" data-kex-test="ach-found">
      <span class="kex-achtoast__medal" ref={medal}>
        <Medallion id="collector" earned size={64} unlocking />
      </span>
      <span class="kex-achtoast__text">
        <span class="kex-achtoast__kicker kex-mono">{t('ach.title').toUpperCase()}</span>
        <span class="kex-achtoast__name">{n === 1 ? t('ach.found1') : t('ach.found', { n })}</span>
      </span>
      <span class="kex-achtoast__actions">
        <button type="button" class="kex-achtoast__view" onClick={() => { backfilled.value = 0; open(); }}>{t('ach.view')}</button>
        <button type="button" class="kex-achtoast__close" aria-label={t('ach.close')} onClick={() => (backfilled.value = 0)}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/**
 * Unlock messages, bottom right: at most three at a time, the rest summed up ("and 4 more"). The pointer or focus anywhere on
 * the stack holds every message, so none leaves (and moves the others) while one is being read.
 */
export function AchievementToasts() {
  const [hold, setHold] = useState(false);
  const s = settings.value;
  const list = unlocks.value;
  const found = backfilled.value;
  const empty = !list.length && !found;
  // The last one closed under the pointer: no mouseleave comes, so the next unlock must not start out held.
  useEffect(() => {
    if (empty) setHold(false);
  }, [empty]);
  if (!s.achievements || !s.achievementToasts || empty) return null;
  const more = list.length - MAX;
  return (
    <div
      class="kex-achtoasts"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusIn={() => setHold(true)}
      onFocusOut={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
    >
      {found > 0 && <Found n={found} hold={hold} />}
      {list.slice(0, MAX).map((u) => <Toast key={u.key} u={u} hold={hold} />)}
      {more > 0 && (
        <button type="button" class="kex-achtoasts__more kex-mono" onClick={() => { unlocks.value = []; open(); }}>{t('ach.more', { n: more })}</button>
      )}
    </div>
  );
}
