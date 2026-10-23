import {
  Building2,
  BriefcaseBusiness,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
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
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { hasAnyPermission, type Permission } from '@/shared';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /**
   * What a user needs to see the item and, for a link, to open its page (src/shared/permissions.ts):
   * one permission, or a list of which any one is enough. Planned items use the permission of the
   * area they belong to.
   */
  permission: PagePermission;
  /** Omitted for planned features, which show as disabled with a "Planned" tag. */
  href?: string;
  planned?: true;
  /**
   * For links with a query: the parameter that must match for the item to be active, and
   * whether a page without that parameter counts as a match (the list's default type).
   */
  activeParam?: { name: string; value: string; isDefault?: true };
}

/** One permission, or a list of which the user needs at least one. */
export type PagePermission = Permission | readonly Permission[];

/** True when the user's permissions satisfy a page permission. */
export function allows(permissions: readonly Permission[], needed: PagePermission): boolean {
  return hasAnyPermission(permissions, typeof needed === 'string' ? [needed] : needed);
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
        permission: 'property.view',
      },
      // One entry for every proposal; the page switches between new and existing (renewals).
      // Property, Fire and Burglary. Employee Benefits (GMC, GPA, GTLI) and their claims are in
      // fiducial-ghi-frontend.
      { label: 'Proposals', href: '/proposals', icon: FileText, permission: 'property.view' },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { label: 'RFQ', href: '/rfq', icon: Send, permission: 'property.view' },
      { label: 'Quotes and QCR', href: '/quotes', icon: Scale, permission: 'property.view' },
      {
        label: 'Placement Slips',
        href: '/placement-slips',
        icon: FileCheck2,
        permission: 'property.view',
      },
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
        permission: 'insurers.view',
      },
      {
        label: 'Occupancy',
        href: '/masters/occupancy',
        icon: Building2,
        permission: 'masters.view',
      },
      { label: 'Pincodes', href: '/masters/pincodes', icon: MapPin, permission: 'masters.view' },
      { label: 'Policies', href: '/masters/products', icon: Package, permission: 'catalog.view' },
      {
        label: 'Coverage sections',
        href: '/masters/sections',
        icon: Layers,
        permission: 'catalog.view',
      },
      {
        label: 'Add-on Covers',
        href: '/masters/addons',
        icon: PackagePlus,
        permission: 'catalog.view',
      },
      { label: 'Tax rates', href: '/masters/tax-rates', icon: Percent, permission: 'catalog.view' },
      {
        label: 'Standard notes',
        href: '/masters/notes',
        icon: NotebookText,
        permission: 'catalog.view',
      },
      {
        label: 'Occupancy cover defaults',
        href: '/masters/occupancy-defaults',
        icon: ListChecks,
        permission: 'catalog.view',
      },
      {
        label: 'Document templates',
        href: '/masters/templates',
        icon: FileSpreadsheet,
        permission: 'templates.view',
      },
      {
        label: 'Email templates',
        href: '/masters/email-templates',
        icon: Mail,
        permission: 'email_templates.view',
      },
      {
        label: 'Import data',
        href: '/masters/import',
        icon: FileUp,
        // Any import permission; the page lists only the record types the user may import.
        permission: ['clients.import', 'insurers.import', 'masters.manage', 'catalog.manage'],
      },
      { label: 'Clauses', href: '/masters/clauses', icon: ScrollText, permission: 'catalog.view' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Users', href: '/users', icon: UserCog, permission: 'users.view' },
      { label: 'Roles', href: '/roles', icon: ShieldCheck, permission: 'roles.view' },
      { label: 'Audit log', href: '/audit', icon: History, permission: 'audit.view' },
      { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
    ],
  },
];

/**
 * The groups and items a user may see, from the permissions of their active roles (/auth/me).
 * Each item needs its permission, and a group left with no items is dropped. Roles are
 * configurable, so no item is known to be open to everyone: while the user loads (permissions
 * undefined) nothing is shown.
 */
export function visibleGroups(permissions: readonly Permission[] | undefined): NavGroup[] {
  if (!permissions) return [];
  const allowed = (item: NavItem) => allows(permissions, item.permission);
  return NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter(allowed);
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function pathOf(href: string): string {
  return href.split('?')[0] ?? href;
}

/** Pages outside the navigation, with the permission each needs. */
const OTHER_PAGES: readonly { path: string; permission: PagePermission }[] = [
  { path: '/proposals/new', permission: 'property.create' },
  { path: '/proposals/deleted', permission: 'property.delete' },
];

const PAGE_PERMISSIONS: readonly { path: string; permission: PagePermission }[] = [
  ...NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) =>
      item.href && !item.planned ? [{ path: pathOf(item.href), permission: item.permission }] : [],
    ),
  ),
  ...OTHER_PAGES,
];

/**
 * The permission needed to open a page: that of the nav link or other page with the longest
 * path that is the page or one of its parents (so /proposals/{id} needs property.view and
 * /proposals/new needs property.create). Null for pages open to every signed-in user, such as
 * /profile.
 */
export function pagePermission(pathname: string): PagePermission | null {
  let match: { path: string; permission: PagePermission } | null = null;
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
