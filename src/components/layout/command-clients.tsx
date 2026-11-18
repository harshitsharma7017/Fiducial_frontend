'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ClientListResponseSchema } from '@/shared';

const MIN_LENGTH = 2;

/** Client search results in the command palette. */
export function CommandClients({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 200);
  const enabled = debounced.length >= MIN_LENGTH;

  const clients = useQuery({
    queryKey: queryKeys.clients.list(debounced),
    queryFn: ({ signal }) =>
      apiFetch(`clients?limit=6&q=${encodeURIComponent(debounced)}`, {
        schema: ClientListResponseSchema,
        signal,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  if (trimmed.length < MIN_LENGTH) return null;

  const loading = !enabled || (clients.isPending && clients.fetchStatus !== 'idle');
  const items = enabled ? (clients.data?.items ?? []) : [];

  if (!loading && items.length === 0) return null;

  return (
    <CommandGroup heading="Clients">
      {loading ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Searching clients…</p>
      ) : clients.isError ? (
        <p className="px-2 py-2 text-sm text-destructive">Could not search clients.</p>
      ) : (
        items.map((client) => (
          <CommandItem
            key={client.id}
            value={`client-${client.id}`}
            onSelect={() => onOpen(client.id)}
          >
            <BriefcaseBusiness aria-hidden="true" />
            <span className="font-medium truncate">{client.name}</span>
            {client.gstin ? (
              <span className="tabular text-xs text-muted-foreground">{client.gstin}</span>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">{client.address.city}</span>
          </CommandItem>
        ))
      )}
    </CommandGroup>
  );
}
