import { Calendar, ChartColumn, FileText, Folder, GraduationCap, LogOut, MessageSquare, SlidersHorizontal, User, type LucideIcon } from 'lucide-preact';
import { go } from '../../actions/navigate';
import { findLogoutHref } from '../../data/scrape/usermenu';
import { t } from '../../i18n';
import { pageInfo, user, userMenuItems, userMenuOpen } from '../../state';
import { Popover } from './Popover';

type IconType = LucideIcon;

const ICONS: [RegExp, IconType][] = [
  [/\/user\/profile\.php/, User],
  [/\/grade\//, GraduationCap],
  [/\/calendar\//, Calendar],
  [/\/message\//, MessageSquare],
  [/\/user\/files\.php/, Folder],
  [/\/reportbuilder\//, ChartColumn],
  [/\/user\/preferences\.php/, SlidersHorizontal],
  [/\/login\/logout\.php/, LogOut],
];
const iconFor = (href: string, kind: 'link' | 'logout'): IconType =>
  kind === 'logout' ? LogOut : (ICONS.find(([re]) => re.test(href))?.[1] ?? FileText);

/** Moodle's own user menu items, scraped from #user-action-menu (logout is resolved at click time). */
export function UserMenu({ anchor }: { anchor: HTMLElement | null }) {
  const close = (): void => {
    userMenuOpen.value = false;
  };
  const scraped = userMenuItems.value;
  const root = pageInfo.value?.wwwroot ?? '';
  const items = scraped.length
    ? scraped
    : [
        { label: t('usermenu.profile'), href: `${root}/user/profile.php`, kind: 'link' as const, divider: false },
        { label: t('usermenu.logout'), href: '', kind: 'logout' as const, divider: true },
      ];
  const open = (e: MouseEvent, it: (typeof items)[number]): void => {
    e.preventDefault();
    close();
    if (it.kind === 'logout') {
      const live = findLogoutHref(document) ?? (pageInfo.value ? `${root}/login/logout.php?sesskey=${encodeURIComponent(pageInfo.value.sesskey)}` : it.href);
      go(live);
      return;
    }
    go(it.href, e.ctrlKey || e.metaKey);
  };
  return (
    <Popover anchor={anchor} label={user.value?.fullname ?? t('sidebar.userMenu')} onClose={close} role="menu" testId="user-menu">
      {items.map((it) => (
        <div key={it.label + it.href} role="none">
          {it.divider && <div class="kex-pop__divider" role="separator" />}
          <a class="kex-pop__item" role="menuitem" tabIndex={-1} href={it.kind === 'logout' ? '#' : it.href} onClick={(e) => open(e, it)}>
            {(() => {
              const Icon = iconFor(it.href, it.kind);
              return <Icon size={15} strokeWidth={1.75} aria-hidden="true" />;
            })()}
            {it.label}
          </a>
        </div>
      ))}
    </Popover>
  );
}
