'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus } from 'lucide-react';
import { LocationFormDialog } from '@/components/clients/location-form-dialog';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ClientLocationListResponseSchema, EQ_ZONE_LABELS, type Client } from '@/shared';

const PAGE_SIZE = 50;

/** A client's risk locations, in the order they were added, with add and edit for managers. */
export function LocationsCard({ client, canManage }: { client: Client; canManage: boolean }) {
  const columns = canManage ? 6 : 5;
  const locations = useInfiniteQuery({
    queryKey: queryKeys.clients.locations(client.id),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`clients/${client.id}/locations?${params.toString()}`, {
        schema: ClientLocationListResponseSchema,
        signal,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = locations.data?.pages.flatMap((page) => page.items) ?? [];

  const addButton = (
    <Button size="sm">
      <Plus aria-hidden="true" />
      Add location
    </Button>
  );

  let body;
  if (locations.isPending) body = <TableLoadingRows columns={columns} rows={3} />;
  else if (locations.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={columns} className="p-4">
          <ErrorState error={locations.error} onRetry={() => void locations.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columns}>
          <EmptyState
            title="No risk locations yet"
            description={
              canManage ? (
                <div className="grid justify-items-center gap-3">
                  <span>Add each site to be insured. The pincode sets its earthquake zone.</span>
                  <LocationFormDialog client={client} trigger={addButton} />
                </div>
              ) : undefined
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((location) => (
      <TableRow key={location.id}>
        <TableCell className="font-medium">{location.name}</TableCell>
        <TableCell className="max-w-xs">
          <span className="grid">
            <span>{location.address.line1}</span>
            {location.address.line2 ? <span>{location.address.line2}</span> : null}
            <span>{location.address.city}</span>
          </span>
        </TableCell>
        <TableCell>
          <span className="tabular">{location.address.pincode}</span>
          <span className="block text-xs text-muted-foreground">
            {location.district || '—'}, {location.address.state || '—'}
          </span>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {location.eqZone ? (
            EQ_ZONE_LABELS[location.eqZone]
          ) : (
            <Badge variant="warning">Not set</Badge>
          )}
        </TableCell>
        <TableCell className="max-w-xs">
          {location.occupancy ? (
            <span className="line-clamp-2">
              <span className="tabular">{location.occupancy.tacCode}</span> —{' '}
              {location.occupancy.description}
            </span>
          ) : (
            <span className="text-muted-foreground">Client&apos;s</span>
          )}
        </TableCell>
        {canManage ? (
          <TableCell className="text-right">
            <LocationFormDialog
              client={client}
              location={location}
              trigger={
                <Button variant="ghost" size="sm" aria-label={`Edit ${location.name}`}>
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

  // min-w-0: inside a grid the card would otherwise widen to fit the table instead of scrolling it.
  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b py-4">
        <CardTitle>
          Risk locations{' '}
          <span className="tabular font-normal text-muted-foreground">
            ({client.locationCount})
          </span>
        </CardTitle>
        {canManage && items.length > 0 ? (
          <LocationFormDialog client={client} trigger={addButton} />
        ) : null}
      </CardHeader>
      <Table>
        <TableCaption className="sr-only">Risk locations of {client.name}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Location</TableHead>
            <TableHead scope="col">Address</TableHead>
            <TableHead scope="col">Pincode</TableHead>
            <TableHead scope="col">EQ zone</TableHead>
            <TableHead scope="col">Occupancy</TableHead>
            {canManage ? (
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {locations.hasNextPage ? (
        <div className="flex justify-center border-t p-3">
          <Button
            variant="outline"
            onClick={() => void locations.fetchNextPage()}
            disabled={locations.isFetchingNextPage}
          >
            {locations.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
