import { ArrowUpRight, Download, Pin as PinIcon, X } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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

/** Right-hand sheet over the course page: PDF/image iframe, page article or URL card (design-spec §7). */
export function PreviewSheet({ row, pinned, onClose, onOpen, onPin }: PreviewSheetProps) {
  const root = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState<Loaded>();
  const id = row.cm.id;

  useEffect(() => {
    let live = true;
    setLoaded(undefined);
    loadPreview(id, row.cm.modname, row.cm.url)
      .then((content) => live && setLoaded({ id, content }))
      .catch(() => live && setLoaded({ id, error: true }));
    return () => {
      live = false;
    };
  }, [id, row.cm.modname, row.cm.url]);

  // Keys (j/k/Esc) must keep working, so focus stays on the sheet, not inside the PDF viewer.
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [id]);

  const content = loaded && loaded.id === id && 'content' in loaded ? loaded.content : undefined;
  const failed = loaded && loaded.id === id && 'error' in loaded;
  const download = content?.kind === 'frame' ? content.download : undefined;

  return (
    <aside class="kex-sheet" ref={root} role="dialog" aria-modal="false" aria-label={`${t('preview.title')}: ${row.title}`} tabIndex={-1} data-kex-test="preview" data-kex-preview={id}>
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
          <Button variant="filled" href={row.cm.url} class="kex-btn--sheet" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onOpen(row, false);
          }}>
            {t('preview.open')}
          </Button>
          <button type="button" class="kex-iconbtn kex-sheet__close" aria-label={t('preview.close')} title={`${t('preview.close')} (Esc)`} onClick={onClose}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div class="kex-sheet__body" aria-busy={!content && !failed}>
        {!content && !failed && <div class="kex-sheet__state" role="status">{t('preview.loading')}</div>}
        {failed && <div class="kex-sheet__state">{t('preview.failed')}</div>}
        {content?.kind === 'frame' && (
          <iframe class="kex-sheet__frame" key={content.src} src={content.src} title={row.title} data-kex-test="preview-frame" referrerpolicy="same-origin" />
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
            <a class="kex-sheet__go" href={row.cm.url}>
              {t('preview.open')} <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
