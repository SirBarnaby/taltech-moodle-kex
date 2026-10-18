import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { lang, t } from '../i18n';
import { storageGetAll, storageRemove, storageSet } from '../lib/storage';
import type { Pin } from '../data/model';
import { MAX_PINS, parsePinsJson, pinsToJson } from '../data/repo/pins';
import { SETTINGS_KEY, type RouteMode } from '../lib/settings';
import { resolveTheme } from '../lib/theme';
import { useResolvedLang, useSettings } from '../lib/useSettings';
import { Segmented } from '../ui/components/Segmented';
import { Switch } from '../ui/components/Switch';

const ROUTE_KEYS = ['workspace', 'mycourses', 'course', 'section', 'grades', 'notifications', 'quiz-focus', 'activity', 'grade-user', 'generic'] as const;

interface CachedCourse {
  id: number;
  code: string;
  name: string;
}

/** Course names from any cached sidebar list, so the alias table can show more than an id. */
async function cachedCourseNames(): Promise<Map<number, CachedCourse>> {
  const all = await storageGetAll();
  const out = new Map<number, CachedCourse>();
  for (const [k, v] of Object.entries(all)) {
    if (!/^kex:v1:.+:courses$/.test(k)) continue;
    const data = (v as { data?: CachedCourse[] }).data;
    if (Array.isArray(data)) for (const c of data) out.set(c.id, c);
  }
  return out;
}

interface PinsKey {
  key: string;
  host: string;
  count: number;
}

/** Every `kex:v1:{host}:{userId}:pins` key in this profile (usually one). */
async function pinKeys(): Promise<PinsKey[]> {
  const all = await storageGetAll();
  return Object.entries(all)
    .filter(([k]) => /^kex:v1:[^:]+(?::\d+)?:\d+:pins$/.test(k))
    .map(([k, v]) => ({ key: k, host: k.split(':').slice(2, -2).join(':'), count: ((v as { data?: unknown[] }).data ?? []).length }));
}

function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function Section({ title, children, id }: { title: string; children: preact.ComponentChildren; id: string }) {
  return (
    <section class="ext-section" aria-labelledby={id}>
      <h2 id={id} class="ext-mono ext-section__title">{title}</h2>
      <div class="ext-section__body">{children}</div>
    </section>
  );
}

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: preact.ComponentChildren; htmlFor?: string }) {
  return (
    <div class="ext-row ext-row--wide">
      <div>
        <label for={htmlFor}>{label}</label>
        {hint && <p class="ext-hint">{hint}</p>}
      </div>
      <div class="ext-row__ctl">{children}</div>
    </div>
  );
}

