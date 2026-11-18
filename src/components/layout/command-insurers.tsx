'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { InsurerListResponseSchema } from '@/shared';

const MIN_LENGTH = 2;

/** Insurer search results in the command palette. */
export function CommandInsurers({ query, onOpen }: { query: string; onOpen: () => void }) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 200);
  const enabled = debounced.length >= MIN_LENGTH;

  const insurers = useQuery({
    queryKey: queryKeys.insurers.list({ q: debounced }),
    queryFn: ({ signal }) =>
      apiFetch(`insurers?limit=6&q=${encodeURIComponent(debounced)}`, {
        schema: InsurerListResponseSchema,
        signal,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  if (trimmed.length < MIN_LENGTH) return null;

  const loading = !enabled || (insurers.isPending && insurers.fetchStatus !== 'idle');
  const items = enabled ? (insurers.data?.items ?? []) : [];

  if (!loading && items.length === 0) return null;

  return (
    <CommandGroup heading="Insurers">
      {loading ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Searching insurers…</p>
      ) : insurers.isError ? (
        <p className="px-2 py-2 text-sm text-destructive">Could not search insurers.</p>
      ) : (
        items.map((insurer) => (
          <CommandItem key={insurer.id} value={`insurer-${insurer.id}`} onSelect={() => onOpen()}>
            <Landmark aria-hidden="true" />
            <span className="font-medium truncate">{insurer.company}</span>
            <span className="text-xs text-muted-foreground">{insurer.branch}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {insurer.active ? 'Active' : 'Inactive'}
            </span>
          </CommandItem>
        ))
      )}
    </CommandGroup>
  );
}
