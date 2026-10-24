import { updateSettings } from './settings';
import { settings } from '../state';
import type { ReaderPrefs } from '../lib/settings';

/** Reader preferences (text size, measure, spacing, font, placement), saved with the other settings. */

export const READER_SIZES = [14, 16, 18, 20, 22] as const;

export function setReader(patch: Partial<ReaderPrefs>): void {
  updateSettings({ reader: { ...settings.value.reader, ...patch } });
}

export function stepReaderSize(delta: 1 | -1): void {
  const size = Math.max(0, Math.min(READER_SIZES.length - 1, settings.value.reader.size + delta));
  if (size !== settings.value.reader.size) setReader({ size });
}
