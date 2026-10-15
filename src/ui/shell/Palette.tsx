import { BookOpen, FileText, GraduationCap, Hash, PanelsTopLeft, Pin, Search, Zap, type LucideIcon } from 'lucide-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { go } from '../../actions/navigate';
import { t, type MessageKey } from '../../i18n';
import { buildPaletteEntries } from '../../search/entries';
import { search, type Entry, type GroupKey, type ResultRow } from '../../search';
import { activeCourseId, paletteOpen } from '../../state';
import { Kbd } from '../components/Kbd';

type IconType = LucideIcon;

const GROUP_LABEL: Record<GroupKey, MessageKey> = {
  pins: 'palette.group.pins',
  courses: 'palette.group.courses',
  topics: 'palette.group.topics',
  materials: 'palette.group.materials',
  pages: 'palette.group.pages',
  actions: 'palette.group.actions',
  other: 'palette.group.other',
};

const ICON: Record<Entry['type'], IconType> = {
  course: GraduationCap,
  topic: Hash,
  cm: FileText,
  page: PanelsTopLeft,
  action: Zap,
  pin: Pin,
};

function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (!ranges.length) return <>{text}</>;
  const parts: preact.ComponentChildren[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) parts.push(text.slice(at, a));
    parts.push(<mark key={i}>{text.slice(a, b)}</mark>);
    at = b;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** Command palette (Ctrl+K, "/"): ARIA combobox + listbox over courses, pages, actions and pins. */
export function Palette() {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const entries = useMemo(() => buildPaletteEntries(), []);
  const groups = useMemo(() => search(entries, query, { activeCourseId: activeCourseId.value }), [entries, query]);
  const rows = useMemo(() => groups.flatMap((g) => g.rows.map((r) => ({ ...r, group: g.key }))), [groups]);

  // Focus the input on open and give focus back to what had it on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => {
      if (prev && document.contains(prev)) prev.focus();
    };
  }, []);

  useEffect(() => setSel(0), [query]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel, rows]);

  const close = (): void => {
    paletteOpen.value = false;
  };

  const activate = (row: ResultRow | undefined, newTab: boolean): void => {
    if (!row) return;
    const e = row.entry;
    close();
    if (e.run) e.run();
    else if (e.url) go(e.url, newTab);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (rows.length) setSel((sel + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(rows[sel], e.ctrlKey || e.metaKey);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (!groups.length) return;
      const keys = rows.map((r) => r.group);
      const cur = keys[sel];
      const dir = e.shiftKey ? -1 : 1;
      const order = groups.map((g) => g.key);
      const next = order[(order.indexOf(cur as GroupKey) + dir + order.length) % order.length];
      const first = keys.indexOf(next as GroupKey);
      if (first >= 0) setSel(first);
    }
  };

  const activeId = rows[sel] ? `kex-pal-opt-${sel}` : undefined;
  let flat = -1;
  return (
    <div class="kex-palette-wrap" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="kex-palette" role="dialog" aria-modal="true" aria-label={t('palette.label')} data-kex-test="palette">
        <div class="kex-palette__input">
          <Search size={20} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="kex-pal-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autocomplete="off"
            spellcheck={false}
            placeholder={t('palette.placeholder')}
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={onKeyDown}
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul class="kex-palette__list" id="kex-pal-list" role="listbox" aria-label={t('palette.label')} ref={list}>
          {groups.map((g) => (
            <li key={g.key} role="presentation">
              <div class="kex-palette__group" id={`kex-pal-g-${g.key}`}>{t(GROUP_LABEL[g.key])}</div>
              <ul role="group" aria-labelledby={`kex-pal-g-${g.key}`}>
                {g.rows.map((r) => {
                  flat++;
                  const i = flat;
                  const Icon = ICON[r.entry.type] ?? BookOpen;
                  return (
                    <li
                      key={r.entry.id}
                      id={`kex-pal-opt-${i}`}
                      role="option"
                      aria-selected={i === sel}
                      class={`kex-palette__row${i === sel ? ' kex-palette__row--sel' : ''}`}
                      onPointerMove={() => i !== sel && setSel(i)}
                      onClick={(e) => activate(r, e.ctrlKey || e.metaKey)}
                    >
                      <span class="kex-palette__icon"><Icon size={16} strokeWidth={1.75} aria-hidden="true" /></span>
                      <span class="kex-palette__title">
                        <Highlight text={r.entry.title} ranges={r.ranges} />
                        {r.entry.subtitle && <span class="kex-palette__sub">{r.entry.subtitle}</span>}
                      </span>
                      {r.entry.meta && <span class="kex-palette__meta">{r.entry.meta}</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {!rows.length && <li class="kex-palette__empty" role="presentation">{t('palette.empty')}</li>}
        </ul>
        <div class="kex-palette__foot" aria-hidden="true">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> {t('palette.hint.navigate')}</span>
          <span><Kbd>↵</Kbd> {t('palette.hint.open')}</span>
          <span><Kbd>Ctrl</Kbd><Kbd>↵</Kbd> {t('palette.hint.newTab')}</span>
          {rows[sel]?.entry.cmId !== undefined && <span><Kbd>Alt</Kbd><Kbd>P</Kbd> {t('palette.hint.pin')}</span>}
          <span><Kbd>Esc</Kbd> {t('palette.hint.close')}</span>
        </div>
      </div>
    </div>
  );
}
