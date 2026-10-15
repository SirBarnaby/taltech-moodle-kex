import { t } from '../i18n';
import { getErrors } from '../lib/log';

export type PillVariant = 'off' | 'disabled' | 'error';

export interface PillOptions {
  variant: PillVariant;
  /** Turn KEX back on (off), enable globally (disabled) or retry (error). */
  onPrimary: () => void;
  /** "Always for this page type" (off variant only). */
  onAlways?: () => void;
}

const ID = 'kex-offpill';
const COLLAPSE_MS = 4000;
let timer: number | undefined;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function hideOffPill(): void {
  window.clearTimeout(timer);
  document.getElementById(ID)?.remove();
}

/**
 * The pill lives outside #kex-root so it survives unmounting. It is the last element in <body>, so Tab reaches it.
 * It collapses to a small magenta dot after 4 s and expands on hover or focus (error variant stays open).
 */
export function showOffPill(opts: PillOptions): void {
  hideOffPill();
  const host = document.body;
  if (!host) return;
  const pill = el('div', 'kex-offpill');
  pill.id = ID;
  pill.setAttribute('role', 'region');
  pill.setAttribute('aria-label', 'KEX');
  pill.dataset.variant = opts.variant;
  pill.dataset.collapsed = 'false';
  pill.lang = 'en';

  const main = el('button', 'kex-offpill__main');
  main.type = 'button';
  const dot = el('span', 'kex-offpill__dot');
  dot.setAttribute('aria-hidden', 'true');
  main.append(dot);

  if (opts.variant === 'off') {
    main.append(el('span', 'kex-offpill__text', t('pill.off') + ' · '), el('kbd', 'kex-offpill__kbd', 'Alt+Shift+O'));
    main.setAttribute('aria-label', `${t('pill.turnOn')} (Alt+Shift+O)`);
    main.addEventListener('click', opts.onPrimary);
    pill.append(main);
    if (opts.onAlways) {
      const always = el('button', 'kex-offpill__link', t('pill.always'));
      always.type = 'button';
      always.addEventListener('click', opts.onAlways);
      pill.append(always);
    }
  } else if (opts.variant === 'disabled') {
    main.append(el('span', 'kex-offpill__text', t('pill.disabled')));
    pill.append(main);
    const enable = el('button', 'kex-offpill__link', t('pill.enable'));
    enable.type = 'button';
    enable.addEventListener('click', opts.onPrimary);
    pill.append(enable);
  } else {
    main.append(el('span', 'kex-offpill__text', t('pill.error')));
    main.disabled = true;
    pill.append(main);
    const retry = el('button', 'kex-offpill__link', t('pill.retry'));
    retry.type = 'button';
    retry.addEventListener('click', opts.onPrimary);
    const details = el('button', 'kex-offpill__link', t('pill.details'));
    details.type = 'button';
    details.setAttribute('aria-expanded', 'false');
    const panel = el('pre', 'kex-offpill__details');
    panel.hidden = true;
    details.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      details.setAttribute('aria-expanded', String(!panel.hidden));
      details.textContent = panel.hidden ? t('pill.details') : t('pill.dismiss');
      const errs = getErrors();
      panel.textContent = errs.length
        ? errs.map((e) => `${new Date(e.at).toLocaleTimeString()} ${e.where}: ${e.message}`).join('\n')
        : t('pill.noErrors');
    });
    pill.append(retry, details, panel);
  }
  host.append(pill);

  if (opts.variant !== 'error') {
    timer = window.setTimeout(() => {
      pill.dataset.collapsed = 'true';
    }, COLLAPSE_MS);
    const expand = (): void => {
      pill.dataset.collapsed = 'false';
    };
    pill.addEventListener('pointerenter', expand);
    pill.addEventListener('focusin', expand);
  }
}
