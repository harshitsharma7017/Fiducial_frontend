'use client';

import { FileText } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useProposals } from '@/lib/api/proposals';
import { STAGE_LABELS } from '@/types/proposal';

const MIN_LENGTH = 2;

/** Proposal results in the command palette: shown once the query has 2+ characters. */
export function CommandProposals({
  query,
  onOpen,
}: {
  query: string;
  onOpen: (id: string) => void;
}) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 200);
  const enabled = debounced.length >= MIN_LENGTH;
  const proposals = useProposals(enabled ? { q: debounced, pageSize: 6 } : {});

  if (trimmed.length < MIN_LENGTH) return null;

  // While the debounce catches up, keep showing "Searching".
  const loading = !enabled || (proposals.isPending && proposals.fetchStatus !== 'idle');
  const items = enabled ? (proposals.data?.items ?? []) : [];

  return (
    <CommandGroup heading="Proposals">
      {loading ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Searching…</p>
      ) : proposals.isError ? (
        <p className="px-2 py-2 text-sm text-destructive">Could not search proposals.</p>
      ) : items.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">No proposals match.</p>
      ) : (
        items.map((item) => (
          <CommandItem key={item.id} value={`proposal-${item.id}`} onSelect={() => onOpen(item.id)}>
            <FileText aria-hidden="true" />
            <span className="tabular">{item.reference}</span>
            <span className="truncate">{item.client.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {STAGE_LABELS[item.stage]}
            </span>
          </CommandItem>
        ))
      )}
    </CommandGroup>
  );
}
