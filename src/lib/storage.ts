/** Thin typed wrapper over browser.storage.local (shimmed in the Chromium test harness). */

type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void;

function area(): browser.storage.StorageArea | null {
  try {
    return typeof browser !== 'undefined' ? browser.storage.local : null;
  } catch {
    return null;
  }
}

export async function storageGetAll(): Promise<Record<string, unknown>> {
  const a = area();
  if (!a) return {};
  return (await a.get(null)) as Record<string, unknown>;
}

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const a = area();
  if (!a) return undefined;
  const r = await a.get(key);
  return r[key] as T | undefined;
}

export async function storageSet(items: Record<string, unknown>): Promise<void> {
  await area()?.set(items);
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  await area()?.remove(keys);
}

export function onStorageChanged(cb: Listener): () => void {
  if (typeof browser === 'undefined') return () => undefined;
  const handler = (changes: Record<string, browser.storage.StorageChange>, areaName: string): void => {
    if (areaName === 'local') cb(changes);
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
