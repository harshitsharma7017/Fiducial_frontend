'use client';

import { Search } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// The frame of the cross-case lists (Quotes and QCR, Placement Slips): status chips with counts,
// a search box and a table with its loading, error and empty states.

export function StatusChip({
  label,
  count,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${label} (${count})`}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed ? 'border-primary bg-primary-soft text-primary' : 'bg-card hover:bg-muted',
      )}
    >
      {label}
      <span
        aria-hidden="true"
        className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular"
      >
        {count}
      </span>
    </button>
  );
}

export function WorklistTable({
  caption,
  headers,
  search,
  onSearch,
  placeholder,
  state,
  rows,
  empty,
  count,
  noun,
}: {
  caption: string;
  headers: readonly { label: string; className?: string }[];
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  state: { pending: boolean; error: unknown; retry: () => void };
  rows: ReactNode[];
  empty: { title: string; description?: string };
  count: number;
  noun: [one: string, many: string];
}) {
  const searchId = useId();
  let body: ReactNode;
  if (state.pending) body = <TableLoadingRows columns={headers.length} />;
  else if (state.error) {
    body = (
      <TableRow>
        <TableCell colSpan={headers.length} className="p-4">
          <ErrorState error={state.error} onRetry={state.retry} />
        </TableCell>
      </TableRow>
    );
  } else if (rows.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={headers.length}>
          <EmptyState title={empty.title} description={empty.description} />
        </TableCell>
      </TableRow>
    );
  } else body = rows;

  return (
    <Card className="gap-0 py-0">
      <div className="grid max-w-md gap-2 p-4">
        <Label htmlFor={searchId}>Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className="pl-9"
            autoComplete="off"
          />
        </div>
      </div>
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header.label} className={header.className}>
                {header.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {!state.pending && !state.error && rows.length > 0 ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground tabular">
          {count} {count === 1 ? noun[0] : noun[1]}
        </p>
      ) : null}
    </Card>
  );
}
