import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, watchSettings, type Settings } from './settings';

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
