import { ArrowRight, ChevronDown, CircleHelp, X } from 'lucide-preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { heroCanvas } from '../../fx/heroCanvas';
import { MOTION } from '../../fx/navigation';
import { primaryIdp, type LoginModel } from '../../data/scrape/login';
import { t } from '../../i18n';
import { heroEffectMode } from '../../state/effects';
import { Crosshair } from '../components/Hero';
import { SlideUpText } from '../components/SlideUpText';
import { useEffectsConfig } from '../components/hooks';
import { Segmented } from '../components/Segmented';

/** The login page (page-designs §1): the ribbons canvas on the left, the sign-in panel on the right. Moodle's links and form stay Moodle's. */

const LAST_KEY = 'kex.lastIdp';

function readLast(): string | undefined {
  try {
    return localStorage.getItem(LAST_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveLast(href: string): void {
  try {
    localStorage.setItem(LAST_KEY, href);
  } catch {
    /* private mode: nothing to remember */
  }
}

/** Hosts a node from Moodle's own page inside our panel, and puts it back when the view goes away. */
function Moved({ node, class: cls, testId }: { node: HTMLElement | null; class: string; testId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || !node) return;
    const parent = node.parentNode;
    const next = node.nextSibling;
    el.appendChild(node);
    return () => {
      if (parent?.isConnected) parent.insertBefore(node, next);
      else node.remove();
    };
  }, [node]);
  return <div class={cls} ref={host} data-kex-test={testId} />;
}

function Art() {
  const host = useRef<HTMLElement>(null);
  const mode = heroEffectMode.value;
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    return heroCanvas.attach(el, { seed: 11, intensity: 1.15, leftFade: 0 });
  }, []);
  return (
    <section class="kex-login__art" ref={host} data-mode={mode} aria-hidden="true">
      <Crosshair class="kex-cross--a" />
      <Crosshair class="kex-cross--b" />
      <div class="kex-login__art-text">
        <p class="kex-mono kex-login__label">{t('login.label')}</p>
        <SlideUpText as="div" class="kex-login__title" text={`${t('login.title1')}\n${t('login.title2')}`} split="words" stagger={0.08} duration={0.8} delay={0.1} lineDelay={[0, MOTION.accentDelay / 1000]} gradient={[1]} />
      </div>
    </section>
  );
}

/** Our own TAL TECH | moodle lockup (same as the sidebar's). The site logo is never used here: on a guest page it may
 *  be a lazy or blocked image that renders as a broken-image icon with alt text. */
function Brand() {
  return (
    <span class="kex-login__wordmark" role="img" aria-label="TalTech Moodle">
      <span class="kex-login__wm-a" aria-hidden="true"><span>TAL</span><span>TECH</span></span>
      <span class="kex-login__wm-div" aria-hidden="true" />
      <span class="kex-login__wm-b" aria-hidden="true">moodle</span>
    </span>
  );
}

export interface LoginViewProps {
  model: LoginModel;
  /** A signed-in user opened the login page: offer a single way on. */
  loggedIn: boolean;
  continueHref: string;
}

