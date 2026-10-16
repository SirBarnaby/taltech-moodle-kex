import { SEL } from '../selectors';
import { cleanText, qs, qsa } from '../../lib/dom';

/**
 * What the Login view needs from Moodle's own login page (page-designs §1). Works on TalTech's page (identity-provider buttons, a hidden
 * username/password form, a language dropdown, a FAQ sheet) and on stock Moodle 5 (the form shown directly).
 */

export interface LoginIdp {
  href: string;
  title: string;
}

export interface LoginLang {
  code: string;
  label: string;
  href: string;
  active: boolean;
}

export interface LoginModel {
  idps: LoginIdp[];
  /** Moodle's own `form#login` (kept in the DOM, moved into our panel). */
  form: HTMLFormElement | null;
  /** The form sits behind "More sign-in options" (identity providers exist); otherwise it is shown directly. */
  formHidden: boolean;
  langs: LoginLang[];
  error?: string;
  /** TalTech's `#faq-container` (moved into our sheet), or the service-desk link of `.tt-level1`. */
  faq: HTMLElement | null;
  helpHref?: string;
  brandSrc?: string;
  /** Link of the forgotten-password page, when Moodle shows one. */
  forgotHref?: string;
}

const LANG_CODE = /[?&]lang=([a-z]{2}(?:_[a-z]+)?)/i;

export function scrapeLogin(doc: Document): LoginModel {
  const idps = qsa<HTMLAnchorElement>(doc, SEL.loginIdps)
    .map((a) => ({ href: a.href || a.getAttribute('href') || '', title: a.getAttribute('title') || cleanText(a) }))
    .filter((i) => i.href);
  const form = qs<HTMLFormElement>(doc, SEL.loginForm);
  const htmlLang = (doc.documentElement.lang || '').slice(0, 2).toLowerCase();
  const bodyLang = /\blang-([a-z]{2})\b/.exec(doc.body?.className ?? '')?.[1] ?? htmlLang;
  const langs = qsa<HTMLAnchorElement>(doc, SEL.loginLang)
    .map((a) => {
      const href = a.getAttribute('href') ?? '';
      const code = (LANG_CODE.exec(href)?.[1] ?? /\(([a-z]{2})\)/i.exec(cleanText(a))?.[1] ?? '').slice(0, 2).toLowerCase();
      return { code, label: code.toUpperCase(), href, active: a.getAttribute('aria-current') === 'true' || a.classList.contains('active') || code === bodyLang };
    })
    .filter((l) => l.code);
  const errEl = doc.querySelector('#loginerrormessage, .loginerrors .alert-danger, .loginerrors, #region-main .alert-danger, [role="main"] .alert-danger');
  const faq = doc.querySelector<HTMLElement>('#faq-container');
  const help = Array.from(doc.querySelectorAll<HTMLAnchorElement>('nav.tt-level1 a')).find((a) => /^(abi|help)$/i.test(cleanText(a)));
  const forgot = doc.querySelector<HTMLAnchorElement>('a[href*="forgot_password.php"]');
  return {
    idps,
    form,
    formHidden: idps.length > 0,
    langs,
    error: errEl ? cleanText(errEl) : undefined,
    faq,
    helpHref: help?.href,
    brandSrc: qs<HTMLImageElement>(doc, SEL.logo)?.getAttribute('src') ?? undefined,
    forgotHref: forgot?.href,
  };
}

/** Index of the provider shown as primary: the last used one, else Uni-ID, else the first. */
export function primaryIdp(idps: readonly { href: string; title: string }[], last: string | undefined): number {
  const byLast = last ? idps.findIndex((i) => i.href === last) : -1;
  if (byLast >= 0) return byLast;
  const uni = idps.findIndex((i) => /uni-?id|oidc/i.test(`${i.title} ${i.href}`));
  return uni >= 0 ? uni : 0;
}
