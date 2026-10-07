'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { BellRing, LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  MailDetailSchema,
  SendMailResponseSchema,
  formatDate,
  type ProposalInsurer,
  type ProposalRecord,
  type SendResult,
} from '@/shared';
import { AddressPicker, addressOptions } from './address-picker';
import { SendResults } from './send-results';
import { isMailDisabled, newSendId, useMarkMailOff, useSaveRecord } from './use-rfq';

/**
 * Reminds one insurer that is Sent or Reminded (requirement 6), with the Reminder template. It
 * starts with the addresses of the insurer's last mail and attaches the RFQ again unless unticked.
 */
export function ReminderDialog({
  record,
  insurer,
}: {
  record: ProposalRecord;
  insurer: ProposalInsurer;
}) {
  const attachId = useId();
  const saveRecord = useSaveRecord();
  const markMailOff = useMarkMailOff();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string[] | null>(null);
  const [attachRfq, setAttachRfq] = useState(true);
  const [sendId, setSendId] = useState('');
  const [result, setResult] = useState<SendResult | null>(null);
  const name = `${insurer.company}, ${insurer.branch}`;
  const lastMailId = insurer.lastMail?.id ?? null;

  // The last mail's To, kept to the addresses still in the insurer master.
  const lastMail = useQuery({
    queryKey: ['proposals', record.id, 'mails', lastMailId],
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${record.id}/mails/${lastMailId ?? ''}`, {
        schema: MailDetailSchema,
        signal,
      }),
    enabled: open && lastMailId !== null,
  });
  const known = new Set(addressOptions(insurer).map((option) => option.email));
  const startingTo = (lastMail.data?.to ?? insurer.rfqEmails).filter((email) => known.has(email));
  const selected = to ?? startingTo;

  const remind = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/insurers/${insurer.insurerId}/reminder`, {
        method: 'POST',
        body: { sendId, to: selected, attachRfq, format: 'xlsx' },
        schema: SendMailResponseSchema,
      }),
    onSuccess: (response) => {
      saveRecord(response.proposal);
      const first = response.results[0] ?? null;
      setResult(first);
      if (first?.outcome === 'SENT') {
        toast({ title: `Reminder emailed to ${name}`, variant: 'success' });
        setOpen(false);
      } else {
        // A failed reminder is tried again with a new send id.
        setSendId(newSendId());
      }
    },
  });

  // Mail being off is remembered on closing, so the message stays readable until then.
  const close = () => {
    if (isMailDisabled(remind.error)) markMailOff();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTo(null);
          setAttachRfq(true);
          setResult(null);
          setSendId(newSendId());
          remind.reset();
        }
        if (!next) {
          close();
          return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Remind ${name}`}>
          <BellRing aria-hidden="true" />
          Remind
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remind {name}</DialogTitle>
          <DialogDescription>
            Sent with the Reminder template
            {insurer.dueDate ? `; quotes were due ${formatDate(insurer.dueDate)}` : ''}.
            {insurer.reminderCount > 0
              ? ` Reminded ${insurer.reminderCount} ${insurer.reminderCount === 1 ? 'time' : 'times'} so far.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <AddressPicker insurer={insurer} selected={selected} onChange={setTo} />
        {selected.length === 0 ? (
          <p className="text-sm text-destructive">Tick at least one address.</p>
        ) : null}
        <div className="flex items-center gap-2">
          <Checkbox
            id={attachId}
            checked={attachRfq}
            onCheckedChange={(value) => setAttachRfq(value === true)}
          />
          <Label htmlFor={attachId} className="font-normal">
            Attach the RFQ (Excel) again
          </Label>
        </div>
        {result && result.outcome !== 'SENT' ? <SendResults results={[result]} /> : null}
        {remind.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(remind.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              remind.isPending ||
              selected.length === 0 ||
              (lastMailId !== null && lastMail.isPending)
            }
            onClick={() => remind.mutate()}
          >
            {remind.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {result?.outcome === 'FAILED' ? 'Try again' : 'Send reminder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
