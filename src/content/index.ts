import { playArrival, watchDepartures, markDeparture } from '../fx/arrival';
import { heroCanvas } from '../fx/heroCanvas';
import { batch, effect } from '@preact/signals';
import { seedDetails } from '../data/repo/cmdetails';
import { parseCmItems } from '../data/scrape/cm';
import { scrapeSecondaryNav, type NavTab } from '../data/scrape/secondarynav';
import { beginViewTransition, cancelViewTransitions, restoreScroll, scrollInstant } from '../fx/navigation';
import { hardNavigating, navigationLoading, softEntered } from '../state/navigation';
import { cache } from '../data/cache';
import { createCoursesStore, loadCustomField } from '../data/repo/courses';
import { cachedUser, fetchUser, storeUser } from '../data/repo/user';
import { scrapeGradeOverview } from '../data/scrape/grades';
import { scrapeMyoverview } from '../data/scrape/myoverview';
import { gradeRows } from '../state/grades';
import { gradesBindings } from '../actions/grades';
import { notificationsBindings } from '../actions/notifications';
import { scrapeSummaries } from '../data/scrape/summaries';
import { scrapeTiles } from '../data/scrape/tiles';
import { setTileList } from '../actions/course';
import { courseBindings, previewBindings } from '../actions/coursekeys';
import { activityBindings, attachEditorFrameKeys, focusBindings } from '../actions/skinkeys';
import { watchSkinPage } from '../actions/skin';
import { chromeKeys } from '../state/skin';
import { mycoursesBindings, pinnedBindings, workspaceBindings, workspacePreviewBindings } from '../actions/wskeys';
import { configureCounts, countsStore } from '../data/repo/counts';
import { configureNotifs } from '../data/repo/notifs';
import { prefetchStates } from '../data/repo/prefetch';
import { wsPreview } from '../state/workspace';
import { courseState, courseStatus, previewCmId, secondaryNav, summaries, topicNumber } from '../state/course';
import { scrapeTtLinks, scrapeUser } from '../data/scrape/user';
import { scrapeUserMenu } from '../data/scrape/usermenu';
import { ws } from '../data/ws';
import { SEL } from '../data/selectors';
import { lang, langFromTag, resolveLang } from '../i18n';
import { watchMoodleStrings } from '../i18n/moodle';
import { qs, safeSessionStorage } from '../lib/dom';
import { storageSet } from '../lib/storage';
import { DEBUG, recordError } from '../lib/log';
import { startFirstFrameProbe } from './probe';
import {
  readBootMirror, toBootMirror, watchSettings, writeBootMirror, loadSettings, DEFAULT_SETTINGS, type Settings,
} from '../lib/settings';
import { applyShellAttrs, shellAttrs } from '../lib/theme';
import { mountLogin, mountShell, unmountShell } from '../ui/mount';
import { scrapeLogin } from '../data/scrape/login';
import {
  activeSchool, coursesLoading, coursesRaw, hash as hashSig, headerCompact, headerTitle, hooks, languages, logoSrc, pageDoc, pageInfo, resolvedMotion, resolvedTheme, route as routeSig,
  search as searchSig, settings, sidebarCourses, sidebarMode, systemDark, systemReducedMotion, ttLinks, user, userMenuItems, viewportWidth,
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
import { scrapeLanguages } from './langs';
import { mountGuestSkin, unmountGuestSkin } from './skinguest';
import { clickedLink, isPlainClick, PageLoader, prefetchSafe, routeOfDoc, softTarget, type SoftTarget } from './softnav';
import { clearSnapshot, hasSnapshot, paintSnapshot, removeSnapshot, saveSnapshot } from './snapshot';

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
  /** Per-view subscriptions (key bindings, view attributes): replaced when a soft navigation swaps the view. */
  private routeStops: (() => void)[] = [];
  private bindingsOff: (() => void) | null = null;
  private loader = new PageLoader((url) => this.fetchText(url));
  /** True once a soft navigation replaced the view: Moodle's own DOM (hidden behind the shell) is then the first page's, not the current one's. */
  private softNavigated = false;
  /** path + search of the view that is mounted (a hash change alone is not a navigation). */
  private viewUrl = '';
  private navSeq = 0;
  private snapshotTimer: number | undefined;
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
    hooks.navigate = (url) => this.trySoft(url);
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
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      systemReducedMotion.value = e.matches;
      if (e.matches) cancelViewTransitions();
    });
    document.addEventListener('pointerdown', () => { this.html.dataset.kexInput = 'pointer'; }, true);
    window.addEventListener('keydown', () => { this.html.dataset.kexInput = 'keyboard'; }, true);

    if (!readBootMirror().enabled) {
      void this.settingsLoaded.then((s) => this.goDisabled(s));
      setMode('off');
      return;
    }
    await this.boot();
  }

  // ---------------------------------------------------------------- boot

  private applyAttrs(s: Pick<Settings, 'theme' | 'effects' | 'motion' | 'sidebarCollapsed' | 'sidebarAutoHide'>): void {
    const focus = this.route?.key === 'quiz-focus' && this.route.effective === 'skin';
    applyShellAttrs(this.html, shellAttrs(focus ? { ...s, sidebarCollapsed: true } : s, window.innerWidth));
  }

  private async boot(): Promise<void> {
    if (this.booting || this.mounted) return;
    watchDepartures();
    this.booting = true;
    try {
      this.applyAttrs(readBootMirror());
      setMode('boot');
      this.paintEarly();
      if (DEBUG) startFirstFrameProbe(this.html);
      window.clearTimeout(this.failTimer);
      this.failTimer = window.setTimeout(() => this.failOpen('timeout'), FAILSAFE_MS);

      const body = await waitForBody(this.html);
      if (!looksLikeMoodle(body)) return this.settleOff(false);

      const s = await (this.settingsLoaded ?? loadSettings());
      await this.preload;
      settings.value = s;
      this.syncLang(s);
      if (!s.enabled) return this.goDisabled(s);

      const info = parsePageInfo({ doc: document, pathname: location.pathname, search: location.search });
      this.info = info;

      const base = resolveRoute({ path: stripBase(location.pathname, info.wwwroot), bodyId: body.id, bodyClasses: Array.from(body.classList) });
      const eff = effectiveMode(base, s.routeModes);
      // `?kex=off` opens plain Moodle once (used by the "Open in Moodle" links); the pill brings KEX back.
      if (this.honourOffParam && new URLSearchParams(location.search).get('kex') === 'off') {
        this.route = eff;
        routeSig.value = eff;
        pageInfo.value = info;
        return this.settleOff(s.showOffPill, 'route');
      }
      if (base.key === 'login') {
        // The login page is a guest page: it has its own, shell-less view.
        this.route = eff;
        routeSig.value = eff;
        pageInfo.value = info;
        if (eff.effective === 'off') return this.settleOff(false, 'setting');
        if (safeSessionStorage()?.getItem(offKey(eff.key)) === '1') return this.settleOff(s.showOffPill, 'manual');
        return await this.mountLoginView(eff, info);
      }
      if (info.isGuest || !info.sesskey) {
        // Signed-out pages: the skin plus a small guest header (login button, language menu); embedded layouts stay plain Moodle.
        const guestRoot = await mountGuestSkin({ html: this.html, doc: document, wwwroot: info.wwwroot, route: eff, settings: s, onError: (e) => this.failOpen('guest', e) });
        if (!guestRoot) return this.settleOff(false);
        this.route = eff;
        routeSig.value = eff;
        pageInfo.value = info;
        this.root = guestRoot;
        removeSnapshot();
        window.clearTimeout(this.failTimer);
        this.mounted = true;
        this.stops.push(() => unmountGuestSkin(this.html));
        return;
      }
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
    removeSnapshot();
    setMode('off');
    if (pill) {
      showOffPill({
        variant: 'off',
        onPrimary: () => this.turnOn(),
        onAlways: reason === 'manual' ? () => this.alwaysOff() : undefined,
      });
    }
  }

  /** Login: wait for the finished page, then replace it with our view (Moodle's form and FAQ move into it). */
  private async mountLoginView(eff: EffectiveRoute, info: PageInfo): Promise<void> {
    // The guest page has no shell, and what was stored belonged to a signed-in user.
    removeSnapshot();
    clearSnapshot();
    await this.dcl;
    this.syncAttrs();
    const root = document.createElement('div');
    root.id = 'kex-root';
    root.lang = lang.value;
    document.body.insertBefore(root, document.body.firstChild);
    this.root = root;
    this.html.dataset.kexView = 'login';
    const model = scrapeLogin(document);
    // The cookie notice lives in #page-wrapper, which app mode hides: it becomes a toast on the body.
    const notice = document.querySelector<HTMLElement>('.eupopup-container');
    if (notice) document.body.appendChild(notice);
    if (settings.value.effects !== 'off') heroCanvas.warm();
    mountLogin(root, { model, loggedIn: !info.isGuest, continueHref: `${info.wwwroot}/my/` }, (e) => this.failOpen('login', e));
    window.clearTimeout(this.failTimer);
    this.mounted = true;
    this.html.dataset.kexShell = 'ready';
    setMode('app');
    playArrival(root.querySelector<HTMLElement>('.kex-login'));
    this.stops.push(() => {
      delete this.html.dataset.kexView;
    });
    void eff;
  }

  private async mount(eff: EffectiveRoute): Promise<void> {
    const info = this.info!;
    const body = document.body;
    ws.configure(info.wwwroot, info.sesskey);
    cache.bind(location.host, info.userId);
    configureCounts(info.userId);
    configureNotifs(info.userId);

    this.syncAttrs();
    // The painted snapshot gives way to the real shell in this same task: no frame without chrome in between.
    removeSnapshot();
    const root = document.createElement('div');
    root.id = 'kex-root';
    root.lang = lang.value;
    body.insertBefore(root, body.firstChild);
    this.root = root;
    this.viewUrl = location.pathname + location.search;

    user.value = cachedUser();
    const store = createCoursesStore(
      {
        userId: info.userId,
        wwwroot: info.wwwroot,
        lang: () => lang.value,
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
        this.syncLang(s2);
        if (this.root) this.root.lang = lang.value;
      }),
      effect(() => {
        // The faculty theme of the course page: palette and accent follow the first letter of the course code.
        const school = activeSchool.value;
        if (school === 'default') delete this.html.dataset.kexSchool;
        else this.html.dataset.kexSchool = school;
      }),
      () => delete this.html.dataset.kexSchool,
      // Moodle's own wording for the labels it has (cached 7 days, applied at once from the cache).
      watchMoodleStrings(() => langFromTag(document.documentElement.lang)),
    );

    if (settings.value.effects !== 'off') heroCanvas.warm();
    mountShell(root, (e) => this.failOpen('shell', e));
    keyManager.attach();
    this.bindingsOff = keyManager.register(globalBindings());
    this.mountRoute(eff);
    window.clearTimeout(this.failTimer);
    this.mounted = true;
    this.html.dataset.kexShell = 'ready';
    setMode(eff.effective === 'app' ? 'app' : 'boot');
    if (eff.effective === 'app') playArrival(root.querySelector<HTMLElement>('.kex-main'));

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
    this.refreshShellFromDom();
    this.refreshViewFromDoc(eff, document);
    if (eff.effective === 'skin') {
      setMode('skin');
      if (chromeKeys.has(eff.key) || eff.key === 'quiz-focus') this.routeStops.push(watchSkinPage());
    }
    const onHash = (): void => {
      hashSig.value = location.hash;
      routeSig.value = routeSig.value ? { ...routeSig.value } : null;
    };
    const onResize = (): void => void (viewportWidth.value = window.innerWidth);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('resize', onResize, { passive: true });
    this.stops.push(() => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('resize', onResize);
    });
    this.watchNavigation();
    this.scheduleSnapshot();
    void storageSet({ 'kex:moodleLang': langFromTag(document.documentElement.lang) }).catch(() => undefined);
  }

  /** Key bindings, view attributes and per-view keyboard scopes for the route in `eff`. Undone by `unmountRoute`. */
  private mountRoute(eff: EffectiveRoute): void {
    const stops = this.routeStops;
    if (eff.effective === 'app' && (eff.key === 'course' || eff.key === 'section')) {
      const off = keyManager.register([...courseBindings(), ...previewBindings()]);
      keyManager.setScope('course', true);
      stops.push(
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
      stops.push(
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
          delete this.html.dataset.kexView;
        },
      );
    }
    if (eff.effective === 'app' && (eff.key === 'grades' || eff.key === 'notifications')) {
      this.html.dataset.kexView = eff.key;
      keyManager.setScope('workspace', true);
      const off = keyManager.register(eff.key === 'grades' ? gradesBindings() : notificationsBindings());
      stops.push(() => {
        off();
        keyManager.setScope('workspace', false);
        delete this.html.dataset.kexView;
      });
    }
    if (eff.effective === 'skin' && (chromeKeys.has(eff.key) || eff.key === 'quiz-focus')) {
      const focus = eff.key === 'quiz-focus';
      // Skin+ pages: our band replaces Moodle's #page-header; a quiz attempt is focus mode (rail sidebar, only Ctrl+K and Alt+Shift+O).
      if (focus) this.html.dataset.kexFocus = 'true';
      else this.html.dataset.kexChrome = eff.key;
      const off = keyManager.register(focus ? focusBindings() : activityBindings());
      keyManager.setScope('activity', !focus && eff.key === 'activity');
      if (focus) keyManager.suspend(true);
      else stops.push(attachEditorFrameKeys());
      stops.push(() => {
        off();
        keyManager.setScope('activity', false);
        keyManager.suspend(false);
        delete this.html.dataset.kexFocus;
        delete this.html.dataset.kexChrome;
      });
    }
  }

  private unmountRoute(): void {
    this.routeStops.splice(0).forEach((s) => s());
  }

  /** Scrape what only the finished DOM of the *live* page has and that does not depend on the view: user, user menu, links, logo, languages. */
  private refreshShellFromDom(): void {
    const info = parsePageInfo({ doc: document, pathname: location.pathname, search: location.search });
    // A soft navigation may already have replaced the page context (course id, heading): keep ours then.
    if (!this.softNavigated) {
      this.info = info;
      pageInfo.value = info;
    }
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
    languages.value = scrapeLanguages(document, document.documentElement.lang);
    const logo = qs<HTMLImageElement>(document, SEL.logo);
    logoSrc.value = logo?.getAttribute('src') ?? undefined;
  }

  /** The view's own data from a page document (the live one, or the one a soft navigation fetched). */
  private refreshViewFromDoc(eff: EffectiveRoute, doc: Document): void {
    if (eff.key === 'workspace' || eff.key === 'mycourses') void scrapeMyoverview(doc);
    if (eff.key === 'grades') gradeRows.value = scrapeGradeOverview(doc);
    if (eff.key === 'course' || eff.key === 'section') {
      const tiles = scrapeTiles(doc);
      if (tiles.length) setTileList(tiles);
      summaries.value = scrapeSummaries(doc);
      const nav = scrapeSecondaryNav(doc);
      secondaryNav.value = nav;
      const id = this.info?.courseId;
      if (id) {
        seedDetails(id, parseCmItems(doc));
        if (nav.length) void cache.write(`snav:${id}`, nav);
      }
    }
  }

  /** The language the UI uses: the setting resolved against `<html lang>` (Moodle's own language). */
  private syncLang(s: Pick<Settings, 'uiLanguage'>): void {
    const next = resolveLang(s.uiLanguage, document.documentElement.lang);
    if (lang.value !== next) lang.value = next;
  }

  // ---------------------------------------------------------------- shell snapshot, soft navigation

  /** Paint the stored chrome of the previous page at once (document_start), unless this load will not get a shell. */
  private paintEarly(): void {
    if (hasSnapshot()) return;
    const q = new URLSearchParams(location.search);
    if (q.get('kex') === 'off') return;
    const key = resolveRoute({ path: location.pathname, bodyId: '', bodyClasses: [] }).key;
    if (key === 'login' || safeSessionStorage()?.getItem(offKey(key)) === '1') return;
    paintSnapshot(this.html, location);
  }

  /** Keep the stored chrome current: once the page settled, and whenever the page is left (a hard load follows). */
  private scheduleSnapshot(): void {
    const save = (): void => {
      if (this.root && this.mounted) saveSnapshot(this.root);
    };
    window.clearTimeout(this.snapshotTimer);
    this.snapshotTimer = window.setTimeout(save, 2500);
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onHide);
    this.stops.push(() => {
      window.clearTimeout(this.snapshotTimer);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHide);
    });
  }

  private softCtx() {
    return { origin: location.origin, wwwroot: this.info?.wwwroot ?? '', routeModes: settings.value.routeModes };
  }

  /** Link clicks, hover warm-up and history traversal. Registered once the shell is up. */
  private watchNavigation(): void {
    const onClick = (e: MouseEvent): void => {
      if (!isPlainClick(e) || !this.canSoft()) return;
      const a = clickedLink(e.target);
      if (!a || a.closest('#page-wrapper, .kex-offpill')) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      // Same page: let the browser handle anchors and reloads of the current URL.
      if (url.pathname + url.search === location.pathname + location.search) return;
      if (this.trySoft(url)) e.preventDefault();
      else if (a.closest('.kex-coursenav')) this.hardLoadFeedback();
    };
    let hoverTimer: number | undefined;
    const warmed = new Set<string>();
    const onOver = (e: Event): void => {
      const a = clickedLink(e.target);
      if (!a) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        let url: URL;
        try {
          url = new URL(a.href, location.href);
        } catch {
          return;
        }
        const ctx = this.softCtx();
        if (softTarget(url, ctx)) {
          if (this.canSoft()) void this.loader.load(url).catch(() => undefined);
        } else if (prefetchSafe(url, ctx) && !warmed.has(url.href)) {
          warmed.add(url.href);
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = url.href;
          document.head?.appendChild(link);
        }
      }, 65);
    };
    const onOut = (): void => window.clearTimeout(hoverTimer);
    const onPop = (): void => void this.onPopState();
    // Back to a page restored from the back/forward cache: the skeleton shown for the load we left must not stay.
    const onShow = (e: PageTransitionEvent): void => {
      if (e.persisted) this.endHardLoadFeedback();
    };
    window.addEventListener('pageshow', onShow);
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('focusin', onOver, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    window.addEventListener('popstate', onPop);
    this.stops.push(() => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onOver);
      document.removeEventListener('pointerout', onOut);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pageshow', onShow);
      window.clearTimeout(hoverTimer);
    });
  }

  private hardTimer: number | undefined;

  /**
   * A page Moodle has to render itself (Participants, Grades, …) is about to load. The view leaves and the skeleton enters with the
   * soft-navigation transition, and the header line runs, so the wait is not a frozen page; the next load paints the shell snapshot.
   */
  private hardLoadFeedback(): void {
    if (hardNavigating.value) return;
    const enter = beginViewTransition(this.root?.querySelector<HTMLElement>('.kex-main') ?? null, 'page');
    this.html.dataset.kexNav = 'loading';
    hardNavigating.value = true;
    enter('.kex-main');
    // A cancelled load (Escape, a download) leaves the page as it was.
    window.clearTimeout(this.hardTimer);
    this.hardTimer = window.setTimeout(() => this.endHardLoadFeedback(), 10_000);
  }

  private endHardLoadFeedback(): void {
    window.clearTimeout(this.hardTimer);
    if (!hardNavigating.value) return;
    hardNavigating.value = false;
    if (!navigationLoading.value) this.html.removeAttribute('data-kex-nav');
  }

  /** Soft navigation only starts from a mounted app view. */
  private canSoft(): boolean {
    return this.mounted && !!this.route && this.route.effective === 'app' && !!this.info && !this.html.dataset.kexFocus;
  }

  /** Open `url` in place when it is an app view. Returns true when the navigation was taken over (the caller must not load the page). */
  private trySoft(url: URL): boolean {
    if (!this.canSoft()) return false;
    const target = softTarget(url, this.softCtx());
    if (!target) return false;
    // A course page with another query on the same course is one the page itself has to resolve (section, edit): a normal load.
    if (target.key === 'course' && this.route?.key === 'course' && target.courseId === pageInfo.value?.courseId) return false;
    void this.softNavigate(url, target, true);
    return true;
  }

  private async softNavigate(url: URL, target: SoftTarget, push: boolean, restoreY?: number): Promise<void> {
    const seq = ++this.navSeq;
    this.endHardLoadFeedback();
    const hard = (): void => {
      if (seq !== this.navSeq) return;
      cancelViewTransitions();
      navigationLoading.value = false;
      this.html.removeAttribute('data-kex-nav');
      markDeparture();
      if (push) window.location.assign(url.href);
      else window.location.reload();
    };
    try {
      // Only the query or hash of the Workspace or My courses changed (the course filter, the list tab): the same view, nothing to load.
      if (!navigationLoading.value && this.route?.key === target.key && (target.key === 'workspace' || target.key === 'mycourses')) {
        if (push) {
          history.replaceState({ ...(history.state as object | null), kexScroll: window.scrollY }, '');
          history.pushState({ kex: 1 }, '', url.href);
        }
        this.viewUrl = url.pathname + url.search;
        searchSig.value = location.search;
        hashSig.value = location.hash;
        return;
      }
      this.html.dataset.kexNav = 'loading';
      const enter = beginViewTransition(this.root?.querySelector<HTMLElement>('.kex-main') ?? null, 'page');
      // Begin the request and mount the destination together. A detached empty document prevents the new course
      // from scraping the previous course's still-hidden Moodle DOM while its own HTML is in flight.
      const page = this.loader.load(url);
      navigationLoading.value = true;
      if (push) {
        history.replaceState({ ...(history.state as object | null), kexScroll: window.scrollY }, '');
        history.pushState({ kex: 1 }, '', url.href);
      }
      this.swapView(target, document.implementation.createHTMLDocument(''), url);
      enter('.kex-main');
      if (restoreY !== undefined) restoreScroll(restoreY, () => !navigationLoading.value && (target.key !== 'course' || courseStatus.value !== 'loading'));
      let timeout: number | undefined;
      try {
        const doc = await Promise.race([
          page,
          new Promise<never>((_, rej) => { timeout = window.setTimeout(() => rej(new Error('soft navigation timed out')), 8000); }),
        ]);
        if (seq !== this.navSeq) return; // a newer click won
        // The page says what it really is: editing mode, an embedded layout, or a route the user set to another mode.
        const real = routeOfDoc(doc, target.path, settings.value.routeModes);
        if (real.key !== target.key || real.effective !== 'app') return hard();
        this.applyPageDoc(target.route, doc);
        navigationLoading.value = false;
        this.html.removeAttribute('data-kex-nav');
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (e) {
      recordError('softnav', e);
      hard();
    }
  }

  /** Replace the mounted view with the one `target` names. The shell (sidebar, header, overlays) is not touched. */
  private swapView(target: SoftTarget, doc: Document | null, url: URL): void {
    this.softNavigated = true;
    softEntered.value = true;
    this.unmountRoute();
    keyManager.setScope('workspace', false);
    keyManager.setScope('course', false);
    keyManager.setScope('preview', false);
    this.route = target.route;
    this.viewUrl = url.pathname + url.search;
    const prev = this.info!;
    const courseId = target.courseId ?? 0;
    const course = sidebarCourses.value.find((c) => c.id === courseId);
    const next: PageInfo = { ...prev, courseId, cmId: null, contextId: null, bodyId: '', breadcrumb: [], heading: course?.name ?? '', kicker: '', format: '', pageLayout: '' };
    this.info = next;
    batch(() => {
      pageDoc.value = doc;
      if (target.key === 'course') {
        courseState.value = undefined;
        courseStatus.value = 'loading';
        topicNumber.value = undefined;
        summaries.value = new Map();
        // The tabs of a course seen before are there at once; the row never collapses and refills.
        secondaryNav.value = cache.peek<NavTab[]>(`snav:${courseId}`)?.data ?? [];
      }
      pageInfo.value = next;
      searchSig.value = location.search;
      hashSig.value = location.hash;
      routeSig.value = target.route;
      headerTitle.value = null;
      headerCompact.value = false;
    });
    this.mountRoute(target.route);
    if (doc) this.applyPageDoc(target.route, doc);
    scrollInstant(0);
    // Close what belongs to the old view.
    void import('../state').then((m) => {
      m.paletteOpen.value = false;
      m.sidebarOverlay.value = false;
    });
  }

  /** Title, heading, breadcrumb and the view's scrape data from the fetched page. */
  private applyPageDoc(route: EffectiveRoute, doc: Document): void {
    pageDoc.value = doc;
    const parsed = parsePageInfo({ doc, pathname: location.pathname, search: location.search });
    const cur = this.info;
    if (cur) {
      // M.cfg (course id, context) would come from the live page, not from this one: only what the fetched markup itself says.
      const merged: PageInfo = {
        ...cur,
        bodyId: parsed.bodyId, pageLayout: parsed.pageLayout, format: parsed.format,
        breadcrumb: parsed.breadcrumb, heading: parsed.heading || cur.heading, kicker: parsed.kicker,
      };
      this.info = merged;
      pageInfo.value = merged;
    }
    if (doc.title) document.title = doc.title;
    this.refreshViewFromDoc(route, doc);
  }

  /** Back and forward between the views of this page: swap in place, or reload when the entry is not one we can show. */
  private async onPopState(): Promise<void> {
    if (!this.canSoft()) return;
    hashSig.value = location.hash;
    searchSig.value = location.search;
    if (location.pathname + location.search === this.viewUrl) return;
    const url = new URL(location.href);
    const target = softTarget(url, this.softCtx());
    if (!target) {
      window.location.reload();
      return;
    }
    // Restore the scroll position of the entry we return to once the view is in.
    const y = (history.state as { kexScroll?: number } | null)?.kexScroll;
    await this.softNavigate(url, target, false, typeof y === 'number' ? y : undefined);
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
    this.navSeq++;
    navigationLoading.value = false;
    this.endHardLoadFeedback();
    cancelViewTransitions();
    this.stops.splice(0).forEach((s) => s());
    this.unmountRoute();
    pageDoc.value = null;
    this.html.removeAttribute('data-kex-nav');
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
    removeSnapshot();
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
    if (this.softNavigated) {
      // Moodle's own DOM behind the shell is the first page's: load the current URL as plain Moodle instead.
      const u = new URL(location.href);
      u.searchParams.set('kex', 'off');
      this.unmount();
      window.location.replace(u.href);
      return;
    }
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
    if (this.softNavigated) {
      window.location.reload();
      return;
    }
    this.unmount();
    setMode('off');
    this.syncLang(s);
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
      if (this.softNavigated) {
        window.location.reload();
        return;
      }
      this.unmount();
      this.settleOff(true, 'manual');
      return;
    }
    if (getMode() === 'off' && this.route) this.turnOn();
  }

  /** The `?kex=off` link only applies until the user turns KEX on. */
  private honourOffParam = true;

  private turnOn(): void {
    this.honourOffParam = false;
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
