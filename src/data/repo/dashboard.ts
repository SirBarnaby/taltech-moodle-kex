import { cache, type Store } from '../cache';
import { readMoodleContent } from '../adapters';
import { inventoryMoodleBlocks, type ParityItem } from '../parity';
import type { DashboardBlock } from '../scrape/dashboard';
import { ws } from '../ws';
import { livePageDoc, pageInfo } from '../../state';

export interface DashboardContent { blocks: DashboardBlock[]; inventory: ParityItem[] }
let store: Store<DashboardContent> | undefined;
export function dashboardStore(): Store<DashboardContent> {
  store ??= cache.swr('dashboard:content:v2', 10 * 60 * 1000, async () => {
    const base = pageInfo.value?.wwwroot ?? location.origin;
    let doc = livePageDoc();
    if (!doc.querySelector('[data-block="advnotifications"], [data-block="html"]')) doc = new DOMParser().parseFromString(await ws.fetchText('/my/'), 'text/html');
    return { inventory: inventoryMoodleBlocks(doc), blocks: readMoodleContent(doc, new URL('/my/', base)).notices.data };
  });
  return store;
}
