'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, LoaderCircle, RefreshCw, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { formatInr } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import {
  OTHER_SECTION_LABELS,
  PROPOSAL_STAGE_LABELS,
  ProposalRecordSchema,
  formatDate,
  formatDateTime,
  wholeRupees,
  type OtherSection,
  type ProposalRecord,
  type ProposalStage,
} from '@/shared';

function useSaveRecord() {
  const queryClient = useQueryClient();
  return (saved: ProposalRecord) => {
    queryClient.setQueryData(queryKeys.proposals.record(saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: ['proposals'] });
  };
}

/** What moves the case to its next stage when that is recorded on a tab, not set by hand. */
const NEXT_STEP: Partial<Record<ProposalStage, string>> = {
  CLIENT_APPROVAL: 'Next: record the quote the client accepted on the Client approval tab.',
  PLACEMENT_SLIP:
    'Next: approve the placement slip and send it to the insurer (Placement slip tab).',
  PLACED: 'Next: record the policy or cover note on the Placement slip tab.',
};

/**
 * Moves the case to its next stage (from RFQ Sent up to Placed), or closes it with the reason.
 * The stages before follow from the Data Sheet and the RFQ.
 */
export function StageControls({ record }: { record: ProposalRecord }) {
  const saveRecord = useSaveRecord();
  const reasonId = useId();
  const [open, setOpen] = useState<ProposalStage | null>(null);
  const [reason, setReason] = useState('');
  const move = useMutation({
    mutationFn: (body: { stage: ProposalStage; reason: string }) =>
      apiFetch(`proposals/${record.id}/stage`, {
        method: 'POST',
        body,
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      saveRecord(saved);
      setOpen(null);
      toast({
        title:
          saved.stage === 'CLOSED'
            ? 'Case closed'
            : `Moved to ${PROPOSAL_STAGE_LABELS[saved.stage]}`,
        description: saved.reference,
        variant: 'success',
      });
    },
  });
  const closable = record.stage !== 'PLACED' && record.stage !== 'CLOSED';
  if (!record.nextStage && !closable) return null;

  const dialog = (stage: ProposalStage) => {
    const closing = stage === 'CLOSED';
    return (
      <Dialog
        open={open === stage}
        onOpenChange={(next) => {
          setOpen(next ? stage : null);
          setReason('');
          move.reset();
        }}
      >
        <DialogTrigger asChild>
          {closing ? (
            <Button variant="outline" size="sm">
              <XCircle aria-hidden="true" />
              Close case
            </Button>
          ) : (
            <Button size="sm">
              <ArrowRight aria-hidden="true" />
              Move to {PROPOSAL_STAGE_LABELS[stage]}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closing ? 'Close this case?' : `Move to ${PROPOSAL_STAGE_LABELS[stage]}?`}
            </DialogTitle>
            <DialogDescription>
              {closing
                ? 'For a case that is lost or will not be renewed. The Data Sheet locks, and the case leaves the open pipeline.'
                : `The case moves from ${PROPOSAL_STAGE_LABELS[record.stage]} to ${PROPOSAL_STAGE_LABELS[stage]}. This is recorded with your name.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={reasonId}>{closing ? 'Reason' : 'Note (optional)'}</Label>
            <Textarea
              id={reasonId}
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {move.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(move.error)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={closing ? 'destructive' : 'default'}
              disabled={move.isPending || (closing && !reason.trim())}
              onClick={() => move.mutate({ stage, reason })}
            >
              {move.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {closing ? 'Close case' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* The last stages follow the work recorded on their tabs. */}
      {record.nextStage && NEXT_STEP[record.nextStage] ? (
        <p className="text-sm text-muted-foreground">{NEXT_STEP[record.nextStage]}</p>
      ) : record.nextStage ? (
        dialog(record.nextStage)
      ) : null}
      {closable ? dialog('CLOSED') : null}
    </div>
  );
}

const sectionName = (code: string) =>
  code === 'FIRE' ? 'Fire & Allied Perils' : (OTHER_SECTION_LABELS[code as OtherSection] ?? code);
const rupees = (value: string | null) => (value === null ? '—' : formatInr(wholeRupees(value)));

/**
 * A renewal's last-year policy, as copied from the policy software (D-2): insurer, policy number,
 * period, and sum insured and premium per section. It can be fetched again until the RFQ goes out.
 */
export function ExistingPolicyCard({
  record,
  canEdit,
}: {
  record: ProposalRecord;
  canEdit: boolean;
}) {
  const saveRecord = useSaveRecord();
  const refetch = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/existing-policy`, {
        method: 'POST',
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      saveRecord(saved);
      toast(
        saved.existingPolicyLookup?.status === 'FOUND'
          ? {
              title: 'Last year’s policy copied',
              description: saved.existingPolicy?.policyNumber,
              variant: 'success',
            }
          : {
              title: 'Not found',
              description: saved.existingPolicyLookup?.message ?? undefined,
              variant: 'destructive',
            },
      );
    },
    onError: (error) =>
      toast({ title: 'Could not fetch', description: errorMessage(error), variant: 'destructive' }),
  });
  const policy = record.existingPolicy;
  const lookup = record.existingPolicyLookup;
  const fetchButton =
    canEdit && !record.locked ? (
      <Button
        variant="outline"
        size="sm"
        disabled={refetch.isPending}
        onClick={() => refetch.mutate()}
      >
        {refetch.isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
        Fetch again
      </Button>
    ) : null;

  if (!policy) {
    return (
      <Alert variant="warning">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Last year’s policy is not on this renewal</AlertTitle>
        <AlertDescription className="grid gap-2">
          <span>
            {lookup?.message ?? 'It has not been fetched yet.'}
            {lookup ? ` (checked ${formatDateTime(lookup.checkedAt)})` : ''}
          </span>
          {fetchButton ? <span>{fetchButton}</span> : null}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Existing policy</CardTitle>
          <CardDescription>
            {policy.policyNumber} with {policy.insurer}
            {policy.periodStart && policy.periodEnd
              ? ` · ${formatDate(policy.periodStart)} – ${formatDate(policy.periodEnd)}`
              : ''}
            {policy.product ? ` · ${policy.product}` : ''}
            <br />
            Copied from {policy.source} on {formatDateTime(policy.fetchedAt)}
          </CardDescription>
        </div>
        {fetchButton}
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption className="sr-only">
            Last year’s sum insured and premium by section
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Sum insured</TableHead>
              <TableHead className="text-right">Premium</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policy.sections.map((section) => (
              <TableRow key={section.code}>
                <TableCell>{sectionName(section.code)}</TableCell>
                <TableCell className="text-right tabular">{rupees(section.sumInsured)}</TableCell>
                <TableCell className="text-right tabular">{rupees(section.premium)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium tabular">
                {rupees(policy.totalSumInsured)}
              </TableCell>
              <TableCell className="text-right font-medium tabular">
                {rupees(policy.netPremium)}
                {policy.totalPremium ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {policy.gst ? `+ GST ${rupees(policy.gst)} = ` : 'With GST '}
                    {rupees(policy.totalPremium)}
                  </span>
                ) : null}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
