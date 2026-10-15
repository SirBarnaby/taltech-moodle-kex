import { X } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { keyManager } from '../../content/keyboard';
import { t } from '../../i18n';
import type { Binding } from '../../lib/keys';
import { helpOpen } from '../../state';
import { KeySpec } from '../components/Kbd';

const GROUPS: Binding['group'][] = ['General', 'Navigate', 'Lists', 'Course', 'Workspace'];

/** Generated from the registered bindings: what is listed is what works. */
export function KeyboardHelp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (prev && document.contains(prev)) prev.focus();
    };
  }, []);

  // Collapse Alt+1..9 into one row; bindings with the same description share a row ("j / ↓").
  const all = keyManager.all();
  const rows = (g: Binding['group']): { specs: string[]; label: string }[] => {
    const byLabel = new Map<string, string[]>();
    for (const b of all) {
      if (b.group !== g || b.keys === 'meta+k' || /^alt\+[2-9]$/.test(b.keys)) continue;
      const label = t(b.description as Parameters<typeof t>[0]);
      const specs = byLabel.get(label) ?? [];
      if (!specs.includes(b.keys)) specs.push(b.keys);
      byLabel.set(label, specs);
    }
    return [...byLabel].map(([label, specs]) => ({ specs, label }));
  };

  return (
    <div class="kex-help-wrap" onPointerDown={(e) => e.target === e.currentTarget && (helpOpen.value = false)}>
      <div ref={ref} class="kex-help" role="dialog" aria-modal="true" aria-label={t('help.title')} data-kex-test="help">
        <div class="kex-help__head">
          <h2>{t('help.title')}</h2>
          <button type="button" class="kex-iconbtn" aria-label={t('help.close')} onClick={() => (helpOpen.value = false)}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div class="kex-help__cols">
          {GROUPS.map((g) => {
            const list = rows(g);
            if (!list.length) return null;
            return (
              <section key={g} class="kex-help__group">
                <h3>{t(`help.group.${g}` as Parameters<typeof t>[0])}</h3>
                <dl>
                  {list.map((r) => (
                    <div key={r.label} class="kex-help__row">
                      <dt>
                        {r.specs.map((spec, i) => (
                          <span key={spec} class="kex-help__spec">
                            {i > 0 && <span class="kex-help__or" aria-hidden="true">/</span>}
                            <KeySpec spec={spec} thenLabel={t('help.then')} />
                            {spec === 'alt+1' && <span class="kex-help__range">…9</span>}
                          </span>
                        ))}
                      </dt>
                      <dd>{r.label}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
