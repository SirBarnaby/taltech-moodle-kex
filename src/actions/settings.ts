import { settings } from '../state';
import { normalizeSettings, saveSettings, toBootMirror, writeBootMirror, type Settings } from '../lib/settings';
import { log } from '../lib/log';

/** Update settings: in-memory first (instant UI), boot mirror synchronously (no flash on reload), then storage. */
export function updateSettings(patch: Partial<Settings>): void {
  const next = normalizeSettings({ ...settings.value, ...patch });
  settings.value = next;
  writeBootMirror(toBootMirror(next));
  saveSettings(patch).catch((e: unknown) => log.warn('saving settings failed', e));
}

export function setCourseAlias(courseId: number, alias: string): void {
  const aliases = { ...settings.value.courseAliases };
  const trimmed = alias.trim();
  if (trimmed) aliases[String(courseId)] = trimmed;
  else delete aliases[String(courseId)];
  updateSettings({ courseAliases: aliases });
}
