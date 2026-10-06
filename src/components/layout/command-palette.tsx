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
import type { Role } from '@/shared';
import { CommandProposals } from './command-proposals';
import { NAV_GROUPS, visibleGroups, type NavItem } from './nav-config';

interface PageEntry {
  label: string;
  group: string;
  href: string;
  icon: NavItem['icon'];
}

/** The navigable sidebar items the user may see; planned items are left out. */
function pageEntries(roles: readonly Role[] | undefined): PageEntry[] {
  const groups = roles ? visibleGroups(roles) : NAV_GROUPS.filter((group) => !group.roles);
  return groups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.href && !item.planned
        ? [{ label: item.label, group: group.title, href: item.href, icon: item.icon }]
        : [],
    ),
  );
}

/**
 * The command palette (⌘K or Ctrl+K): page navigation, and proposal search from task 4.14. It
 * returns focus to the element that had it before opening; there is no Radix trigger to do it.
 */
export function CommandPalette({
  open,
  onOpenChange,
  roles,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: readonly Role[] | undefined;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const pages = pageEntries(roles).filter(
    (page) => needle === '' || page.label.toLowerCase().includes(needle),
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
      description="Go to a page or find a proposal by reference or client."
      commandProps={{ shouldFilter: false, label: 'Search pages and proposals' }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocusRef.current?.focus();
      }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages and proposals…"
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
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
        <CommandProposals query={query} onOpen={(id) => go(`/proposals/${id}`)} />
      </CommandList>
    </CommandDialog>
  );
}
