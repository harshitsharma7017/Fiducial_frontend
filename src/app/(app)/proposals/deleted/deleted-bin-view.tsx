'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, LoaderCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StageBadge, TypeBadge } from '@/components/proposals/badges';
import { EmptyState, ErrorState, TableLoadingRows, errorMessage } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  ProposalListResponseSchema,
  ProposalRecordSchema,
  formatDateTime,
  type ProposalRecord,
} from '@/shared';

const COLUMNS = 5;

/**
 * The Deleted bin (Admins, property.delete): the cases moved there, newest first, each with who
 * deleted it and when, and Restore to bring it back as it was.
 */
export function DeletedBinView() {
  const bin = useQuery({
    queryKey: ['proposals', 'deleted'],
    queryFn: () =>
      apiFetch('proposals?deleted=true&limit=100', { schema: ProposalListResponseSchema }),
  });
  const items = bin.data?.items ?? [];

  let body;
  if (bin.isPending) body = <TableLoadingRows columns={COLUMNS} />;
  else if (bin.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          <ErrorState error={bin.error} onRetry={() => void bin.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState
            title="The Deleted bin is empty"
            description="Cases deleted from the Proposals, RFQ, Quotes and QCR or Placement Slips lists come here."
          />
        </TableCell>
      </TableRow>
    );
  } else body = items.map((record) => <BinRow key={record.id} record={record} />);

  return (
    <>
      <PageHeader
        title="Deleted bin"
        description="Deleted cases, kept with all their work. Restore one to bring it back to every list as it was."
      />
      <Card className="gap-0 py-0">
        <Table>
          <TableCaption className="sr-only">Deleted cases, newest first</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead className="w-32">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>
    </>
  );
}

function BinRow({ record }: { record: ProposalRecord }) {
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/restore`, { method: 'POST', schema: ProposalRecordSchema }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({
        title: `${saved.reference} restored`,
        description: 'It is back on every list, as it was.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: `${record.reference} could not be restored`,
        description: errorMessage(error),
        variant: 'destructive',
      });
    },
  });
  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap tabular">
        {record.reference}
        <span className="ml-2 inline-block">
          <TypeBadge type={record.type} />
        </span>
      </TableCell>
      <TableCell>
        <span className="font-medium">{record.client.name}</span>
        <span className="block text-xs text-muted-foreground">
          {record.client.city || record.client.state}
        </span>
      </TableCell>
      <TableCell>
        <StageBadge stage={record.stage} />
      </TableCell>
      <TableCell>
        {record.deleted ? (
          <>
            <span className="tabular">{formatDateTime(record.deleted.at)}</span>
            <span className="block text-xs text-muted-foreground">by {record.deleted.by}</span>
          </>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={restore.isPending}
          aria-label={`Restore ${record.reference}`}
          onClick={() => restore.mutate()}
        >
          {restore.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <ArchiveRestore aria-hidden="true" />
          )}
          Restore
        </Button>
      </TableCell>
    </TableRow>
  );
}
