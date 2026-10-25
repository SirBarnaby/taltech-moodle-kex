import { GripVertical, Pencil, X } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { go, homeUrl } from '../../actions/navigate';
import { dragPin, exportPins, importPins, pinEdit, pinRenaming, reorderPin, unpinItem } from '../../actions/pins';
import { eyebrow } from '../../data/topics';
import { cmDetails } from '../../data/repo/cmdetails';
import { typeNameFor } from '../../data/repo/modnames';
import { displayName } from '../../data/repo/courses';
import { groupPins, pinsStore } from '../../data/repo/pins';
import { prefetchStates } from '../../data/repo/prefetch';
import { t } from '../../i18n';
import { pageInfo, sidebarCourses } from '../../state';
import { unavailablePins } from '../../state/pins';
import { Band } from '../components/Band';
import { Button } from '../components/Button';
import { useEffectsConfig, useQuietFocus } from '../components/hooks';
import { ItemRow, type RowAction } from '../components/ItemRow';
import { editKeys, RenameInput } from '../components/PinnedRow';
import { EmptyState } from '../components/States';
import { Thumb, thumbVariant } from '../components/Thumb';

const isModified = (e: MouseEvent): boolean => e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0;

export function PinnedView() {
  useEffectsConfig();
  useQuietFocus();
  const pins = pinsStore().value.value ?? [];
  const courses = sidebarCourses.value;
  const edit = pinEdit.value;
  const renaming = pinRenaming.value;
  const gone = unavailablePins.value;
  const file = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<{ cmid: number; over?: number } | undefined>();
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const [sel, setSel] = useState<string | undefined>();

  useEffect(() => {
    prefetchStates(courses);
    return () => {
      pinEdit.value = false;
      pinRenaming.value = undefined;
    };
  }, [courses.length]);

  const names = new Map(courses.map((c) => [c.id, displayName(c)]));
  const groups = groupPins(pins, names);
  const first = pins[0] ? `p${pins[0].cmid}` : undefined;
  const current = sel && pins.some((p) => `p${p.cmid}` === sel) ? sel : first;

  const startDrag = (e: PointerEvent, cmid: number): void => {
    e.preventDefault();
    setDrag({ cmid });
    const move = (ev: PointerEvent): void => {
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-kex-pin]');
      const over = row ? Number(row.dataset.kexPin) : undefined;
      if (over !== dragRef.current?.over) setDrag({ cmid, over });
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = dragRef.current;
      setDrag(undefined);
      if (d?.over !== undefined) void dragPin(cmid, d.over);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const n = pins.length;
  const label = n === 1 ? t('pinned.label1') : t('pinned.label', { n });

  const actions = (
    <>
      <button type="button" class="kex-bandbtn" data-kex-test="pins-export" onClick={exportPins} disabled={!n}>{t('pinned.export')}</button>
      <button type="button" class="kex-bandbtn" data-kex-test="pins-import" onClick={() => file.current?.click()}>{t('pinned.import')}</button>
      <button
        type="button"
        class="kex-bandbtn"
        data-kex-test="pinned-edit"
        aria-pressed={edit}
        disabled={!n}
        onClick={() => {
          pinEdit.value = !pinEdit.value;
        }}
      >
        <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
        {edit ? t('pinned.done') : t('pinned.edit')}
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        data-kex-test="pins-file"
        onChange={(e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          (e.currentTarget as HTMLInputElement).value = '';
          if (f) void importPins(f, pageInfo.value?.wwwroot ?? '');
        }}
      />
    </>
  );

  return (
    <main class="kex-main kex-pinpage" id="kex-main" data-kex-test="pinned-page" data-edit={edit ? 'true' : 'false'}>
      <Band label={label} title={t('pinned.title')} actions={actions} testId="band" />
      <div class="kex-content">
        {!n ? (
          <EmptyState kicker={t('pinned.emptyKicker')} title={t('pinned.emptyTitle')} text={t('pinned.emptyText')}>
            <Button variant="outlined" arrow={false} href={homeUrl('/my/')} onClick={(e) => { e.preventDefault(); go('/my/'); }}>{t('nav.workspace')}</Button>
          </EmptyState>
        ) : (
          <ul class="kex-rows kex-prows" data-kex-test="pin-rows">
            {groups.map((g) => (
              <>
                <li class="kex-rowgroup kex-mono kex-prows__group" key={`g${g.courseId}`}>{g.heading}</li>
                {g.pins.map((p) => {
                  const unavailable = gone.has(p.cmid);
                  const dragging = drag?.cmid === p.cmid;
                  const over = drag?.over === p.cmid && drag.cmid !== p.cmid;
                  const rowActions: RowAction[] = edit
                    ? [
                        {
                          key: 'rename', label: t('pinned.rename'), testId: 'act-rename', icon: <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />,
                          onClick: () => (pinRenaming.value = p.cmid),
                        },
                        {
                          key: 'remove', label: t('pinned.removeShort'), testId: 'act-remove', icon: <X size={17} strokeWidth={1.75} aria-hidden="true" />,
                          onClick: () => void unpinItem(p.cmid),
                        },
                      ]
                    : [
                        {
                          key: 'remove', label: t('row.unpin'), testId: 'act-remove', icon: <X size={17} strokeWidth={1.75} aria-hidden="true" />,
                          onClick: () => void unpinItem(p.cmid),
                        },
                      ];
                  return (
                    <ItemRow
                      key={p.cmid}
                      id={`p${p.cmid}`}
                      testId={`pin-row-${pins.indexOf(p) + 1}`}
                      class={`kex-prow${edit ? ' kex-prow--edit' : ''}${dragging ? ' kex-prow--drag' : ''}${over ? ' kex-prow--over' : ''}`}
                      attrs={{ 'data-kex-pin': p.cmid }}
                      selected={`p${p.cmid}` === current}
                      onSelect={setSel}
                      enter={pins.indexOf(p)}
                      tone={unavailable ? 'gone' : 'normal'}
                      ariaLabel={p.title}
                      onKey={(e) => {
                        if (edit) editKeys(e, p, g.pins, false);
                      }}
                      thumb={
                        <div class="kex-prow__thumb">
                          {edit && (
                            <button
                              type="button"
                              class="kex-prow__grip"
                              aria-label={t('pinned.grip', { title: p.title })}
                              title={t('pinned.gripHint')}
                              data-kex-test="pin-grip"
                              onPointerDown={(e) => startDrag(e, p.cmid)}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  void reorderPin(p.cmid, e.key === 'ArrowDown' ? 1 : -1, g.pins).then(() =>
                                    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-kex-pin="${p.cmid}"] .kex-prow__grip`)?.focus({ preventScroll: true })),
                                  );
                                }
                              }}
                            >
                              <GripVertical size={18} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                          )}
                          <Thumb variant={thumbVariant(p.kind, p.format)} format={p.format} seed={p.cmid} />
                        </div>
                      }
                      label={unavailable ? t('pinned.unavailable') : eyebrow(typeNameFor(p.modname, cmDetails.value.get(p.cmid)))}
                      title={renaming === p.cmid ? <RenameInput pin={p} /> : p.title}
                      titleHref={renaming === p.cmid || unavailable ? undefined : p.url}
                      onTitle={() => go(p.url)}
                      subtitle={unavailable ? t('pinned.unavailableText') : undefined}
                      actions={rowActions}
                      button={unavailable ? undefined : {
                        label: t('verb.open'), variant: 'outlined', href: p.url, testId: 'pin-open', onClick: (e) => {
                          if (isModified(e)) return;
                          e.preventDefault();
                          go(p.url);
                        },
                      }}
                    />
                  );
                })}
              </>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
