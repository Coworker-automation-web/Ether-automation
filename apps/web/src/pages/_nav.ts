import type { SidebarNavItem } from '../app/components/Sidebar';

type NavConfigItem = Omit<SidebarNavItem, 'current' | 'onClick'> & {
  /** Items stay hidden until the page they point to is built. */
  enabled: boolean;
};

export const NAV: NavConfigItem[] = [
  { label: 'Home', href: '/', icon: 'home', enabled: true },
  { label: 'Workspaces', href: '/app', icon: 'grid', enabled: true },
  { label: 'Library', href: '#', icon: 'folder', enabled: false },
  { label: 'Agents', href: '#', icon: 'agents', enabled: false },
  { label: 'Templates', href: '#', icon: 'templates', enabled: false },
  { label: 'Pricing', href: '#', icon: 'tag', enabled: false },
  { label: 'Settings', href: '/app', icon: 'settings', enabled: false },
];

/** Enabled items only, with the one matching `currentHref` marked as the current page. */
export function navItems(currentHref: string): SidebarNavItem[] {
  return NAV.filter((item) => item.enabled).map(({ enabled: _enabled, ...item }) => ({
    ...item,
    current: item.href === currentHref,
  }));
}
