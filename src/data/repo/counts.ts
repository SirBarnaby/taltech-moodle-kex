import { cache, type Store } from '../cache';
import { ws } from '../ws';

/** Unread notification and message counts (2 min TTL). Drives the sidebar badge and the avatar dot. */
export interface Counts {
  notifs: number;
  messages: number;
}

let store: Store<Counts> | undefined;
let userId = 0;

export function configureCounts(uid: number): void {
  userId = uid;
}

export function countsStore(): Store<Counts> {
  store ??= cache.swr<Counts>('counts', 2 * 60 * 1000, async () => {
    // Both calls travel in the same batched POST.
    const [notifs, messages] = await Promise.all([
      ws.call<number>('message_popup_get_unread_popup_notification_count', { useridto: userId }),
      ws.call<number>('core_message_get_unread_conversations_count', { useridto: userId }).catch(() => 0),
    ]);
    return { notifs: Number(notifs) || 0, messages: Number(messages) || 0 };
  });
  return store;
}