function Options() {
  const [s, update, ready] = useSettings();
  const [names, setNames] = useState<Map<number, CachedCourse>>(new Map());
  const [status, setStatus] = useState('');
  const [pinSets, setPinSets] = useState<PinsKey[]>([]);

  const resolved = useResolvedLang(s.uiLanguage);
  lang.value = resolved;
  useEffect(() => {
    document.documentElement.dataset.kexTheme = resolveTheme(s.theme);
    document.documentElement.lang = resolved;
  }, [s.theme, resolved]);
  useEffect(() => {
    void cachedCourseNames().then(setNames);
  }, [s.courseAliases]);
  useEffect(() => {
    void pinKeys().then(setPinSets);
  }, [status]);

  if (!ready) return null;

  const clearCache = async (): Promise<void> => {
    const all = await storageGetAll();
    // Pins are user data, everything else under kex:v1 is a cache.
    const keys = Object.keys(all).filter((k) => k.startsWith('kex:v1:') && !k.endsWith(':pins'));
    await storageRemove(keys);
    setStatus(t('ext.cleared', { n: keys.length }));
  };
  const resetAll = async (): Promise<void> => {
    if (!window.confirm(t('ext.resetConfirm'))) return;
    const all = await storageGetAll();
    await storageRemove(Object.keys(all).filter((k) => k.startsWith('kex:') || k === SETTINGS_KEY));
    setStatus(t('ext.resetDone'));
  };
  const exportPins = async (k: PinsKey): Promise<void> => {
    const all = await storageGetAll();
    const data = ((all[k.key] as { data?: Pin[] } | undefined)?.data ?? []) as Pin[];
    download('kex-pins.json', pinsToJson(data));
  };
  const importPins = async (k: PinsKey, file: File | undefined): Promise<void> => {
    if (!file) return;
    try {
      const { pins } = parsePinsJson(await file.text(), `https://${k.host}`);
      if (!pins.length) return setStatus(t('pinned.importFailed'));
      const all = await storageGetAll();
      const cur = ((all[k.key] as { data?: Pin[] } | undefined)?.data ?? []) as Pin[];
      const have = new Set(cur.map((p) => p.cmid));
      const merged = [...cur, ...pins.filter((p) => !have.has(p.cmid))].slice(0, MAX_PINS);
      await storageSet({ [k.key]: { v: 1, at: Date.now(), data: merged } });
      setStatus(t('pinned.imported', { n: merged.length - cur.length }));
    } catch {
      setStatus(t('pinned.importFailed'));
    }
  };
  const aliasRows = Object.entries(s.courseAliases);
  const modeOptions: { value: RouteMode | ''; label: string }[] = [
    { value: '', label: t('ext.mode.default') },
    { value: 'app', label: t('ext.mode.app') },
    { value: 'skin', label: t('ext.mode.skin') },
    { value: 'off', label: t('ext.mode.off') },
  ];

  return (
    <main class="ext-options">
      <header class="ext-options__head">
        <span class="ext-popup__mark" aria-hidden="true">KEX</span>
        <div>
          <h1>TalTech Moodle KEX</h1>
          <p class="ext-mono">v{__VERSION__}</p>
        </div>
      </header>

      <Section id="o-general" title={t('ext.general')}>
        <Row label={t('ext.enabled')} hint={t('ext.enabledHint')} htmlFor="o-enabled">
          <Switch id="o-enabled" label={t('ext.enabled')} checked={s.enabled} onChange={(enabled) => update({ enabled })} />
        </Row>
        <Row label={t('ext.language')} hint={t('ext.langHint')}>
          <Segmented
            label={t('ext.language')}
            value={s.uiLanguage}
            onChange={(uiLanguage) => update({ uiLanguage })}
            options={[{ value: 'auto', label: t('ext.langAuto') }, { value: 'et', label: 'Eesti' }, { value: 'en', label: 'English' }]}
          />
        </Row>
        <Row label={t('ext.offPill')} hint={t('ext.offPillHint')} htmlFor="o-pill">
          <Switch id="o-pill" label={t('ext.offPill')} checked={s.showOffPill} onChange={(showOffPill) => update({ showOffPill })} />
        </Row>
        <Row label={t('ext.newTab')} hint={t('ext.newTabHint')}>
          <Segmented
            label={t('ext.newTab')}
            value={s.openInNewTab}
            onChange={(openInNewTab) => update({ openInNewTab })}
            options={[{ value: 'never', label: t('ext.newTab.never') }, { value: 'external', label: t('ext.newTab.external') }, { value: 'always', label: t('ext.newTab.always') }]}
          />
        </Row>
      </Section>

      <Section id="o-appearance" title={t('ext.appearance')}>
        <Row label={t('settings.theme')}>
          <Segmented
            label={t('settings.theme')}
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[{ value: 'system', label: t('settings.theme.system') }, { value: 'light', label: t('settings.theme.light') }, { value: 'dark', label: t('settings.theme.dark') }]}
          />
        </Row>
        <Row label={t('settings.effects')} hint={t('ext.effectsHint')}>
          <Segmented
            label={t('settings.effects')}
            value={s.effects}
            onChange={(effects) => update({ effects })}
            options={[{ value: 'animated', label: t('ext.fx.animated') }, { value: 'static', label: t('ext.fx.static') }, { value: 'off', label: t('ext.fx.off') }]}
          />
        </Row>
        <Row label={t('ext.colourSchool')} hint={t('ext.colourSchoolHint')} htmlFor="o-school">
          <Switch id="o-school" label={t('ext.colourSchool')} checked={s.colourBySchool} onChange={(colourBySchool) => update({ colourBySchool })} />
        </Row>
        <Row label={t('settings.motion')} hint={t('ext.motionHint')}>
          <Segmented
            label={t('settings.motion')}
            value={s.motion}
            onChange={(motion) => update({ motion })}
            options={[{ value: 'system', label: t('settings.motion.system') }, { value: 'reduced', label: t('settings.motion.reduced') }, { value: 'full', label: t('settings.motion.full') }]}
          />
        </Row>
      </Section>

      <Section id="o-sidebar" title={t('ext.sidebar')}>
        <Row label={t('settings.sidebarAutoHide')} hint={t('ext.sidebarAutoHideHint')} htmlFor="o-autohide">
          <Switch id="o-autohide" label={t('settings.sidebarAutoHide')} checked={s.sidebarAutoHide} onChange={(sidebarAutoHide) => update({ sidebarAutoHide })} />
        </Row>
        <Row label={t('ext.sidebarSource')} hint={t('ext.sidebarSourceHint')} htmlFor="o-source">
          <select id="o-source" class="ext-select" value={s.sidebarSource} onChange={(e) => update({ sidebarSource: e.currentTarget.value as typeof s.sidebarSource })}>
            <option value="moodle">{t('ext.source.moodle')}</option>
            <option value="inprogress">{t('ext.source.inprogress')}</option>
            <option value="starred">{t('ext.source.starred')}</option>
            <option value="all">{t('ext.source.all')}</option>
          </select>
        </Row>
        {!s.sidebarAutoHide && <Row label={t('ext.collapsed')} htmlFor="o-collapsed">
          <Switch id="o-collapsed" label={t('ext.collapsed')} checked={s.sidebarCollapsed} onChange={(sidebarCollapsed) => update({ sidebarCollapsed })} />
        </Row>}
        <div class="ext-block">
          <div class="ext-label">{t('ext.aliases')}</div>
          {aliasRows.length === 0 ? (
            <p class="ext-hint">{t('ext.aliasesEmpty')}</p>
          ) : (
            <table class="ext-table">
              <thead><tr><th scope="col">{t('ext.course')}</th><th scope="col">{t('ext.alias')}</th><th scope="col"><span class="ext-sr">{t('ext.remove')}</span></th></tr></thead>
              <tbody>
                {aliasRows.map(([id, alias]) => {
                  const c = names.get(Number(id));
                  return (
                    <tr key={id}>
                      <td><span class="ext-mono">{c?.code ?? `#${id}`}</span> {c?.name ?? ''}</td>
                      <td>{alias}</td>
                      <td>
                        <button type="button" class="ext-link" onClick={() => { const next = { ...s.courseAliases }; delete next[id]; update({ courseAliases: next }); }}>{t('ext.remove')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section id="o-routes" title={t('ext.pageTypes')}>
        <p class="ext-hint">{t('ext.pageTypesHint')}</p>
        <table class="ext-table">
          <tbody>
            {ROUTE_KEYS.map((k) => (
              <tr key={k}>
                <th scope="row"><span class="ext-mono">{k}</span></th>
                <td>
                  <select
                    class="ext-select"
                    aria-label={k}
                    value={s.routeModes[k] ?? ''}
                    onChange={(e) => {
                      const v = e.currentTarget.value as RouteMode | '';
                      const next = { ...s.routeModes };
                      if (v) next[k] = v;
                      else delete next[k];
                      update({ routeModes: next });
                    }}
                  >
                    {modeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="o-pins" title={t('ext.pins')}>
        <p class="ext-hint">{t('ext.pinsHint')}</p>
        {pinSets.length === 0 && <p class="ext-hint">{t('ext.pinsNoUser')}</p>}
        {pinSets.map((k) => (
          <div class="ext-row ext-row--wide" key={k.key} data-kex-test="pins-set">
            <div>
              <p>{k.host}</p>
              <p class="ext-hint">{t('ext.pinsCount', { n: k.count })}</p>
            </div>
            <div class="ext-row__ctl ext-actions">
              <button type="button" class="ext-btn ext-btn--outline" onClick={() => void exportPins(k)}>{t('ext.exportPins')}</button>
              <label class="ext-btn ext-btn--outline ext-filebtn">
                {t('ext.importPins')}
                <input type="file" accept="application/json,.json" hidden onChange={(e) => { void importPins(k, e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>
        ))}
      </Section>

      <Section id="o-data" title={t('ext.data')}>
        <div class="ext-actions">
          <button type="button" class="ext-btn ext-btn--outline" onClick={() => void clearCache()}>{t('ext.clearCache')}</button>
          <button type="button" class="ext-btn ext-btn--outline" onClick={() => void resetAll()}>{t('ext.reset')}</button>
        </div>
        <p class="ext-hint" role="status">{status}</p>
      </Section>

      <Section id="o-about" title={t('ext.about')}>
        <p>{t('ext.privacy')}</p>
        <p class="ext-hint">{t('ext.privacy2')}</p>
      </Section>
    </main>
  );
}

render(<Options />, document.getElementById('kex-root')!);
