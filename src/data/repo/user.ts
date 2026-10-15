import { cache } from '../cache';
import type { UserInfo } from '../model';
import { initialsOf } from '../scrape/user';
import { ws } from '../ws';

interface UserByField {
  id: number;
  fullname: string;
  firstname?: string;
  lastname?: string;
  profileimageurlsmall?: string;
}

export const USER_TTL_MS = 24 * 3600 * 1000;

export function cachedUser(): UserInfo | undefined {
  return cache.peek<UserInfo>('user')?.data;
}

/** Name and avatar via the AJAX service; used only when the page itself does not show them. */
export async function fetchUser(userId: number): Promise<UserInfo | null> {
  const rows = await ws.call<UserByField[]>('core_user_get_users_by_field', { field: 'id', values: [String(userId)] });
  const u = rows[0];
  if (!u) return null;
  const img = u.profileimageurlsmall;
  return {
    id: userId,
    fullname: u.fullname,
    initials: initialsOf(u.fullname),
    avatar: img && /^https?:/.test(img) && !/\/u\/f\d/.test(img) ? img : undefined,
  };
}

export async function storeUser(u: UserInfo): Promise<void> {
  await cache.write('user', u);
}
