import {
  Building2,
  FileCheck2,
  FilePlus2,
  Flame,
  Landmark,
  LayoutDashboard,
  MapPin,
  PackagePlus,
  RefreshCcw,
  Scale,
  ScrollText,
  Send,
  Settings,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { hasRole, type Role } from '@/shared';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Omitted for planned features, which show as disabled with a "Planned" tag. */
  href?: string;
  planned?: true;
  /**
   * For links with a query: the parameter that must match for the item to be active, and
   * whether a page without that parameter counts as a match (the list's default type).
   */
  activeParam?: { name: string; value: string; isDefault?: true };
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  /** When set, only users with one of these roles (or ADMIN) see the group. */
  roles?: Role[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { title: 'Overview', items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }] },
  {
    title: 'Proposals',
    items: [
      {
        label: 'New Proposals',
        href: '/proposals?type=new',
        icon: FilePlus2,
        activeParam: { name: 'type', value: 'new', isDefault: true },
      },
      {
        label: 'Existing Proposals',
        href: '/proposals?type=existing',
        icon: RefreshCcw,
        activeParam: { name: 'type', value: 'existing' },
      },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { label: 'RFQ', icon: Send, planned: true },
      { label: 'Quotes and QCR', icon: Scale, planned: true },
      { label: 'Placement Slips', icon: FileCheck2, planned: true },
      { label: 'Fire rate check', href: '/rating/fire', icon: Flame },
    ],
  },
  {
    title: 'Masters',
    items: [
      { label: 'Occupancy', href: '/masters/occupancy', icon: Building2 },
      { label: 'Pincodes', href: '/masters/pincodes', icon: MapPin },
      { label: 'Add-on Covers', icon: PackagePlus, planned: true },
      { label: 'Clauses', icon: ScrollText, planned: true },
      { label: 'Insurers', icon: Landmark, planned: true },
    ],
  },
  {
    title: 'Admin',
    roles: ['ADMIN'],
    items: [
      { label: 'Users', href: '/users', icon: UserCog },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

/** The groups a user with these roles may see. */
export function visibleGroups(roles: readonly Role[]): NavGroup[] {
  return NAV_GROUPS.filter((group) => !group.roles || hasRole(roles, ...group.roles));
}

function pathOf(href: string): string {
  return href.split('?')[0] ?? href;
}

/** The values each query parameter takes across the nav items, keyed by "path?name". */
const KNOWN_PARAM_VALUES = new Map<string, Set<string>>();
for (const group of NAV_GROUPS) {
  for (const item of group.items) {
    if (!item.href || !item.activeParam) continue;
    const key = `${pathOf(item.href)}?${item.activeParam.name}`;
    const values = KNOWN_PARAM_VALUES.get(key) ?? new Set<string>();
    values.add(item.activeParam.value);
    KNOWN_PARAM_VALUES.set(key, values);
  }
}

/**
 * True when the item is the current page. Plain links match their path and anything below it.
 * Links with a query match only their exact path with the same parameter value, so
 * /proposals/{id} and /proposals/new mark no item as active. A missing or unknown value counts
 * as the default item's value.
 */
export function isActiveItem(item: NavItem, pathname: string, search: URLSearchParams): boolean {
  if (!item.href) return false;
  const path = pathOf(item.href);
  if (!item.activeParam) return pathname === path || pathname.startsWith(`${path}/`);
  if (pathname !== path) return false;
  const { name, value, isDefault } = item.activeParam;
  const current = search.get(name);
  const known = current !== null && KNOWN_PARAM_VALUES.get(`${path}?${name}`)?.has(current);
  return known ? current === value : isDefault === true;
}
