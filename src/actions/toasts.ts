import { toasts, type ToastItem } from '../state';

let nextId = 1;

export function pushToast(message: string, opts: { actionLabel?: string; onAction?: () => void; ms?: number } = {}): number {
  const id = nextId++;
  const item: ToastItem = { id, message, actionLabel: opts.actionLabel, onAction: opts.onAction, ms: opts.ms ?? (opts.onAction ? 6000 : 3000) };
  toasts.value = [...toasts.value, item];
  window.setTimeout(() => dismissToast(id), item.ms);
  return id;
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}
