import {
  Briefcase,
  Building,
  FileText,
  Flame,
  LayoutDashboard,
  MapPin,
  Scale,
  Send,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/shared';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Omitted for planned features, which show as disabled. */
  href?: string;
  planned?: boolean;
  /** When set, only users with one of these roles (or ADMIN) see the item. */
  roles?: Role[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }] },
  {
    title: 'Masters',
    items: [
      { label: 'Occupancy', href: '/masters/occupancy', icon: Building },
      { label: 'Pincodes', href: '/masters/pincodes', icon: MapPin },
    ],
  },
  { title: 'Rating', items: [{ label: 'Fire rate check', href: '/rating/fire', icon: Flame }] },
  {
    title: 'Placement',
    items: [
      { label: 'Clients', icon: Briefcase, planned: true },
      { label: 'Risks', icon: ShieldCheck, planned: true },
      { label: 'RFQ', icon: Send, planned: true },
      { label: 'QCR', icon: Scale, planned: true },
      { label: 'Placement Slips', icon: FileText, planned: true },
    ],
  },
  {
    title: 'Administration',
    items: [{ label: 'Users', href: '/users', icon: UserCog, roles: ['ADMIN'] }],
  },
];
