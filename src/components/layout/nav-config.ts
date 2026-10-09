import {
  Building2,
  BriefcaseBusiness,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Flame,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Layers,
  Mail,
  NotebookText,
  Package,
  PackagePlus,
  Percent,
  Scale,
  ScrollText,
  Send,
  Settings,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { ROLES, can, type Permission, type Role } from '@/shared';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /**
   * What a user needs to see the item and, for a link, to open its page (src/shared/permissions.ts).
   * Planned items use the permission of the area they belong to.
   */
  permission: Permission;
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
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'proposals.view',
      },
      // One entry for every proposal; the page switches between new and existing (renewals).
      { label: 'Proposals', href: '/proposals', icon: FileText, permission: 'proposals.view' },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { label: 'RFQ', href: '/rfq', icon: Send, permission: 'proposals.view' },
      { label: 'Quotes and QCR', href: '/quotes', icon: Scale, permission: 'proposals.view' },
      {
        label: 'Placement Slips',
        href: '/placement-slips',
        icon: FileCheck2,
        permission: 'proposals.view',
      },
      { label: 'Fire rate check', href: '/rating/fire', icon: Flame, permission: 'rating.use' },
    ],
  },
  {
    title: 'Masters',
    items: [
      {
        label: 'Clients',
        href: '/masters/clients',
        icon: BriefcaseBusiness,
        permission: 'clients.view',
      },
      {
        label: 'Insurers',
        href: '/masters/insurers',
        icon: Landmark,
        permission: 'masters.view',
      },
      {
        label: 'Occupancy',
        href: '/masters/occupancy',
        icon: Building2,
        permission: 'masters.view',
      },
      { label: 'Pincodes', href: '/masters/pincodes', icon: MapPin, permission: 'masters.view' },
      { label: 'Policies', href: '/masters/products', icon: Package, permission: 'masters.view' },
      {
        label: 'Coverage sections',
        href: '/masters/sections',
        icon: Layers,
        permission: 'masters.view',
      },
      {
        label: 'Add-on Covers',
        href: '/masters/addons',
        icon: PackagePlus,
        permission: 'masters.view',
      },
      { label: 'Tax rates', href: '/masters/tax-rates', icon: Percent, permission: 'masters.view' },
      {
        label: 'Standard notes',
        href: '/masters/notes',
        icon: NotebookText,
        permission: 'masters.view',
      },
      {
        label: 'Occupancy cover defaults',
        href: '/masters/occupancy-defaults',
        icon: ListChecks,
        permission: 'masters.view',
      },
      {
        label: 'Document templates',
        href: '/masters/templates',
        icon: FileSpreadsheet,
        permission: 'masters.view',
      },
      {
        label: 'Email templates',
        href: '/masters/email-templates',
        icon: Mail,
        permission: 'masters.view',
      },
      {
        label: 'Import data',
        href: '/masters/import',
        icon: FileUp,
        // Clients and risk locations need clients.manage; the insurer import also masters.manage.
        permission: 'clients.manage',
      },
      { label: 'Clauses', href: '/masters/clauses', icon: ScrollText, permission: 'masters.view' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Users', href: '/users', icon: UserCog, permission: 'users.manage' },
      { label: 'Audit log', href: '/audit', icon: History, permission: 'audit.view' },
      { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
    ],
  },
];

/** True when every role holds the permission, so it can show before the user has loaded. */
export function isOpenToEveryRole(permission: Permission): boolean {
  return ROLES.every((role) => can([role], permission));
}

/**
 * The groups and items a user may see. Each item needs its permission, and a group left with
 * no items is dropped. While the user loads (roles undefined) only the items every role may see
 * are shown, so nothing appears and then disappears.
 */
export function visibleGroups(roles: readonly Role[] | undefined): NavGroup[] {
  const allowed = (item: NavItem) =>
    roles ? can(roles, item.permission) : isOpenToEveryRole(item.permission);
  return NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter(allowed);
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function pathOf(href: string): string {
  return href.split('?')[0] ?? href;
}

/** Pages outside the navigation, with the permission each needs. */
const OTHER_PAGES: readonly { path: string; permission: Permission }[] = [
  { path: '/proposals/new', permission: 'proposals.create' },
];

const PAGE_PERMISSIONS: readonly { path: string; permission: Permission }[] = [
  ...NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) =>
      item.href && !item.planned ? [{ path: pathOf(item.href), permission: item.permission }] : [],
    ),
  ),
  ...OTHER_PAGES,
];

/**
 * The permission needed to open a page: that of the nav link or other page with the longest
 * path that is the page or one of its parents (so /proposals/{id} needs proposals.view and
 * /proposals/new needs proposals.create). Null for pages open to every signed-in user, such as
 * /profile.
 */
export function pagePermission(pathname: string): Permission | null {
  let match: { path: string; permission: Permission } | null = null;
  for (const page of PAGE_PERMISSIONS) {
    const covers = pathname === page.path || pathname.startsWith(`${page.path}/`);
    if (covers && (!match || page.path.length > match.path.length)) match = page;
  }
  return match?.permission ?? null;
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
