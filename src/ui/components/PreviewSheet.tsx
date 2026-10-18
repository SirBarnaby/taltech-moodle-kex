import { ArrowUpRight, Download, Pin as PinIcon, X } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { loadPreview, type PreviewContent } from '../../data/repo/preview';
import type { RowModel } from '../../data/topics';
import { t } from '../../i18n';
import { Button } from './Button';
import { domainOf } from '../../data/repo/preview';

interface PreviewSheetProps {
  row: RowModel;
  pinned: boolean;
  onClose: () => void;
  onOpen: (row: RowModel, newTab: boolean) => void;
  onPin: (row: RowModel) => void;
}

type Loaded = { id: number; content: PreviewContent } | { id: number; error: true } | undefined;

/** Modal reader: keep the originating page painted and its scroll position intact. */
export function PreviewSheet({ row, pinned, onClose, onOpen, onPin }: PreviewSheetProps) {
  const root = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState<Loaded>();
  const [readyFrame, setReadyFrame] = useState<string>();
  const [failedFrame, setFailedFrame] = useState<string>();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number>();
  const close = useRef(onClose);
  close.current = onClose;
  const id = row.cm.id;

  const dismiss = (instant = false): void => {
    if (instant || document.documentElement.dataset.kexMotion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      close.current();
      return;
    }
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => close.current(), 140);
  };

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    let live = true;
    setLoaded(undefined);
    setReadyFrame(undefined);
    setFailedFrame(undefined);
    setClosing(false);
    window.clearTimeout(closeTimer.current);
    loadPreview(id, row.cm.modname, row.cm.url)
      .then((content) => live && setLoaded({ id, content }))
      .catch(() => live && setLoaded({ id, error: true }));
    return () => {
      live = false;
    };
  }, [id, row.cm.modname, row.cm.url]);

  // Portal to the shell so a transitioning course panel cannot clip the fixed reader.
  // Isolate siblings along the ancestor path; never make the modal's own ancestor inert.
  useEffect(() => {
    const dialog = root.current;
    if (!dialog) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const originRow = origin?.closest<HTMLElement>('[data-kex-row], [data-kex-pin], [data-kex-item]');
    const scroll = { x: window.scrollX, y: window.scrollY };
    const scrollParents: { el: HTMLElement; top: number; left: number }[] = [];
    for (let el = origin?.parentElement; el; el = el.parentElement) {
      if (el.scrollTop || el.scrollLeft) scrollParents.push({ el, top: el.scrollTop, left: el.scrollLeft });
    }
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
    dialog.focus({ preventScroll: true });

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
          last.focus({ preventScroll: true });
        } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    const onFocus = (e: FocusEvent): void => {
      if (e.target instanceof Node && !dialog.contains(e.target)) dialog.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.clearTimeout(closeTimer.current);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      inert.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      const target = origin?.isConnected ? origin : originRow?.isConnected ? originRow : undefined;
      target?.focus({ preventScroll: true });
      scrollParents.forEach(({ el, top, left }) => { el.scrollTop = top; el.scrollLeft = left; });
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) window.scrollTo(scroll.x, scroll.y);
    };
  }, []);

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

  return createPortal(
    <div class="kex-reader" data-state={closing ? 'closing' : 'open'}>
      <div class="kex-reader__backdrop" aria-hidden="true" onClick={() => dismiss()} />
    <aside class="kex-sheet" ref={root} role="dialog" aria-modal="true" aria-label={`${t('preview.title')}: ${row.title}`} tabIndex={-1} data-kex-test="preview" data-kex-preview={id}>
      <header class="kex-sheet__head">
        <div class="kex-sheet__titles">
          <p class="kex-sheet__label kex-mono">{row.label}</p>
          <h2 class="kex-sheet__title">{row.title}</h2>
        </div>
        <div class="kex-sheet__actions">
          <button type="button" class={`kex-act${pinned ? ' kex-act--on' : ''}`} aria-pressed={pinned} onClick={() => onPin(row)}>
            <PinIcon size={17} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
            <span>{pinned ? t('row.unpin') : t('row.pin')}</span>
          </button>
          {download && (
            <a class="kex-act" href={download}>
              <Download size={17} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('preview.download')}</span>
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
