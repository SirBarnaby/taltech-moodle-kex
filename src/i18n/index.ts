import { computed, signal } from '@preact/signals';
import { en, type MessageKey } from './en';
import { et } from './et';

export type { MessageKey };
export type Lang = 'en' | 'et';

export const lang = signal<Lang>('en');

const tables: Record<Lang, Record<MessageKey, string>> = { en, et };
const messages = computed(() => tables[lang.value]);

/** Translate. Reads the `lang` signal, so components re-render when the UI language changes. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let s: string = messages.value[key] ?? en[key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Dates use the UI language's locale, 24 h, the browser's timezone. */
export function formatDate(d: Date | number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(lang.value === 'et' ? 'et-EE' : 'en-GB', { hour12: false, ...opts }).format(d);
}

export const collator = (): Intl.Collator => new Intl.Collator(lang.value === 'et' ? 'et' : 'en');
