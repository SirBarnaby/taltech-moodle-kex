import {
  BookOpen, Bird, CalendarCheck, Check, Compass, FlaskConical, Flame, GraduationCap, Keyboard, ListChecks, Moon, PieChart, Pin,
  Search, Sprout, Star, Sunrise, Target, Timer, Trophy, Microscope, Repeat, type LucideIcon,
} from 'lucide-preact';
import { defOf, type AchId } from '../../achievements/catalog';

/** The glyph of each achievement: Lucide, the set the rest of the interface uses, so stroke and style match. */
export const GLYPHS: Record<AchId, LucideIcon> = {
  'first-tick': Check,
  'topic-cleared': ListChecks,
  halfway: PieChart,
  'course-complete': GraduationCap,
  'lab-done': FlaskConical,
  'lab-streak': Flame,
  'every-lab': Microscope,
  'early-bird': Bird,
  'clean-slate': CalendarCheck,
  'photo-finish': Timer,
  'full-marks': Star,
  'steady-hand': Target,
  'quick-search': Search,
  pinned: Pin,
  'keyboard-pilot': Keyboard,
  reader: BookOpen,
  explorer: Compass,
  'steady-streak': Repeat,
  'early-start': Sunrise,
  'night-owl': Moon,
  'fresh-start': Sprout,
  collector: Trophy,
};

const ROMAN = ['', 'I', 'II', 'III'] as const;

/** A "+" crosshair mark on the ring, as on the hero. */
const cross = (x: number, y: number): string => `M${x - 3} ${y}h6M${x} ${y - 3}v6`;

export interface MedallionProps {
  id: AchId;
  earned: boolean;
  tier?: 1 | 2 | 3;
  /** Hidden and not earned yet: a question mark instead of the glyph. */
  secret?: boolean;
  size?: number;
  /** The unlock: the medallion pops, its ring draws itself and a sheen sweeps across. */
  unlocking?: boolean;
}

/**
 * One medallion family, so the badges read as a set: a 1 px ring carrying four crosshair marks, a disc, and the glyph. Earned
 * ones take their group's ink; the top tier takes the hero's gradient with a slow sheen; locked ones are outline only.
 */
export function Medallion({ id, earned, tier, secret, size = 56, unlocking }: MedallionProps) {
  const def = defOf(id);
  const Glyph = GLYPHS[id];
  const top = earned && (tier === 3 || (!def.tiers && id === 'collector'));
  const gid = `kex-medal-g-${id}`;
  return (
    <span
      class={`kex-medal${earned ? ' kex-medal--earned' : ''}${top ? ' kex-medal--top' : ''}${unlocking ? ' kex-medal--unlock' : ''}`}
      data-group={def.group}
      style={{ '--kex-medal-size': `${size}px` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#b9a4ff" />
            <stop offset="0.45" stop-color="#eba4f8" />
            <stop offset="1" stop-color="#f8aaf3" />
          </linearGradient>
        </defs>
        <circle class="kex-medal__ring" cx="32" cy="32" r="29" pathLength={100} style={top ? { stroke: `url(#${gid})` } : undefined} />
        <path class="kex-medal__cross" d={`${cross(32, 3)}${cross(61, 32)}${cross(3, 32)}`} />
        <circle class="kex-medal__disc" cx="32" cy="32" r="22" style={top ? { fill: `url(#${gid})` } : undefined} />
        {secret && !earned ? (
          <text class="kex-medal__secret" x="32" y="38.5" text-anchor="middle">?</text>
        ) : (
          <Glyph class="kex-medal__glyph" x={21} y={21} size={22} strokeWidth={1.75} />
        )}
        {tier ? (
          <g class="kex-medal__tier">
            <rect x={tier === 3 ? 22 : tier === 2 ? 24.5 : 27} y="54.5" width={tier === 3 ? 20 : tier === 2 ? 15 : 10} height="9" rx="2" />
            <text x="32" y="61.6" text-anchor="middle">{ROMAN[tier]}</text>
          </g>
        ) : (
          <path class="kex-medal__cross" d={cross(32, 61)} />
        )}
      </svg>
      {earned && <span class="kex-medal__sheen" />}
    </span>
  );
}
