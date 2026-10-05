'use client';

import { OccupancyListResponseSchema, type Occupancy } from '@property-erp/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { OccupancyDetailSheet } from '@/components/occupancy/occupancy-detail-sheet';
import { PageHeader } from '@/components/page-header';
import {
  EmptyState,
  ErrorState,
  MasterNotActiveState,
  TableLoadingRows,
  isMasterNotActive,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiFetch } from '@/lib/api-client';
import { displayRate, riskTypeLabel } from '@/lib/display';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 50;
const COLUMNS = 6;

export function OccupancyView() {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const [selected, setSelected] = useState<Occupancy | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const occupancies = useInfiniteQuery({
    queryKey: queryKeys.occupancies(q),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`masters/occupancies?${params.toString()}`, {
        schema: OccupancyListResponseSchema,
        signal,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const items = occupancies.data?.pages.flatMap((page) => page.items) ?? [];

  function openDetail(occupancy: Occupancy) {
    setSelected(occupancy);
    setDetailOpen(true);
  }

  let body;
  if (occupancies.isPending) {
    body = <TableLoadingRows columns={COLUMNS} />;
  } else if (occupancies.isError && items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          {isMasterNotActive(occupancies.error) ? (
            <MasterNotActiveState />
          ) : (
            <ErrorState error={occupancies.error} onRetry={() => void occupancies.refetch()} />
          )}
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState
            title={q ? `No occupancies match “${q}”` : 'No occupancies in the active master'}
            description={
              q
                ? 'Search by the start of a TAC code (2001) or by words in the description (abrasive).'
                : undefined
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((occupancy) => (
      <TableRow key={occupancy.id} className="cursor-pointer" onClick={() => openDetail(occupancy)}>
        <TableCell className="font-medium">
          <button
            type="button"
            className="tabular rounded-sm text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              openDetail(occupancy);
            }}
            aria-label={`View details for ${occupancy.tacCode} ${occupancy.description}`}
          >
            {occupancy.tacCode}
          </button>
        </TableCell>
        <TableCell className="max-w-md">
          <span className="line-clamp-2">{occupancy.description}</span>
        </TableCell>
        <TableCell>{occupancy.riskGrade ?? <Badge variant="warning">Blank</Badge>}</TableCell>
        <TableCell className="tabular text-right">
          {occupancy.iibRate ? (
            displayRate(occupancy.iibRate)
          ) : (
            <Badge variant="warning">See note</Badge>
          )}
        </TableCell>
        <TableCell>
          {occupancy.fireRiskType ? (
            riskTypeLabel(occupancy.fireRiskType)
          ) : (
            <Badge variant="warning">Blank</Badge>
          )}
        </TableCell>
        <TableCell className="tabular text-right">{displayRate(occupancy.minStfiRate)}</TableCell>
      </TableRow>
    ));
  }

  return (
    <>
      <PageHeader
        title="Occupancy master"
        description="IIB occupancy codes with rates per mille, from the active master version."
      />

      <div className="mb-4 grid max-w-md gap-2">
        <Label htmlFor={searchId}>Search by code or description</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="For example 2001 or abrasive"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {occupancies.isFetching && !occupancies.isFetchingNextPage
            ? 'Searching…'
            : occupancies.isSuccess
              ? `Showing ${items.length}${occupancies.hasNextPage ? '+' : ''} occupancies`
              : ' '}
        </p>
      </div>

      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">
            Occupancies. Select a code to see every field.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Code</TableHead>
              <TableHead scope="col">Description</TableHead>
              <TableHead scope="col">Risk grade</TableHead>
              <TableHead scope="col" className="text-right">
                IIB rate ‰
              </TableHead>
              <TableHead scope="col">Fire risk type</TableHead>
              <TableHead scope="col" className="text-right">
                Min STFI ‰
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>

      {occupancies.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void occupancies.fetchNextPage()}
            disabled={occupancies.isFetchingNextPage}
          >
            {occupancies.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}

      <OccupancyDetailSheet occupancy={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
