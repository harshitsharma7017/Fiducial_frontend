'use client';

import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { SortBy } from '@/lib/proposal-metrics';
import { cn } from '@/lib/utils';

export interface SortState {
  by: SortBy;
  dir: 'asc' | 'desc';
}

/** A sortable column header: a button inside the th, with aria-sort on the th. */
export function SortableHead({
  column,
  label,
  sort,
  onSort,
  className,
  numeric,
}: {
  column: SortBy;
  label: string;
  sort: SortState;
  onSort: (column: SortBy) => void;
  className?: string;
  numeric?: boolean;
}) {
  const active = sort.by === column;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <TableHead scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          numeric && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon
          className={cn('size-3.5', active ? 'opacity-100' : 'opacity-50')}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}
