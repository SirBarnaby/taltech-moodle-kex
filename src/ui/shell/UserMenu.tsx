import { Check, Languages, LogOut, User, type LucideIcon } from 'lucide-preact';
import { go } from '../../actions/navigate';
import { findLogoutHref } from '../../data/scrape/usermenu';
import { t } from '../../i18n';
import { languages, pageInfo, user, userMenuItems, userMenuOpen } from '../../state';
import { Popover } from './Popover';

type IconType = LucideIcon;

const iconFor = (kind: 'link' | 'logout'): IconType => (kind === 'logout' ? LogOut : User);

/** The user menu keeps what the sidebar does not have: profile, the language, log out. Everything else moved into the sidebar. */
const KEPT = /\/user\/profile\.php/;

/** Items of Moodle's own user menu (#user-action-menu, logout is resolved at click time), reduced to profile and log out. */
export function UserMenu({ anchor }: { anchor: HTMLElement | null }) {
  const close = (): void => {
    userMenuOpen.value = false;
  };
  const scraped = userMenuItems.value.filter((it) => it.kind === 'logout' || KEPT.test(it.href));
  const root = pageInfo.value?.wwwroot ?? '';
  const base = scraped.length
    ? scraped
    : [
        { label: t('usermenu.profile'), href: `${root}/user/profile.php`, kind: 'link' as const, divider: false },
        { label: t('usermenu.logout'), href: '', kind: 'logout' as const, divider: true },
      ];
  // Profile first, the language group, then log out.
  const profile = base.filter((it) => it.kind === 'link');
  const logout = base.filter((it) => it.kind === 'logout');
  const langs = languages.value;
  const open = (e: MouseEvent, it: (typeof base)[number]): void => {
    e.preventDefault();
    close();
    if (it.kind === 'logout') {
      const live = findLogoutHref(document) ?? (pageInfo.value ? `${root}/login/logout.php?sesskey=${encodeURIComponent(pageInfo.value.sesskey)}` : it.href);
      go(live);
      return;
    }
    go(it.href, e.ctrlKey || e.metaKey);
  };
  const row = (it: (typeof base)[number]) => {
    const Icon = iconFor(it.kind);
    return (
      <div key={it.label + it.href} role="none">
        <a class="kex-pop__item" role="menuitem" tabIndex={-1} href={it.kind === 'logout' ? '#' : it.href} onClick={(e) => open(e, it)}>
          <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
          {it.label}
        </a>
      </div>
    );
  };
  return (
    <Popover anchor={anchor} label={user.value?.fullname ?? t('sidebar.userMenu')} onClose={close} role="menu" testId="user-menu">
      {profile.map(row)}
      {langs.length > 0 && (
        <div role="group" aria-label={t('nav.language')} data-kex-test="user-menu-langs">
          <div class="kex-pop__divider" role="separator" />
          <div class="kex-pop__label kex-pop__label--menu"><Languages size={13} strokeWidth={1.75} aria-hidden="true" />{t('nav.language')}</div>
          {langs.map((l) => (
            <div key={l.code} role="none">
              <a
                class="kex-pop__item"
                role="menuitem"
                aria-current={l.current ? 'true' : undefined}
                tabIndex={-1}
                lang={l.code}
                href={l.href}
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  if (!l.current) go(l.href);
                }}
              >
                {l.current ? <Check size={15} strokeWidth={1.9} aria-hidden="true" /> : <span class="kex-pop__spacer" aria-hidden="true" />}
                {l.label}
              </a>
            </div>
          ))}
        </div>
      )}
      {logout.length > 0 && <div class="kex-pop__divider" role="separator" />}
      {logout.map(row)}
    </Popover>
  );
}
