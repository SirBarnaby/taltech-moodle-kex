import { Settings as SettingsIcon, SlidersHorizontal } from 'lucide-preact';
import { go, homeUrl, PAGES } from '../../actions/navigate';
import { updateSettings } from '../../actions/settings';
import { t } from '../../i18n';
import { hooks, quickSettingsOpen, settings } from '../../state';
import { Segmented } from '../components/Segmented';
import { Slider } from '../components/Slider';
import { Switch } from '../components/Switch';
import { Popover } from './Popover';

/**
 * Quick settings popover (sidebar Settings): the look (theme, school colours, animated headers, animations), course pages (compact
 * lists, labs board, rolling edges, new tabs), achievement messages and "KEX on this page". Labels are the same as on the All settings page.
 */
export function QuickSettings({ anchor }: { anchor: HTMLElement | null }) {
  const s = settings.value;
  const close = (): void => {
    quickSettingsOpen.value = false;
  };
  return (
    <Popover anchor={anchor} label={t('settings.title')} onClose={close} testId="quick-settings">
      <div class="kex-pop__section">
        <div class="kex-pop__label">{t('settings.theme')}</div>
        <Segmented
          label={t('settings.theme')}
          value={s.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: t('settings.theme.system') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
        />
      </div>
      <div class="kex-pop__row">
        <label class="kex-pop__rowlabel" for="kex-qs-school">{t('ext.colourSchool')}</label>
        <Switch id="kex-qs-school" label={t('ext.colourSchool')} checked={s.colourBySchool} onChange={(colourBySchool) => updateSettings({ colourBySchool })} />
      </div>
      <div class="kex-pop__row">
        <label class="kex-pop__rowlabel" for="kex-qs-effects">{t('settings.effects')}</label>
        <Switch id="kex-qs-effects" label={t('settings.effects')} checked={s.effects !== 'off'} onChange={(on) => updateSettings({ effects: on ? 'animated' : 'off' })} />
      </div>
      <div class="kex-pop__section">
        <div class="kex-pop__label">{t('settings.motion')}</div>
        <Segmented
          label={t('settings.motion')}
          value={s.motion}
          onChange={(motion) => updateSettings({ motion })}
          options={[
            { value: 'system', label: t('settings.motion.system') },
            { value: 'reduced', label: t('settings.motion.reduced') },
            { value: 'full', label: t('settings.motion.full') },
          ]}
        />
      </div>
      <div class="kex-pop__divider" />
      <div class="kex-pop__row">
        <label class="kex-pop__rowlabel" for="kex-qs-compact">{t('settings.compact')}</label>
        <Switch id="kex-qs-compact" label={t('settings.compact')} checked={s.density === 'compact'} onChange={(on) => updateSettings({ density: on ? 'compact' : 'comfortable' })} />
      </div>
      <div class="kex-pop__row">
        <label class="kex-pop__rowlabel" for="kex-qs-labs">{t('ext.labsView')}</label>
        <Switch id="kex-qs-labs" label={t('ext.labsView')} checked={s.labsView === 'auto'} onChange={(on) => updateSettings({ labsView: on ? 'auto' : 'off' })} />
      </div>
      <div class="kex-pop__row">
        <label class="kex-pop__rowlabel" for="kex-qs-wheel">{t('settings.wheel')}</label>
        <Switch id="kex-qs-wheel" label={t('settings.wheel')} checked={s.wheel} onChange={(on) => updateSettings({ wheel: on })} />
      </div>
      {s.wheel && (
        <div class="kex-pop__section">
          <label class="kex-pop__label" for="kex-qs-wheelk">{t('settings.wheelIntensity')}</label>
          <Slider id="kex-qs-wheelk" label={t('settings.wheelIntensity')} value={s.wheelIntensity} onChange={(wheelIntensity) => updateSettings({ wheelIntensity })} />
        </div>
      )}
      <div class="kex-pop__section">
        <div class="kex-pop__label">{t('ext.newTab')}</div>
        <Segmented
          label={t('ext.newTab')}
          value={s.openInNewTab}
          onChange={(openInNewTab) => updateSettings({ openInNewTab })}
          options={[
            { value: 'never', label: t('ext.newTab.never') },
            { value: 'external', label: t('ext.newTab.external') },
            { value: 'always', label: t('ext.newTab.always') },
          ]}
        />
      </div>
      <div class="kex-pop__divider" />
      {s.achievements && (
        <div class="kex-pop__row">
          <label class="kex-pop__rowlabel" for="kex-qs-toasts">{t('ext.achievementToasts')}</label>
          <Switch id="kex-qs-toasts" label={t('ext.achievementToasts')} checked={s.achievementToasts} onChange={(achievementToasts) => updateSettings({ achievementToasts })} />
        </div>
      )}
      <div class="kex-pop__row">
        <label class="kex-pop__rowlabel" for="kex-qs-on">{t('settings.kexOnPage')}</label>
        <Switch
          id="kex-qs-on"
          label={t('settings.kexOnPage')}
          checked
          onChange={() => {
            close();
            hooks.toggleOriginal();
          }}
        />
      </div>
      <div class="kex-pop__divider" />
      <button type="button" class="kex-pop__item" onClick={() => { close(); hooks.openOptions(); }}>
        <SettingsIcon size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('settings.all')}
      </button>
      <a
        class="kex-pop__item"
        href={homeUrl(PAGES.preferences)}
        data-kex-test="qs-moodle-prefs"
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          close();
          go(homeUrl(PAGES.preferences));
        }}
      >
        <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('settings.moodlePrefs')}
      </a>
    </Popover>
  );
}
