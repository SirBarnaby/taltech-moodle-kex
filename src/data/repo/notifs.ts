import { signal } from '@preact/signals';
import { cache, type Store } from '../cache';
import { decodeEntities, htmlToText } from '../../lib/sanitize';
import { ws } from '../ws';
import { countsStore } from './counts';

/** Popup notifications (`message_popup_get_popup_notifications`), 2 min TTL (architecture §8.3). */

export interface Notif {
  id: number;
  subject: string;
  /** Plain-text short message. */
  small: string;
  /** Sanitized later by the view (never stored as HTML-safe). */
  html: string;
  contextUrl: string;
  contextName: string;
  component: string;
  eventtype: string;
  created: number;
  read: boolean;
  /** "announcement" for news-forum posts, else the component's short name. */
  kind: 'announcement' | 'forum' | 'assign' | 'quiz' | 'message' | 'other';
  courseCode?: string;
}

interface RawNotif {
  id: number;
  subject?: string;
  shortenedsubject?: string;
  smallmessage?: string;
  fullmessagehtml?: string;
  fullmessage?: string;
  contexturl?: string;
  contexturlname?: string;
  component?: string;
  eventtype?: string;
  timecreated: number;
  read?: boolean;
}

interface RawResponse {
  notifications: RawNotif[];
  unreadcount?: number;
}

const ANNOUNCEMENT_RE = /announcement|teadaan|news|uudised/i;
const CODE_RE = /\b[A-Z]{3}\d{4}\b/;

export function kindOf(n: Pick<RawNotif, 'component' | 'eventtype' | 'smallmessage' | 'subject' | 'fullmessage'>): Notif['kind'] {
  const c = n.component ?? '';
  if (c === 'mod_forum') return ANNOUNCEMENT_RE.test(`${n.smallmessage ?? ''} ${n.fullmessage ?? ''} ${n.subject ?? ''}`) ? 'announcement' : 'forum';
  if (c === 'mod_assign') return 'assign';
  if (c === 'mod_quiz') return 'quiz';
  if (c === 'moodle' && /message/i.test(n.eventtype ?? '')) return 'message';
  return 'other';
}

export function mapNotifs(raw: readonly RawNotif[]): Notif[] {
  return raw.map((n) => {
    const subject = decodeEntities(n.shortenedsubject || n.subject || '');
    const small = htmlToText(n.smallmessage || n.fullmessage || '');
    return {
      id: n.id,
      subject,
      small,
      html: n.fullmessagehtml || `<p>${small}</p>`,
      contextUrl: n.contexturl ?? '',
      contextName: n.contexturlname ?? '',
      component: n.component ?? '',
      eventtype: n.eventtype ?? '',
      created: n.timecreated,
      read: !!n.read,
      kind: kindOf(n),
      courseCode: CODE_RE.exec(`${n.subject ?? ''} ${n.smallmessage ?? ''}`)?.[0],
    };
  });
}

let store: Store<Notif[]> | undefined;
let userId = 0;

export function configureNotifs(uid: number): void {
  userId = uid;
}

export function notifsStore(): Store<Notif[]> {
  store ??= cache.swr<Notif[]>('notifs', 2 * 60 * 1000, async () => {
    const res = await ws.call<RawResponse>('message_popup_get_popup_notifications', { useridto: userId, newestfirst: true, limit: 20, offset: 0 });
    return mapNotifs(res.notifications ?? []);
  });
  return store;
}

/** Older notifications loaded by the Notifications page ("Load older"), after the cached first 20. */
export const moreNotifs = signal<Notif[]>([]);
/** The server has no more (a page came back short). */
export const moreDone = signal(false);
export const moreBusy = signal(false);
const PAGE = 20;

export async function loadMoreNotifs(): Promise<void> {
  if (moreBusy.peek() || moreDone.peek()) return;
  moreBusy.value = true;
  try {
    const first = notifsStore().value.peek()?.length ?? 0;
    const offset = first + moreNotifs.peek().length;
    const res = await ws.call<RawResponse>('message_popup_get_popup_notifications', { useridto: userId, newestfirst: true, limit: PAGE, offset });
    const got = mapNotifs(res.notifications ?? []);
    const seen = new Set([...(notifsStore().value.peek() ?? []), ...moreNotifs.peek()].map((n) => n.id));
    moreNotifs.value = [...moreNotifs.peek(), ...got.filter((n) => !seen.has(n.id))];
    if (got.length < PAGE) moreDone.value = true;
  } finally {
    moreBusy.value = false;
  }
}

export function resetMoreNotifs(): void {
  moreNotifs.value = [];
  moreDone.value = false;
}

/** Local flag: marking is in flight (the views disable nothing; it only drives a `data-busy` attribute in tests). */
export const notifBusy = signal(false);

function setUnread(n: number): void {
  const c = countsStore();
  c.value.value = { notifs: Math.max(0, n), messages: c.value.value?.messages ?? 0 };
  void cache.write('counts', c.value.value);
}

export async function markRead(id: number): Promise<void> {
  const list = notifsStore().value.value ?? [];
  const extra = moreNotifs.value;
  const n = list.find((x) => x.id === id) ?? extra.find((x) => x.id === id);
  if (!n || n.read) return;
  const next = list.map((x) => (x.id === id ? { ...x, read: true } : x));
  notifsStore().value.value = next;
  moreNotifs.value = extra.map((x) => (x.id === id ? { ...x, read: true } : x));
  setUnread((countsStore().value.value?.notifs ?? 0) - 1);
  notifBusy.value = true;
  try {
    await ws.call('core_message_mark_notification_read', { notificationid: id, timeread: Math.floor(Date.now() / 1000) });
    void cache.write('notifs', next);
  } catch (e) {
    notifsStore().value.value = list;
    moreNotifs.value = extra;
    void countsStore().refresh(true);
    throw e;
  } finally {
    notifBusy.value = false;
  }
}

export async function markAllRead(): Promise<void> {
  const list = notifsStore().value.value ?? [];
  const extra = moreNotifs.value;
  const next = list.map((x) => ({ ...x, read: true }));
  notifsStore().value.value = next;
  moreNotifs.value = extra.map((x) => ({ ...x, read: true }));
  setUnread(0);
  notifBusy.value = true;
  try {
    await ws.call('core_message_mark_all_notifications_as_read', { useridto: userId });
    void cache.write('notifs', next);
  } catch (e) {
    notifsStore().value.value = list;
    moreNotifs.value = extra;
    void countsStore().refresh(true);
    throw e;
  } finally {
    notifBusy.value = false;
  }
}
