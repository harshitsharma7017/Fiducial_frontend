'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { todayIst } from '@/lib/dates';
import { ProposalRecordSchema, type ProposalInsurer, type ProposalRecord } from '@/shared';
import { useSaveRecord } from './use-rfq';

/** The case's due date, or today when that has passed. */
export function defaultDueDate(record: ProposalRecord, today: string): string {
  return record.dueDate < today ? today : record.dueDate;
}

/**
 * Records that the RFQ went to these insurers another way (requirement 11): who, when and the
 * quote due date. No mail is logged.
 */
export function MarkSentDialog({
  record,
  insurers,
  disabled,
  outsideApp,
  trigger,
}: {
  record: ProposalRecord;
  insurers: ProposalInsurer[];
  disabled: boolean;
  /** Mail can be sent from the app, so this is the secondary "Sent outside the app". */
  outsideApp: boolean;
  trigger: ReactElement;
}) {
  const dueId = useId();
  const saveRecord = useSaveRecord();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState('');
  const [dueDate, setDueDate] = useState(record.dueDate);
  const mark = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/rfq/sent`, {
        method: 'POST',
        body: { insurerIds: insurers.map((insurer) => insurer.insurerId), dueDate },
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      saveRecord(saved);
      setOpen(false);
      toast({
        title: 'RFQ marked as sent',
        description: `${saved.reference} is now at RFQ Sent.`,
        variant: 'success',
      });
    },
  });
  const title = outsideApp ? 'Sent outside the app?' : 'Mark the RFQ as sent?';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        if (next) {
          const now = todayIst();
          setToday(now);
          setDueDate(defaultDueDate(record, now));
        }
        setOpen(next);
        mark.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Confirm you have sent the RFQ workbook{outsideApp ? ' another way' : ''} to:
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1 text-sm">
          {insurers.map((insurer) => (
            <li key={insurer.insurerId}>
              <span className="font-medium">
                {insurer.company}, {insurer.branch}
              </span>
              <span className="block text-xs break-all text-muted-foreground">
                {insurer.rfqEmails.join(', ')}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1.5">
          <Label htmlFor={dueId}>Quotes due by</Label>
          <Input
            id={dueId}
            type="date"
            value={dueDate}
            min={today || undefined}
            required
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        {record.locked ? null : (
          <Alert variant="warning">
            <AlertTitle>The Data Sheet will lock</AlertTitle>
            <AlertDescription>
              After this the figures cannot change, so every insurer quotes on the same sheet.
            </AlertDescription>
          </Alert>
        )}
        {mark.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(mark.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={mark.isPending || !dueDate} onClick={() => mark.mutate()}>
            {mark.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Mark as sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
