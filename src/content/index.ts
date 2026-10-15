import { effect } from '@preact/signals';
import { cache } from '../data/cache';
import { createCoursesStore, loadCustomField } from '../data/repo/courses';
import { cachedUser, fetchUser, storeUser } from '../data/repo/user';
import { scrapeMyoverview } from '../data/scrape/myoverview';
import { scrapeSummaries } from '../data/scrape/summaries';
import { scrapeTiles } from '../data/scrape/tiles';
import { setTileList } from '../actions/course';
import { courseBindings, previewBindings } from '../actions/coursekeys';
import { activityBindings, focusBindings } from '../actions/skinkeys';
import { watchSkinPage } from '../actions/skin';
import { chromeKeys } from '../state/skin';
import { mycoursesBindings, pinnedBindings, workspaceBindings, workspacePreviewBindings } from '../actions/wskeys';
import { configureCounts, countsStore } from '../data/repo/counts';
import { configureNotifs } from '../data/repo/notifs';
import { prefetchStates } from '../data/repo/prefetch';
import { wsPreview } from '../state/workspace';
import { previewCmId, summaries } from '../state/course';
import { scrapeTtLinks, scrapeUser } from '../data/scrape/user';
import { scrapeUserMenu } from '../data/scrape/usermenu';
import { ws } from '../data/ws';
import { SEL } from '../data/selectors';
import { lang } from '../i18n';
import { qs, safeSessionStorage } from '../lib/dom';
import { DEBUG, recordError } from '../lib/log';
import {
  readBootMirror, toBootMirror, watchSettings, writeBootMirror, loadSettings, DEFAULT_SETTINGS, type Settings,
} from '../lib/settings';
import { applyShellAttrs, shellAttrs } from '../lib/theme';
import { mountShell, unmountShell } from '../ui/mount';
import {
  coursesLoading, coursesRaw, hash as hashSig, hooks, logoSrc, pageInfo, resolvedMotion, resolvedTheme, route as routeSig, settings, sidebarCourses, sidebarMode,
  systemDark, ttLinks, user, userMenuItems, viewportWidth,
} from '../state';
import { updateSettings } from '../actions/settings';
import { pushToast } from '../actions/toasts';
import { t } from '../i18n';
import { documentElementReady, domContentLoaded, looksLikeMoodle, waitForBody } from './boot';
import { globalBindings, isOriginalToggle, keyManager, toggleOriginalFromKey } from './keyboard';
import { getMode, setMode } from './modes';
import { hideOffPill, showOffPill } from './offpill';
import { parsePageInfo, type PageInfo } from './pageinfo';
import { effectiveMode, resolveRoute, stripBase, type EffectiveRoute } from './router';

/** Failsafe from architecture §5.2: if the shell has not mounted after 3 s, show plain Moodle. */
const FAILSAFE_MS = 3000;

type OffReason = 'manual' | 'route' | 'setting' | 'disabled';

const offKey = (routeKey: string): string => `kex.off.${routeKey}`;

class Controller {
  private html!: HTMLElement;
  private root: HTMLElement | null = null;
  private route: EffectiveRoute | null = null;
  private info: PageInfo | null = null;
  private failTimer: number | undefined;
  private stops: (() => void)[] = [];
  private bindingsOff: (() => void) | null = null;
  private booting = false;
  private mounted = false;
  private preload: Promise<void> | null = null;
  private settingsLoaded: Promise<Settings> | null = null;
  private dcl: Promise<void> = domContentLoaded();

  async start(): Promise<void> {
    this.html = await documentElementReady();
    // Alt+Shift+O must work in every state (on, off, error).
    window.addEventListener('keydown', (e) => isOriginalToggle(e) && toggleOriginalFromKey(e), true);
    hooks.toggleOriginal = () => this.toggleOriginal();
    hooks.openOptions = () => {
      void browser.runtime.sendMessage({ type: 'kex:open-options' }).catch(() => undefined);
    };
    hooks.moodleLayout = () => {
      // Moodle's own content inside our shell: the app view goes away, the page comes back.
      if (this.route) {
        this.route = { ...this.route, effective: 'skin' };
        routeSig.value = this.route;
      }
      setMode('skin');
    };

    this.preload = cache.preload().catch((e: unknown) => recordError('cache.preload', e));
    this.settingsLoaded = loadSettings().catch(() => DEFAULT_SETTINGS);
    watchSettings((s) => this.onRemoteSettings(s));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (systemDark.value = e.matches));

