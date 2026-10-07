'use client';

import { useMutation } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { errorMessage } from '@/components/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { MAX_PROPOSAL_INSURERS, ProposalRecordSchema, type ProposalRecord } from '@/shared';
import { ChooseInsurersDialog } from './choose-insurers-dialog';
import { InsurerRow, type RowPermissions } from './insurer-row';
import { useSaveRecord } from './use-rfq';

/** The case's insurers, each with where the RFQ stands and what can be done next. */
export function InsurersCard({
  record,
  permissions,
}: {
  record: ProposalRecord;
  permissions: RowPermissions;
}) {
  const { canEdit, canSend } = permissions;
  const saveRecord = useSaveRecord();
  const remove = useMutation({
    mutationFn: (insurerId: string) =>
      apiFetch(`proposals/${record.id}/insurers`, {
        method: 'PUT',
        body: {
          insurerIds: record.insurers
            .map((insurer) => insurer.insurerId)
            .filter((id) => id !== insurerId),
        },
        schema: ProposalRecordSchema,
      }),
    onSuccess: saveRecord,
    onError: (error) =>
      toast({
        title: 'Could not remove',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Insurers</CardTitle>
          <CardDescription>
            Up to {MAX_PROPOSAL_INSURERS} active insurers from the insurer master. The RFQ goes to
            each branch’s RFQ email addresses, and to its contacts when you tick them.
          </CardDescription>
        </div>
        {canEdit && record.stage !== 'CLOSED' ? <ChooseInsurersDialog record={record} /> : null}
      </CardHeader>
      <CardContent>
        {record.insurers.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-md border border-dashed p-6 text-center">
            <Users className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No insurers chosen yet</p>
            <p className="text-sm text-muted-foreground">
              {canEdit
                ? 'Choose the insurers to ask for quotes.'
                : 'A Relationship Manager or the placement team chooses them.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Insurers" tabIndex={0}>
            <Table>
              <TableCaption className="sr-only">Insurers on this proposal</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Insurer</TableHead>
                  <TableHead>RFQ email addresses</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit || canSend ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.insurers.map((insurer) => (
                  <InsurerRow
                    key={insurer.insurerId}
                    record={record}
                    insurer={insurer}
                    permissions={permissions}
                    removing={remove.isPending}
                    onRemove={() => remove.mutate(insurer.insurerId)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