export function LoginView({ model, loggedIn, continueHref }: LoginViewProps) {
  useEffectsConfig();
  const [last, setLast] = useState<string | undefined>(readLast);
  const [more, setMore] = useState(!model.formHidden);
  const [help, setHelp] = useState(false);
  const primary = primaryIdp(model.idps, last);
  const hasForm = !!model.form;

  const follow = (i: number): void => {
    const idp = model.idps[i];
    if (!idp) return;
    saveLast(idp.href);
    setLast(idp.href);
    location.assign(idp.href);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const typing = e.target instanceof Element && !!e.target.closest('input, textarea, select, [contenteditable="true"]');
      const onControl = e.target instanceof Element && !!e.target.closest('a[href], button, summary');
      if (e.key === 'Escape' && help) {
        setHelp(false);
        return;
      }
      if (typing) return;
      if (/^[1-9]$/.test(e.key) && model.idps[Number(e.key) - 1]) {
        e.preventDefault();
        follow(Number(e.key) - 1);
      } else if (e.key.toLowerCase() === 'm' && hasForm && model.formHidden) {
        e.preventDefault();
        setMore((v) => !v);
      } else if (e.key === 'Enter' && !onControl) {
        if (loggedIn) location.assign(continueHref);
        else if (model.idps.length) {
          e.preventDefault();
          follow(primary);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Focus the first thing a keyboard user needs.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(loggedIn ? '[data-kex-test="login-continue"]' : '[data-kex-test="login-idp"][data-primary="true"], #kex-root form#login input:not([type="hidden"]):not([disabled])');
    el?.focus({ preventScroll: true });
  }, [loggedIn]);

  return (
    <main class="kex-login" data-kex-test="login">
      <Art />
      <section class="kex-login__panel" aria-labelledby="kex-login-title">
        <header class="kex-login__top">
          <Brand />
          {model.langs.length > 1 && (
            <Segmented
              label={t('login.lang')}
              value={model.langs.find((l) => l.active)?.code ?? model.langs[0]?.code ?? ''}
              options={model.langs.map((l) => ({ value: l.code, label: l.label }))}
              onChange={(code) => {
                const l = model.langs.find((x) => x.code === code);
                if (l) location.assign(l.href);
              }}
            />
          )}
        </header>
        <div class="kex-login__body">
          <p class="kex-mono kex-login__kicker">{t('login.kicker')}</p>
          <h1 id="kex-login-title" class="kex-login__welcome">{t('login.welcome')}</h1>
          {model.error && !loggedIn && (
            <div class="kex-login__alert" role="alert" data-kex-test="login-error">
              <strong>{t('login.error')}</strong>
              <span>{model.error}</span>
            </div>
          )}
          {loggedIn ? (
            <div class="kex-login__signed">
              <p>{t('login.loggedIn')}</p>
              <a class="kex-login__btn kex-login__btn--primary" href={continueHref} data-kex-test="login-continue">
                {t('login.continue')}
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <>
              {model.idps.length > 0 && (
                <div class="kex-login__idps" role="group" aria-label={t('login.idps')} data-kex-test="login-idps">
                  {model.idps.map((idp, i) => (
                    <a
                      key={idp.href}
                      class={`kex-login__idp${i === primary ? ' kex-login__idp--primary' : ''}`}
                      href={idp.href}
                      title={idp.title}
                      data-kex-test="login-idp"
                      data-primary={i === primary}
                      onClick={() => saveLast(idp.href)}
                    >
                      <span>{idp.title}</span>
                      {i < 9 && <kbd class="kex-kbd">{i + 1}</kbd>}
                    </a>
                  ))}
                </div>
              )}
              {hasForm && model.formHidden && (
                <button type="button" class="kex-login__more" aria-expanded={more} aria-controls="kex-login-form" data-kex-test="login-more" onClick={() => setMore((v) => !v)}>
                  {more ? t('login.less') : t('login.more')}
                  <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" class={more ? 'kex-login__chev kex-login__chev--open' : 'kex-login__chev'} />
                  <kbd class="kex-kbd">M</kbd>
                </button>
              )}
              {hasForm && (
                <div id="kex-login-form" class="kex-login__form" hidden={!more}>
                  <Moved node={model.form} class="kex-login__form-host" testId="login-form" />
                </div>
              )}
            </>
          )}
        </div>
        <footer class="kex-login__foot">
          {(model.faq || model.helpHref) && (
            model.helpHref && !model.faq ? (
              <a class="kex-login__helpbtn" href={model.helpHref} target="_blank" rel="noopener" data-kex-test="login-help">
                <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
                {t('login.help')}
              </a>
            ) : (
              <button type="button" class="kex-login__helpbtn" aria-expanded={help} data-kex-test="login-help" onClick={() => setHelp((v) => !v)}>
                <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
                {t('login.help')}
              </button>
            )
          )}
        </footer>
        {model.faq && (
          <div class="kex-login__sheet" hidden={!help} role="dialog" aria-label={t('login.help')} data-kex-test="login-sheet">
            <button type="button" class="kex-login__sheet-close" aria-label={t('login.helpClose')} onClick={() => setHelp(false)}>
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Moved node={model.faq} class="kex-login__sheet-body" />
          </div>
        )}
      </section>
    </main>
  );
}
