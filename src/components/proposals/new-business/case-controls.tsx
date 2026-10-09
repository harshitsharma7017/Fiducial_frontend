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
  ProposalRecordSchema,
  formatDate,
  formatDateTime,
  wholeRupees,
  type OtherSection,
  type ProposalRecord,
} from '@/shared';
import { CASE_TAB_LABELS, NEXT_STEP, NEXT_WORK_TAB, type CaseTab } from './case-tabs';

function useSaveRecord() {
  const queryClient = useQueryClient();
  return (saved: ProposalRecord) => {
    queryClient.setQueryData(queryKeys.proposals.record(saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: ['proposals'] });
  };
}

/**
 * The case's next step, with the tab where it is done, and closing the case with the reason. No
 * stage is set by hand: each follows the work recorded on its tab.
 */
export function StageControls({
  record,
  onOpenTab,
}: {
  record: ProposalRecord;
  onOpenTab?: (tab: CaseTab) => void;
}) {
  const saveRecord = useSaveRecord();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const close = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/stage`, {
        method: 'POST',
        body: { stage: 'CLOSED', reason },
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      saveRecord(saved);
      setOpen(false);
      toast({ title: 'Case closed', description: saved.reference, variant: 'success' });
    },
  });
  const closable = record.stage !== 'PLACED' && record.stage !== 'CLOSED';
  const next = record.nextStage ? NEXT_STEP[record.nextStage] : undefined;
  const tab = NEXT_WORK_TAB[record.stage];
  if (!next && !closable) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next ? (
        <>
          <p className="text-sm text-muted-foreground">{next}</p>
          {onOpenTab ? (
            <Button size="sm" variant="outline" onClick={() => onOpenTab(tab)}>
              <ArrowRight aria-hidden="true" />
              Open {CASE_TAB_LABELS[tab]}
            </Button>
          ) : null}
        </>
      ) : null}
      {closable ? (
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            setReason('');
            close.reset();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <XCircle aria-hidden="true" />
              Close case
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close this case?</DialogTitle>
              <DialogDescription>
                For a case that is lost or will not be renewed. The Data Sheet locks, and the case
                leaves the open pipeline.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={reasonId}>Reason</Label>
              <Textarea
                id={reasonId}
                value={reason}
                maxLength={300}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {close.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(close.error)}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={close.isPending || !reason.trim()}
                onClick={() => close.mutate()}
              >
                {close.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Close case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
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