    if (!readBootMirror().enabled) {
      void this.settingsLoaded.then((s) => this.goDisabled(s));
      setMode('off');
      return;
    }
    await this.boot();
  }

  // ---------------------------------------------------------------- boot

  private applyAttrs(s: Pick<Settings, 'theme' | 'effects' | 'motion' | 'sidebarCollapsed'>): void {
    const focus = this.route?.key === 'quiz-focus' && this.route.effective === 'skin';
    applyShellAttrs(this.html, shellAttrs(focus ? { ...s, sidebarCollapsed: true } : s, window.innerWidth));
  }

  private async boot(): Promise<void> {
    if (this.booting || this.mounted) return;
    this.booting = true;
    try {
      this.applyAttrs(readBootMirror());
      setMode('boot');
      window.clearTimeout(this.failTimer);
      this.failTimer = window.setTimeout(() => this.failOpen('timeout'), FAILSAFE_MS);

      const body = await waitForBody(this.html);
      if (!looksLikeMoodle(body)) return this.settleOff(false);

      const s = await (this.settingsLoaded ?? loadSettings());
      await this.preload;
      settings.value = s;
      lang.value = s.uiLanguage;
      if (!s.enabled) return this.goDisabled(s);

      const info = parsePageInfo({ doc: document, pathname: location.pathname, search: location.search });
      this.info = info;
      if (info.isGuest || !info.sesskey) return this.settleOff(false);

      const base = resolveRoute({ path: stripBase(location.pathname, info.wwwroot), bodyId: body.id, bodyClasses: Array.from(body.classList) });
      const eff = effectiveMode(base, s.routeModes);
      this.route = eff;
      routeSig.value = eff;
      pageInfo.value = info;

      if (eff.effective === 'off') {
        const silent = base.mode === 'off' || eff.key === 'login';
        const userChoice = s.routeModes[eff.key] === 'off';
        return this.settleOff(!silent && userChoice && s.showOffPill, 'setting');
      }
      if (safeSessionStorage()?.getItem(offKey(eff.key)) === '1') return this.settleOff(s.showOffPill, 'manual');

      await this.mount(eff);
    } catch (e) {
      recordError('boot', e);
      this.failOpen('boot');
    } finally {
      this.booting = false;
    }
  }

  /** Leave Moodle as it is. With `pill`, offer the way back. */
  private settleOff(pill: boolean, reason: OffReason = 'route'): void {
    window.clearTimeout(this.failTimer);
    setMode('off');
    if (pill) {
      showOffPill({
        variant: 'off',
        onPrimary: () => this.turnOn(),
        onAlways: reason === 'manual' ? () => this.alwaysOff() : undefined,
      });
    }
  }

  private async mount(eff: EffectiveRoute): Promise<void> {
    const info = this.info!;
    const body = document.body;
    const s = settings.value;
    ws.configure(info.wwwroot, info.sesskey);
    cache.bind(location.host, info.userId);
    configureCounts(info.userId);
    configureNotifs(info.userId);

    this.syncAttrs();
    const root = document.createElement('div');
    root.id = 'kex-root';
    root.lang = s.uiLanguage;
    body.insertBefore(root, body.firstChild);
    this.root = root;

    user.value = cachedUser();
    const store = createCoursesStore(
      {
        userId: info.userId,
        wwwroot: info.wwwroot,
        lang: () => settings.value.uiLanguage,
        getCustomField: async () => {
          const onMy = eff.key === 'workspace' || eff.key === 'mycourses';
          if (onMy) await this.dcl;
          return loadCustomField(document, onMy, (path) => this.fetchText(info.wwwroot + path));
        },
      },
      () => settings.value.sidebarSource,
    );
    this.stops.push(
      effect(() => {
        coursesRaw.value = store.value.value ?? [];
        coursesLoading.value = store.status.value === 'loading' && store.value.value === undefined;
        this.html.dataset.kexData = store.status.value === 'loading' ? 'loading' : 'idle';
      }),
      effect(() => {
        // Freeze the sidebar order the first time a course is seen; courses that appear later are appended.
        const shown = sidebarCourses.value.map((c) => c.id);
        const known = new Set(settings.value.courseOrder);
        if (shown.length && shown.some((id) => !known.has(id))) {
          updateSettings({ courseOrder: [...settings.value.courseOrder.filter((id) => shown.includes(id)), ...shown.filter((id) => !known.has(id))] });
        }
      }),
      effect(() => {
        // Settings drive html attributes and the boot mirror (theme flips are visible instantly).
        const s2 = settings.value;
        void viewportWidth.value;
        void resolvedTheme.value;
        void resolvedMotion.value;
        void sidebarMode.value;
        this.syncAttrs();
        lang.value = s2.uiLanguage;
        if (this.root) this.root.lang = s2.uiLanguage;
      }),
    );

    mountShell(root, (e) => this.failOpen('shell', e));
    keyManager.attach();
    this.bindingsOff = keyManager.register(globalBindings());
    if (eff.effective === 'app' && (eff.key === 'course' || eff.key === 'section')) {
      const off = keyManager.register([...courseBindings(), ...previewBindings()]);
      keyManager.setScope('course', true);
      this.stops.push(
        effect(() => keyManager.setScope('preview', previewCmId.value !== undefined)),
        () => {
          off();
          keyManager.setScope('course', false);
          keyManager.setScope('preview', false);
        },
      );
    }
    if (eff.effective === 'app' && (eff.key === 'workspace' || eff.key === 'mycourses')) {
      // The Pinned page is the Workspace route with `#pinned`; its keys follow the hash (one set registered at a time).
      const wsPrev = keyManager.register(workspacePreviewBindings());
      this.stops.push(
        effect(() => {
          const view = eff.key === 'mycourses' ? 'mycourses' : hashSig.value === '#pinned' ? 'pinned' : 'workspace';
          this.html.dataset.kexView = view;
          keyManager.setScope('workspace', true);
          return keyManager.register(view === 'mycourses' ? mycoursesBindings() : view === 'pinned' ? pinnedBindings() : workspaceBindings());
        }),
        effect(() => keyManager.setScope('preview', wsPreview.value !== undefined)),
        () => {
          wsPrev();
          keyManager.setScope('workspace', false);
          keyManager.setScope('preview', false);
        },
      );
    }
    if (eff.effective === 'skin' && (chromeKeys.has(eff.key) || eff.key === 'quiz-focus')) {
      const focus = eff.key === 'quiz-focus';
      // Skin+ pages: our band replaces Moodle's #page-header; a quiz attempt is focus mode (rail sidebar, only Ctrl+K and Alt+Shift+O).
      if (focus) this.html.dataset.kexFocus = 'true';
      else this.html.dataset.kexChrome = eff.key;
      const off = keyManager.register(focus ? focusBindings() : activityBindings());
      keyManager.setScope('activity', !focus && eff.key === 'activity');
      if (focus) keyManager.suspend(true);
      this.stops.push(() => {
        off();
        keyManager.setScope('activity', false);
        keyManager.suspend(false);
        delete this.html.dataset.kexFocus;
        delete this.html.dataset.kexChrome;
      });
    }
    window.clearTimeout(this.failTimer);
    this.mounted = true;
    this.html.dataset.kexShell = 'ready';
    setMode(eff.effective === 'app' ? 'app' : 'boot');

    // Everything below runs without blocking the first paint.
    this.stops.push(
      effect(() => {
        // Idle prefetch of every sidebar course's state: feeds the palette's topics and materials and the unavailable-pin check.
        const cs = sidebarCourses.value;
        if (cs.length) prefetchStates(cs);
      }),
    );
    void countsStore().refresh();
    const countsTimer = window.setInterval(() => document.visibilityState === 'visible' && void countsStore().refresh(), 2 * 60 * 1000);
    this.stops.push(() => window.clearInterval(countsTimer));
    void store.refresh().then(() => {
      if (DEBUG) this.html.dataset.kexTransport = (globalThis as unknown as { content?: unknown }).content ? 'content.fetch' : 'fetch';
      if (DEBUG) this.html.dataset.kexCourses = String(coursesRaw.value.length);
    });
    await this.dcl;
    if (!this.mounted) return;
    this.refreshFromDom(eff);
    if (eff.effective === 'skin') {
      setMode('skin');
      if (chromeKeys.has(eff.key) || eff.key === 'quiz-focus') this.stops.push(watchSkinPage());
    }
    window.addEventListener('hashchange', () => {
      hashSig.value = location.hash;
      routeSig.value = routeSig.value ? { ...routeSig.value } : null;
    });
    window.addEventListener('resize', () => (viewportWidth.value = window.innerWidth), { passive: true });
  }

  /** Scrape what only the finished DOM has: breadcrumb, user, logo, user menu, utility links. */
  private refreshFromDom(eff: EffectiveRoute): void {
    const info = parsePageInfo({ doc: document, pathname: location.pathname, search: location.search });
    this.info = info;
    pageInfo.value = info;
    const scraped = scrapeUser(document, info.userId);
    if (scraped) {
      user.value = scraped;
      void storeUser(scraped);
    } else if (!user.value) {
      void fetchUser(info.userId)
        .then((u) => {
          if (u) {
            user.value = u;
            void storeUser(u);
          }
        })
        .catch((e: unknown) => recordError('user', e));
    }
    userMenuItems.value = scrapeUserMenu(document);
    ttLinks.value = scrapeTtLinks(document);
    const logo = qs<HTMLImageElement>(document, SEL.logo);
    logoSrc.value = logo?.getAttribute('src') ?? undefined;
    if (eff.key === 'workspace' || eff.key === 'mycourses') void scrapeMyoverview(document);
    if (eff.key === 'course' || eff.key === 'section') {
      const tiles = scrapeTiles(document);
      if (tiles.length) setTileList(tiles);
      summaries.value = scrapeSummaries(document);
    }
  }

  private syncAttrs(): void {
    const s = settings.value;
    this.applyAttrs(s);
    writeBootMirror(toBootMirror(s));
  }

  private async fetchText(url: string): Promise<string> {
    const c = (globalThis as unknown as { content?: { fetch: typeof fetch } }).content;
    const res = await (c ? c.fetch(url, { credentials: 'same-origin' }) : fetch(url, { credentials: 'same-origin' }));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  // ---------------------------------------------------------------- unmount, off, errors

  private unmount(): void {
    this.stops.splice(0).forEach((s) => s());
    this.bindingsOff?.();
    this.bindingsOff = null;
    keyManager.detach();
    if (this.root) {
      unmountShell(this.root);
      this.root.remove();
      this.root = null;
    }
    delete this.html.dataset.kexShell;
    this.mounted = false;
    // Overlays must not survive a remount.
    import('../state').then((m) => {
      m.paletteOpen.value = false;
      m.helpOpen.value = false;
      m.quickSettingsOpen.value = false;
      m.userMenuOpen.value = false;
      m.sidebarOverlay.value = false;
    }).catch(() => undefined);
  }

  /** Shell error or timeout: show plain Moodle with the error pill (architecture §5.3). */
  failOpen(reason: string, err?: unknown): void {
    if (err) recordError(reason, err);
    window.clearTimeout(this.failTimer);
    this.unmount();
    setMode('off');
    showOffPill({
      variant: 'error',
      onPrimary: () => {
        hideOffPill();
        void this.boot();
      },
    });
  }

  private goDisabled(s: Settings): void {
    window.clearTimeout(this.failTimer);
    this.unmount();
    setMode('off');
    lang.value = s.uiLanguage;
    if (s.showOffPill && document.body) {
      showOffPill({ variant: 'disabled', onPrimary: () => updateSettings({ enabled: true }) });
    } else if (!document.body) {
      void waitForBody(this.html).then(() => s.showOffPill && showOffPill({ variant: 'disabled', onPrimary: () => updateSettings({ enabled: true }) }));
    }
  }

  /** Alt+Shift+O. */
  private toggleOriginal(): void {
    if (this.mounted && this.route) {
      safeSessionStorage()?.setItem(offKey(this.route.key), '1');
      this.unmount();
      this.settleOff(true, 'manual');
      return;
    }
    if (getMode() === 'off' && this.route) this.turnOn();
  }

  private turnOn(): void {
    if (this.route) safeSessionStorage()?.removeItem(offKey(this.route.key));
    hideOffPill();
    // A route that the user set to "off" permanently comes back on through the settings.
    const key = this.route?.key;
    if (key && settings.value.routeModes[key] === 'off') {
      const modes = { ...settings.value.routeModes };
      delete modes[key];
      updateSettings({ routeModes: modes });
    }
    this.booting = false;
    void this.boot();
  }

  private alwaysOff(): void {
    const key = this.route?.key;
    if (!key) return;
    updateSettings({ routeModes: { ...settings.value.routeModes, [key]: 'off' } });
    pushToast(t('pill.off'));
  }

  private onRemoteSettings(s: Settings): void {
    const was = settings.value;
    settings.value = s;
    writeBootMirror(toBootMirror(s));
    if (was.enabled && !s.enabled) {
      this.goDisabled(s);
    } else if (!was.enabled && s.enabled) {
      hideOffPill();
      void this.boot();
    } else if (was.sidebarSource !== s.sidebarSource) {
      // The courses store re-reads the source on its next refresh; force one now.
      void cache.peek('courses');
    }
  }
}

void new Controller().start().catch((e: unknown) => {
  recordError('start', e);
  try {
    document.documentElement.dataset.kex = 'off';
  } catch {
    /* nothing more we can do */
  }
});
