'use client';

import { useRouter } from 'next/navigation';
import { useState, type RefObject } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { Permission } from '@/shared';
import { CommandClients } from './command-clients';
import { CommandInsurers } from './command-insurers';
import { CommandPolicies } from './command-policies';
import { CommandProposals } from './command-proposals';
import { allows, visibleGroups, type NavItem } from './nav-config';

interface PageEntry {
  label: string;
  group: string;
  href: string;
  icon: NavItem['icon'];
}

/** The navigable sidebar items the user may see; planned items are left out. */
function pageEntries(permissions: readonly Permission[] | undefined): PageEntry[] {
  return visibleGroups(permissions).flatMap((group) =>
    group.items.flatMap((item) =>
      item.href && !item.planned
        ? [{ label: item.label, group: group.title, href: item.href, icon: item.icon }]
        : [],
    ),
  );
}

/**
 * Global ERP command palette (⌘K or Ctrl+K):
 * Supports searching across pages, proposals, clients, insurers, policies and other records.
 * Respects RBAC permissions and enables free-text querying.
 */
export function CommandPalette({
  open,
  onOpenChange,
  permissions,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: readonly Permission[] | undefined;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const canViewProposals = Boolean(permissions && allows(permissions, 'property.view'));
  const canViewClients = Boolean(permissions && allows(permissions, 'clients.view'));
  const canViewInsurers = Boolean(permissions && allows(permissions, 'insurers.view'));
  const canViewPolicies = Boolean(permissions && allows(permissions, 'catalog.view'));

  const pages =
    needle === ''
      ? []
      : pageEntries(permissions).filter(
          (page) =>
            page.label.toLowerCase().includes(needle) || page.group.toLowerCase().includes(needle),
        );

  function changeOpen(next: boolean) {
    if (!next) setQuery('');
    onOpenChange(next);
  }

  function go(href: string) {
    changeOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      title="Search"
      description="Search across pages, proposals, clients, insurers and policies."
      commandProps={{ shouldFilter: false, label: 'Search across ERP' }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocusRef.current?.focus();
      }}
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages, proposals, clients, insurers, policies…"
      />
      <CommandList>
        {needle === '' ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Type to search across pages, proposals, clients, insurers and policies…
          </p>
        ) : (
          <>
            <CommandEmpty>No results found for &ldquo;{query.trim()}&rdquo;.</CommandEmpty>
            {pages.length > 0 ? (
              <CommandGroup heading="Pages">
                {pages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <CommandItem key={page.href} value={page.href} onSelect={() => go(page.href)}>
                      <Icon aria-hidden="true" />
                      <span>{page.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{page.group}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {canViewProposals ? (
              <CommandProposals query={query} onOpen={(id) => go(`/proposals/${id}`)} />
            ) : null}
            {canViewClients ? (
              <CommandClients query={query} onOpen={(id) => go(`/masters/clients/${id}`)} />
            ) : null}
            {canViewInsurers ? (
              <CommandInsurers query={query} onOpen={() => go('/masters/insurers')} />
            ) : null}
            {canViewPolicies ? (
              <CommandPolicies query={query} onOpen={() => go('/masters/products')} />
            ) : null}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
