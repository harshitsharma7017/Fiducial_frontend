'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { MasterActions } from '@/components/masters/master-actions';
import { PageHeader } from '@/components/page-header';
import { PincodeFormDialog } from '@/components/pincodes/pincode-form-dialog';
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
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { displayRate } from '@/lib/display';
import { queryKeys } from '@/lib/query-keys';
import { EQ_ZONE_LABELS, PincodeListResponseSchema } from '@/shared';

const PAGE_SIZE = 100;

/** Every pincode of the active master, searchable, with add and edit for Admins. */
export function PincodeView() {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const canManage = usePermission('masters.manage');
  const columns = canManage ? 8 : 7;

  const pincodes = useInfiniteQuery({
    queryKey: queryKeys.pincodes(q),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`masters/pincodes?${params.toString()}`, {
        schema: PincodeListResponseSchema,
        signal,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const items = pincodes.data?.pages.flatMap((page) => page.items) ?? [];

  let body;
  if (pincodes.isPending) body = <TableLoadingRows columns={columns} />;
  else if (pincodes.isError && items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columns} className="p-4">
          {isMasterNotActive(pincodes.error) ? (
            <MasterNotActiveState />
          ) : (
            <ErrorState error={pincodes.error} onRetry={() => void pincodes.refetch()} />
          )}
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columns}>
          <EmptyState
            title={q ? `No pincodes match “${q}”` : 'No pincodes in the active master'}
            description="Search by the start of a pincode (4000) or by district or state (Pune)."
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((record) => (
      <TableRow key={record.id}>
        <TableCell className="tabular font-medium">{record.pincode}</TableCell>
        <TableCell>{record.district || <Badge variant="warning">Blank</Badge>}</TableCell>
        <TableCell>{record.state || <Badge variant="warning">Blank</Badge>}</TableCell>
        <TableCell className="whitespace-nowrap">
          {record.eqZone ? EQ_ZONE_LABELS[record.eqZone] : <Badge variant="warning">Not set</Badge>}
        </TableCell>
        <TableCell className="tabular text-right">
          {displayRate(record.eqRates.residential)}
        </TableCell>
        <TableCell className="tabular text-right">
          {displayRate(record.eqRates.nonIndustrial)}
        </TableCell>
        <TableCell className="tabular text-right">
          {displayRate(record.eqRates.industrial)}
        </TableCell>
        {canManage ? (
          <TableCell className="text-right">
            <PincodeFormDialog
              record={record}
              trigger={
                <Button variant="ghost" size="sm" aria-label={`Edit pincode ${record.pincode}`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              }
            />
          </TableCell>
        ) : null}
      </TableRow>
    ));
  }

  return (
    <>
      <PageHeader
        title="Pincodes"
        description="Every pincode in the active master, with its earthquake zone and EQ rates per mille."
        actions={
          <MasterActions>
            <PincodeFormDialog
              trigger={
                <Button variant="outline">
                  <Plus aria-hidden="true" />
                  Add pincode
                </Button>
              }
            />
          </MasterActions>
        }
      />

      <div className="mb-4 grid max-w-md gap-2">
        <Label htmlFor={searchId}>Search by pincode, district or state</Label>
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
            placeholder="For example 400001, 4000 or Pune"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pincodes.isFetching && !pincodes.isFetchingNextPage
            ? 'Searching…'
            : pincodes.isSuccess
              ? `Showing ${items.length.toLocaleString('en-IN')}${pincodes.hasNextPage ? '+' : ''} pincodes`
              : ' '}
        </p>
      </div>

      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">Pincodes in order</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Pincode</TableHead>
              <TableHead scope="col">District</TableHead>
              <TableHead scope="col">State</TableHead>
              <TableHead scope="col">EQ zone</TableHead>
              <TableHead scope="col" className="text-right">
                Residential ‰
              </TableHead>
              <TableHead scope="col" className="text-right">
                Non-industrial ‰
              </TableHead>
              <TableHead scope="col" className="text-right">
                Industrial ‰
              </TableHead>
              {canManage ? (
                <TableHead scope="col" className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>

      {pincodes.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void pincodes.fetchNextPage()}
            disabled={pincodes.isFetchingNextPage}
          >
            {pincodes.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}
