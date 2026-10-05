'use client';

import { hasRole, type Role } from '@property-erp/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, type NavItem } from './nav-items';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visible(item: NavItem, roles: readonly Role[]): boolean {
  return !item.roles || hasRole(roles, ...item.roles);
}

export function SidebarNav({
  roles,
  onNavigate,
}: {
  roles: readonly Role[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, index) => {
        const items = section.items.filter((item) => visible(item, roles));
        if (items.length === 0) return null;
        const headingId = section.title ? `nav-section-${index}` : undefined;
        return (
          <div key={section.title ?? index} className="grid gap-1">
            {section.title ? (
              <h2
                id={headingId}
                className="px-2 text-xs font-semibold tracking-wide text-sidebar-muted uppercase"
              >
                {section.title}
              </h2>
            ) : null}
            <ul aria-labelledby={headingId} className="grid gap-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                if (!item.href || item.planned) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-3 rounded-md px-2 py-2 text-sidebar-muted"
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded border border-sidebar-muted/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                          Planned
                        </span>
                      </span>
                    </li>
                  );
                }
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-2 transition-colors outline-none',
                        'hover:bg-sidebar-active focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                        active
                          ? 'bg-sidebar-active font-medium text-primary-foreground shadow-[inset_3px_0_0_var(--accent)]'
                          : 'text-sidebar-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
