import { computed, signal } from '@preact/signals';
import { en, type MessageKey } from './en';
import { et } from './et';

export type { MessageKey };
export type Lang = 'en' | 'et';
/** The `uiLanguage` setting: 'auto' follows the language Moodle itself speaks. */
export type LangSetting = 'auto' | Lang;

/** The language in use (already resolved: never 'auto'). */
export const lang = signal<Lang>('en');

/** Strings Moodle itself delivered for the language in `forLang` (see ./moodle). Wins over our tables for the keys it covers. */
export const moodleStrings = signal<{ forLang: Lang; map: Partial<Record<MessageKey, string>> } | undefined>(undefined);

const tables: Record<Lang, Record<MessageKey, string>> = { en, et };
const messages = computed(() => tables[lang.value]);

/** 'et' or 'en' from a BCP-47 tag or Moodle's lang code ("et", "et_EE", "en-GB"). Anything else is English. */
export function langFromTag(tag: string | null | undefined): Lang {
  return /^et(?:[-_]|$)/i.test((tag ?? '').trim()) ? 'et' : 'en';
}

/** The setting resolved against the page: `pageLang` is `<html lang>` (or the browser's language on extension pages). */
export function resolveLang(setting: LangSetting, pageLang: string | null | undefined): Lang {
  return setting === 'auto' ? langFromTag(pageLang) : setting;
}

/** Translate. Reads the `lang` signal, so components re-render when the UI language changes. Moodle's own wording wins where it has one. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const m = moodleStrings.value;
  let s: string = (m && m.forLang === lang.value ? m.map[key] : undefined) ?? messages.value[key] ?? en[key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Dates use the UI language's locale, 24 h, the browser's timezone. */
export function formatDate(d: Date | number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(lang.value === 'et' ? 'et-EE' : 'en-GB', { hour12: false, ...opts }).format(d);
}

export const collator = (): Intl.Collator => new Intl.Collator(lang.value === 'et' ? 'et' : 'en');
