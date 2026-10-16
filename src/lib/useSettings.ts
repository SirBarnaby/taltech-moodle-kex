import { useEffect, useState } from 'preact/hooks';
import { resolveLang, type Lang } from '../i18n';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, watchSettings, type Settings } from './settings';
import { onStorageChanged, storageGet } from './storage';

export const MOODLE_LANG_KEY = 'kex:moodleLang';

/** Settings for extension pages (popup, options): live over storage.onChanged. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void, boolean] {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadSettings().then((v) => {
      if (alive) {
        setS(v);
        setReady(true);
      }
    });
    const off = watchSettings((v) => alive && setS(v));
    return () => {
      alive = false;
      off();
    };
  }, []);
  const update = (patch: Partial<Settings>): void => {
    setS((cur) => ({ ...cur, ...patch }));
    void saveSettings(patch);
  };
  return [s, update, ready];
}

/** The language of the popup and options page: the setting, with "Follow Moodle" resolved against the last language a Moodle page spoke. */
export function useResolvedLang(setting: Settings['uiLanguage']): Lang {
  const [seen, setSeen] = useState<string>(typeof navigator === 'undefined' ? 'en' : navigator.language);
  useEffect(() => {
    let alive = true;
    void storageGet<string>(MOODLE_LANG_KEY).then((v) => alive && v && setSeen(v));
    const off = onStorageChanged((c) => {
      const v = c[MOODLE_LANG_KEY]?.newValue;
      if (typeof v === 'string') setSeen(v);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return resolveLang(setting, seen);
}
