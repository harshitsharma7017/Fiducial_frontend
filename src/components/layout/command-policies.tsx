'use client';

import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { catalogQuery } from '@/lib/api/catalog';
import { productRangeText } from '@/shared';

const MIN_LENGTH = 2;

/** Policy search results in the command palette. */
export function CommandPolicies({ query, onOpen }: { query: string; onOpen: () => void }) {
  const trimmed = query.trim().toLowerCase();
  const products = useQuery(catalogQuery('products'));

  if (trimmed.length < MIN_LENGTH) return null;

  const items = (products.data ?? []).filter(
    (product) =>
      product.name.toLowerCase().includes(trimmed) || product.code.toLowerCase().includes(trimmed),
  );

  if (items.length === 0) return null;

  return (
    <CommandGroup heading="Policies">
      {items.map((product) => (
        <CommandItem key={product.id} value={`policy-${product.id}`} onSelect={() => onOpen()}>
          <Package aria-hidden="true" />
          <span className="font-medium truncate">{product.name}</span>
          <span className="tabular text-xs text-muted-foreground">{product.code}</span>
          <span className="ml-auto text-xs text-muted-foreground">{productRangeText(product)}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
