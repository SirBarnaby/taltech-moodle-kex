import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { lang } from '../i18n';
import { resolveTheme } from '../lib/theme';
import { useResolvedLang, useSettings } from '../lib/useSettings';
import { Segmented } from '../ui/components/Segmented';
import { Switch } from '../ui/components/Switch';
import { t } from '../i18n';

function Popup() {
  const [s, update, ready] = useSettings();
  const resolved = useResolvedLang(s.uiLanguage);
  lang.value = resolved;
  useEffect(() => {
    document.documentElement.dataset.kexTheme = resolveTheme(s.theme);
    document.documentElement.lang = resolved;
  }, [s.theme, resolved]);
  if (!ready) return null;
  return (
    <main class="ext-popup">
      <header class="ext-popup__head">
        <span class="ext-popup__mark" aria-hidden="true">KEX</span>
        <div>
          <h1>TalTech Moodle KEX</h1>
          <p class="ext-mono">v{__VERSION__}</p>
        </div>
      </header>
      <div class="ext-row">
        <label for="p-enabled">{t('ext.enabled')}</label>
        <Switch id="p-enabled" label={t('ext.enabled')} checked={s.enabled} onChange={(enabled) => update({ enabled })} />
      </div>
      <div class="ext-row">
        <label for="p-fx">{t('settings.effects')}</label>
        <Switch id="p-fx" label={t('settings.effects')} checked={s.effects !== 'off'} onChange={(on) => update({ effects: on ? 'animated' : 'off' })} />
      </div>
      <div class="ext-block">
        <div class="ext-label">{t('settings.theme')}</div>
        <Segmented
          label={t('settings.theme')}
          value={s.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'system', label: t('settings.theme.system') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
        />
      </div>
      <button type="button" class="ext-btn" onClick={() => void browser.runtime.openOptionsPage().then(() => window.close())}>
        {t('settings.all')}
      </button>
    </main>
  );
}

render(<Popup />, document.getElementById('kex-root')!);
