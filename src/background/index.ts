/** Event page: opens the options page for content scripts (they cannot call openOptionsPage) and normalises settings on install. */
import { loadSettings, saveSettings } from '../lib/settings';

browser.runtime.onMessage.addListener((msg: unknown) => {
  if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'kex:open-options') {
    return browser.runtime.openOptionsPage();
  }
  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  // Storage migrations live here. v0.1 only makes sure the settings blob is present and valid.
  void loadSettings().then((s) => saveSettings(s));
});
