import { ArrowUpRight, ChevronDown, ChevronUp, Download, Minus, Pin as PinIcon, Plus, X } from 'lucide-preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { loadPreview, type PreviewContent } from '../../data/repo/preview';
import type { RowModel } from '../../data/topics';
import { t } from '../../i18n';
import { Button } from './Button';
import { Segmented } from './Segmented';
import { domainOf } from '../../data/repo/preview';
import { READER_SIZES, setReader, stepReaderSize } from '../../actions/reader';
import { settings } from '../../state';
import type { ReaderPrefs } from '../../lib/settings';
import { focusWithoutJump, preserveViewport } from '../../fx/navigation';
import { MOTION, motionAllowed } from '../../fx/motion';
import { navigation } from '../../fx/transactions';

interface PreviewSheetProps {
  row: RowModel;
  pinned: boolean;
  onClose: () => void;
  onOpen: (row: RowModel, newTab: boolean) => void;
  onPin: (row: RowModel) => void;
  /** Previous / next material of the list beside the reader. */
  onStep?: (delta: 1 | -1) => void;
}

/** The side panel needs room for the list beside it; narrower windows get the full sheet. */
const SIDE_MIN_VIEWPORT = 1100;

function useWide(): boolean {
  const query = `(min-width: ${SIDE_MIN_VIEWPORT}px)`;
  const [wide, setWide] = useState(() => typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : window.innerWidth >= SIDE_MIN_VIEWPORT);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = (): void => setWide(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide;
}

/** Aa menu: text size, line length, spacing, font and where the reader sits. Saved with the settings. */
function ReaderMenu({ prefs, article, onClose, anchor }: { prefs: ReaderPrefs; article: boolean; onClose: () => void; anchor: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button:not([disabled]), [role="radio"][tabindex="0"]')?.focus();
    const down = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
      anchor?.focus();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [anchor, onClose]);
  const px = READER_SIZES[prefs.size] ?? 16;
  return (
    <div class="kex-readmenu" ref={ref} role="dialog" aria-label={t('reader.text')} data-kex-test="reader-menu">
      {article && (
        <>
          <div class="kex-readmenu__row">
            <span class="kex-readmenu__label">{t('reader.size')}</span>
            <div class="kex-readmenu__size">
              <button type="button" class="kex-iconbtn" aria-label={`${t('reader.smaller')} ([)`} title={`${t('reader.smaller')} ([)`} disabled={prefs.size <= 0} onClick={() => stepReaderSize(-1)} data-kex-test="reader-smaller"><Minus size={16} strokeWidth={1.75} aria-hidden="true" /></button>
              <span class="kex-readmenu__px kex-mono" aria-live="polite">{px}px</span>
              <button type="button" class="kex-iconbtn" aria-label={`${t('reader.larger')} (])`} title={`${t('reader.larger')} (])`} disabled={prefs.size >= READER_SIZES.length - 1} onClick={() => stepReaderSize(1)} data-kex-test="reader-larger"><Plus size={16} strokeWidth={1.75} aria-hidden="true" /></button>
            </div>
          </div>
          <div class="kex-readmenu__row">
            <span class="kex-readmenu__label">{t('reader.width')}</span>
            <Segmented label={t('reader.width')} value={prefs.width} onChange={(width) => setReader({ width })} options={[
              { value: 'narrow', label: t('reader.width.narrow') }, { value: 'medium', label: t('reader.width.medium') }, { value: 'wide', label: t('reader.width.wide') },
            ]} />
          </div>
          <div class="kex-readmenu__row">
            <span class="kex-readmenu__label">{t('reader.leading')}</span>
            <Segmented label={t('reader.leading')} value={prefs.leading} onChange={(leading) => setReader({ leading })} options={[
              { value: 'tight', label: t('reader.leading.tight') }, { value: 'normal', label: t('reader.leading.normal') }, { value: 'loose', label: t('reader.leading.loose') },
            ]} />
          </div>
          <div class="kex-readmenu__row">
            <span class="kex-readmenu__label">{t('reader.font')}</span>
            <Segmented label={t('reader.font')} value={prefs.font} onChange={(font) => setReader({ font })} options={[
              { value: 'sans', label: t('reader.font.sans') }, { value: 'serif', label: t('reader.font.serif') },
            ]} />
          </div>
        </>
      )}
      <div class="kex-readmenu__row">
        <span class="kex-readmenu__label">{t('reader.mode')}</span>
        <Segmented label={t('reader.mode')} value={prefs.mode} onChange={(mode) => setReader({ mode })} options={[
          { value: 'side', label: t('reader.mode.side') }, { value: 'center', label: t('reader.mode.center') }, { value: 'full', label: t('reader.mode.full') },
        ]} />
      </div>
    </div>
  );
}

type Loaded = { id: number; content: PreviewContent } | { id: number; error: true } | undefined;

/**
 * Material reader. On wide windows it is a resizable side panel: the list stays usable beside it and up/down step through it.
 * Centre and full are modal sheets that keep the originating page painted and its scroll position intact.
 */
export function PreviewSheet({ row, pinned, onClose, onOpen, onPin, onStep }: PreviewSheetProps) {
  const prefs = settings.value.reader;
  const wide = useWide();
  const mode: ReaderPrefs['mode'] = prefs.mode === 'side' && !wide ? 'full' : prefs.mode;
  const modal = mode !== 'side';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState<number>();
  const root = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState<Loaded>();
  const [readyFrame, setReadyFrame] = useState<string>();
  const [failedFrame, setFailedFrame] = useState<string>();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number>();
  const close = useRef(onClose);
  close.current = onClose;
  const id = row.cm.id;
  const idRef = useRef(id);
  idRef.current = id;

  const dismiss = (instant = false): void => {
    if (instant || document.documentElement.dataset.kexMotion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      close.current();
      return;
    }
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => close.current(), MOTION.overlayExit);
  };

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    let live = true;
    const request = new AbortController();
    setLoaded(undefined);
    setReadyFrame(undefined);
    setFailedFrame(undefined);
    setClosing(false);
    window.clearTimeout(closeTimer.current);
    loadPreview(id, row.cm.modname, row.cm.url, request.signal)
      .then((content) => live && setLoaded({ id, content }))
      .catch(() => live && setLoaded({ id, error: true }));
    return () => {
      live = false;
      request.abort();
    };
  }, [id, row.cm.modname, row.cm.url]);

  // Side panel: the page makes room for it (a margin on the main column), and the row being read is marked in the list.
  const sideFraction = drag ?? prefs.side;
  useLayoutEffect(() => {
    if (modal) return;
    const html = document.documentElement;
    html.dataset.kexReader = 'side';
    return () => {
      delete html.dataset.kexReader;
    };
  }, [modal]);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--kex-reader-f', String(sideFraction));
  }, [sideFraction]);
  useEffect(() => () => document.documentElement.style.removeProperty('--kex-reader-f'), []);
  useEffect(() => {
    if (modal) return;
    const dialog = root.current;
    const origin = document.activeElement instanceof HTMLElement && !dialog?.contains(document.activeElement) ? document.activeElement : undefined;
    dialog?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target as Element | null;
      // Escape in a field, a menu or Moodle's own dialog belongs to that control.
      if (target?.closest('input, textarea, select, [contenteditable="true"], .kex-pop, .kex-palette, .modal')) return;
      e.preventDefault();
      e.stopPropagation();
      dismissRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const back = origin?.isConnected ? origin : document.querySelector<HTMLElement>(`[data-kex-row="${idRef.current}"]`);
      if (dialog && (dialog.contains(document.activeElement) || document.activeElement === document.body)) back?.focus({ preventScroll: true });
    };
  }, [modal]);

  // Portal to the shell so a transitioning course panel cannot clip the fixed reader.
  // Isolate siblings along the ancestor path; never make the modal's own ancestor inert.
  useEffect(() => {
    const dialog = root.current;
    if (!dialog || !modal) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const restoreViewport = preserveViewport(origin);
    const tx = navigation.begin('reader', { selector: '.kex-sheet', scroll: 'preserve' });
    const superseded = (): void => close.current();
    tx.signal.addEventListener('abort', superseded, { once: true });
    const enterTimer = window.setTimeout(() => {
      void tx.finish().catch(() => undefined);
    }, motionAllowed() ? MOTION.overlayEnter : 0);
    const inert: HTMLElement[] = [];
    let branch: HTMLElement | null = dialog.parentElement;
    while (branch && branch !== document.body) {
      for (const sibling of branch.parentElement?.children ?? []) {
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.hasAttribute('inert')) {
          sibling.setAttribute('inert', '');
          inert.push(sibling);
        }
      }
      branch = branch.parentElement;
    }
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    focusWithoutJump(dialog);

    const focusables = (): HTMLElement[] => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])')).filter((el) => el.tabIndex >= 0 && !el.hidden && !el.closest('[hidden], [inert], [aria-hidden="true"]'));
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismissRef.current();
      } else if (e.key === 'Tab') {
        const list = focusables();
        const first = list[0] ?? dialog;
        const last = list[list.length - 1] ?? dialog;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          e.preventDefault();
          focusWithoutJump(last);
        } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          e.preventDefault();
          focusWithoutJump(first);
        }
      }
    };
    const onFocus = (e: FocusEvent): void => {
      if (e.target instanceof Node && !dialog.contains(e.target)) focusWithoutJump(dialog);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(enterTimer);
      tx.signal.removeEventListener('abort', superseded);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      inert.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      if (tx.current()) restoreViewport();
      tx.cancel();
    };
  }, [modal]);

  /** Drag the left edge; the width is saved once the pointer is released. Arrow keys on the handle step 2 %. */
  const onResizeDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture?.(e.pointerId);
    const clamp = (f: number): number => Math.max(0.36, Math.min(0.8, f));
    let last = prefs.side;
    const move = (ev: PointerEvent): void => {
      last = clamp((window.innerWidth - ev.clientX) / window.innerWidth);
      setDrag(last);
    };
    const up = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      setReader({ side: Math.round(last * 100) / 100 });
      setDrag(undefined);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const onResizeKey = (e: KeyboardEvent): void => {
    const d = e.key === 'ArrowLeft' ? 0.02 : e.key === 'ArrowRight' ? -0.02 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    setReader({ side: Math.round(Math.max(0.36, Math.min(0.8, prefs.side + d)) * 100) / 100 });
  };

  const content = loaded && loaded.id === id && 'content' in loaded ? loaded.content : undefined;
  const failed = loaded && loaded.id === id && 'error' in loaded;
  const download = content?.kind === 'frame' ? content.download : undefined;
  const frameFailed = content?.kind === 'frame' && failedFrame === content.src;
  const busy = !failed && (!content || (content.kind === 'frame' && readyFrame !== content.src && !frameFailed));

  useEffect(() => {
    if (content?.kind !== 'frame' || readyFrame === content.src || failedFrame === content.src) return;
    // Downloads and blocked viewers may never finish. Always retain the original link.
    const timer = window.setTimeout(() => setFailedFrame(content.src), 15_000);
    return () => window.clearTimeout(timer);
  }, [content, readyFrame, failedFrame]);

  const article = content?.kind === 'article';
  const readerStyle = {
    '--kex-read-size': `${READER_SIZES[prefs.size] ?? 16}px`,
  };
  return createPortal(
    <div class={`kex-reader kex-reader--${mode}${drag !== undefined ? ' kex-reader--dragging' : ''}`} data-state={closing ? 'closing' : 'open'} data-width={prefs.width} data-leading={prefs.leading} data-font={prefs.font} style={readerStyle}>
      {modal && <div class="kex-reader__backdrop" aria-hidden="true" onClick={() => dismiss()} />}
    <aside class="kex-sheet kex-dialog" ref={root} role={modal ? 'dialog' : 'complementary'} aria-modal={modal ? 'true' : undefined} aria-label={`${t('preview.title')}: ${row.title}`} tabIndex={-1} data-kex-test="preview" data-kex-preview={id} data-mode={mode}>
      {!modal && (
        <div
          class="kex-reader__resize"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('reader.resize')}
          aria-valuemin={36}
          aria-valuemax={80}
          aria-valuenow={Math.round(sideFraction * 100)}
          tabIndex={0}
          data-kex-test="reader-resize"
          onPointerDown={onResizeDown}
          onKeyDown={onResizeKey}
        />
      )}
      <header class="kex-sheet__head">
        <div class="kex-sheet__titles">
          <p class="kex-sheet__label kex-mono">{row.label}</p>
          <h2 class="kex-sheet__title" title={row.title}>{row.title}</h2>
        </div>
        <div class="kex-sheet__actions">
          {onStep && (
            <span class="kex-sheet__step">
              <button type="button" class="kex-iconbtn" aria-label={`${t('reader.prev')} (↑)`} title={`${t('reader.prev')} (↑)`} onClick={() => onStep(-1)} data-kex-test="reader-prev"><ChevronUp size={18} strokeWidth={1.75} aria-hidden="true" /></button>
              <button type="button" class="kex-iconbtn" aria-label={`${t('reader.next')} (↓)`} title={`${t('reader.next')} (↓)`} onClick={() => onStep(1)} data-kex-test="reader-next"><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" /></button>
            </span>
          )}
          <span class="kex-sheet__aa">
            <button type="button" ref={menuBtn} class={`kex-act kex-act--aa${menuOpen ? ' kex-act--on' : ''}`} aria-haspopup="dialog" aria-expanded={menuOpen} title={t('reader.text')} data-kex-test="reader-aa" onClick={() => setMenuOpen(!menuOpen)}>
              <span class="kex-aa" aria-hidden="true">A<small>a</small></span>
              <span class="kex-sr">{t('reader.text')}</span>
            </button>
            {menuOpen && <ReaderMenu prefs={prefs} article={article} anchor={menuBtn.current} onClose={() => setMenuOpen(false)} />}
          </span>
          <button type="button" class={`kex-act${pinned ? ' kex-act--on' : ''}`} aria-pressed={pinned} onClick={() => onPin(row)}>
            <PinIcon size={17} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
            <span class="kex-act__text">{pinned ? t('row.unpin') : t('row.pin')}</span>
          </button>
          {download && (
            <a class="kex-act" href={download}>
              <Download size={17} strokeWidth={1.75} aria-hidden="true" />
              <span class="kex-act__text">{t('preview.download')}</span>
            </a>
          )}
          <Button variant="filled" href={row.cm.url} newTab class="kex-btn--sheet" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onOpen(row, true);
          }}>
            {t('preview.open')}
          </Button>
          <button type="button" class="kex-iconbtn kex-sheet__close" aria-label={t('preview.close')} title={`${t('preview.close')} (Esc)`} onClick={(e) => dismiss(e.detail === 0)}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div class="kex-sheet__body" aria-busy={busy}>
        {busy && <div class="kex-sheet__skeleton" role="status" data-kex-test="reader-skeleton"><span class="kex-sr">{t('preview.loading')}</span><div aria-hidden="true"><i /><i /><i /><i /><i /><i /></div></div>}
        {(failed || frameFailed) && <div class="kex-sheet__state" role="status">{t('preview.failed')}</div>}
        {content?.kind === 'frame' && !frameFailed && (
          <iframe class="kex-sheet__frame" key={content.src} src={content.src} title={row.title} tabIndex={readyFrame === content.src ? 0 : -1} data-kex-test="preview-frame" referrerpolicy="same-origin" data-ready={readyFrame === content.src ? 'true' : 'false'} onLoad={() => setReadyFrame(content.src)} onError={() => setFailedFrame(content.src)} />
        )}
        {content?.kind === 'article' && <article class="kex-sheet__article" dangerouslySetInnerHTML={{ __html: content.html }} />}
        {content?.kind === 'link' && (
          <div class="kex-sheet__card">
            <p class="kex-mono kex-sheet__domain">{content.domain || domainOf(content.href)}</p>
            <p class="kex-sheet__url">{content.href}</p>
            <Button variant="filled" href={content.href} newTab>{t('preview.open')}</Button>
          </div>
        )}
        {content?.kind === 'none' && (
          <div class="kex-sheet__card">
            <p class="kex-sheet__url">{t('preview.noPreview')}</p>
            <a class="kex-sheet__go" href={row.cm.url} target="_blank" rel="noopener noreferrer">
              {t('preview.open')} <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </aside>
    </div>, document.getElementById('kex-root') ?? document.body,
  );
}
