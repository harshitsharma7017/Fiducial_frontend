'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useProposal } from '@/lib/api/proposals';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from './nav-config';

/** The proposal id for a `/proposals/{id}` route (not `/proposals/new`), else null. */
function proposalIdFromPath(pathname: string): string | null {
  const match = /^\/proposals\/([^/]+)$/.exec(pathname);
  if (!match || match[1] === 'new') return null;
  return match[1] ?? null;
}

export interface Crumb {
  label: string;
  /** Ancestors with a page link to it; group names (Masters, Workflow, Admin) have none. */
  href?: string;
}

const FIXED_TRAILS: Readonly<Record<string, Crumb[]>> = {
  '/dashboard': [{ label: 'Dashboard' }],
  '/profile': [{ label: 'Profile' }],
};

/** The breadcrumb trail for a route. The last crumb is the current page. */
export function breadcrumbTrail(
  pathname: string,
  search: URLSearchParams,
  proposalLabel?: string,
): Crumb[] {
  const fixed = FIXED_TRAILS[pathname];
  if (fixed) return fixed;

  const renewal = search.get('type') === 'existing';
  if (pathname === '/proposals') {
    return [{ label: 'Proposals' }, { label: renewal ? 'Existing proposals' : 'New proposals' }];
  }
  if (pathname === '/proposals/new') {
    return [
      { label: 'Proposals', href: `/proposals?type=${renewal ? 'existing' : 'new'}` },
      { label: renewal ? 'Start renewal' : 'New proposal' },
    ];
  }
  if (pathname.startsWith('/proposals/')) {
    return [
      { label: 'Proposals', href: '/proposals?type=new' },
      { label: proposalLabel ?? 'Proposal' },
    ];
  }

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.href || item.activeParam) continue;
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return [{ label: group.title }, { label: item.label }];
      }
    }
  }
  return [];
}

/** Below 640 px only the current page shows. */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  // The proposal's client name becomes the last crumb on a detail route.
  const proposalId = proposalIdFromPath(pathname);
  const proposal = useProposal(proposalId ?? '');
  const proposalLabel = proposalId && proposal.data ? proposal.data.client.name : undefined;
  const trail = breadcrumbTrail(pathname, search, proposalLabel);
  if (trail.length === 0) return <div className={className} />;

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              <BreadcrumbItem className={cn(!last && 'hidden sm:inline-flex')}>
                {last ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
              {last ? null : <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
