import { ChevronDown, Languages, Moon, Sun } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { updateSettings } from '../../actions/settings';
import type { GuestModel } from '../../content/skinguestmodel';
import { t } from '../../i18n';
import { resolvedTheme } from '../../state';
import { IconButton } from '../components/IconButton';

/** The signed-out header (see content/skinguest.ts). Words come from Moodle's navbar; only the theme toggle uses our own strings. */

/** Our own TAL TECH | moodle lockup (the same as the sidebar's), on a light or dark header. */
function Wordmark() {
  return (
    <span class="kex-guest__wordmark" role="img" aria-label="TalTech Moodle">
      <span class="kex-guest__wm-a" aria-hidden="true"><span>TAL</span><span>TECH</span></span>
      <span class="kex-guest__wm-div" aria-hidden="true" />
      <span class="kex-guest__wm-b" aria-hidden="true">moodle</span>
    </span>
  );
}

function LangMenu({ model }: { model: GuestModel }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  const current = model.langs.find((l) => l.active) ?? model.langs[0];
  if (model.langs.length < 2 || !current) return null;
  return (
    <div class="kex-guest__lang" ref={box}>
      <button
        type="button"
        class="kex-guest__langbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={model.langLabel || t('login.lang')}
        data-kex-test="guest-lang"
        onClick={() => setOpen(!open)}
      >
        <Languages size={18} strokeWidth={1.75} aria-hidden="true" />
        <span class="kex-guest__langcode">{current.code.toUpperCase()}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <ul class="kex-guest__menu" role="menu">
          {model.langs.map((l) => (
            <li key={l.code} role="none">
              <a role="menuitem" href={l.href || undefined} aria-current={l.active ? 'true' : undefined} lang={l.code}>
                {l.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GuestHeader({ model }: { model: GuestModel }) {
  const dark = resolvedTheme.value === 'dark';
  const flip = (): void => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.kexTheme = next;
    updateSettings({ theme: next });
  };
  return (
    <header class="kex-guest" role="banner" data-kex-test="guest-header">
      <a class="kex-guest__brand" href={model.homeHref}>
        <Wordmark />
      </a>
      {model.nav.length > 0 && (
        <nav class="kex-guest__nav">
          {model.nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={n.active ? 'page' : undefined}>
              {n.text}
            </a>
          ))}
        </nav>
      )}
      <div class="kex-guest__end">
        <LangMenu model={model} />
        <IconButton label={dark ? t('header.themeToLight') : t('header.themeToDark')} testId="guest-theme" onClick={flip}>
          {dark ? <Moon size={20} strokeWidth={1.6} fill="currentColor" aria-hidden="true" /> : <Sun size={22} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />}
        </IconButton>
        {model.login && (
          <a class="kex-guest__login" href={model.login.href} data-kex-test="guest-login">
            {model.login.text}
          </a>
        )}
      </div>
    </header>
  );
}
