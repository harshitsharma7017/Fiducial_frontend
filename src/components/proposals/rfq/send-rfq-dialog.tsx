'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, Mail } from 'lucide-react';
import { useId, useState } from 'react';
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
import {
  SendMailResponseSchema,
  type MailAttachmentFormat,
  type ProposalInsurer,
  type ProposalRecord,
  type RfqRecipient,
  type SendResult,
} from '@/shared';
import { MailPreviews } from './mail-previews';
import { RecipientChoice, initialPicks, type Picks } from './recipient-choice';
import { defaultDueDate } from './mark-sent-dialog';
import { SendResults } from './send-results';
import { isMailDisabled, newSendId, useMarkMailOff, useSaveRecord } from './use-rfq';

/**
 * E-3: emails the RFQ, one mail per chosen insurer to its ticked addresses only, with the RFQ
 * attached and a quote due date. A send id is made when the dialog opens, and a new one for each
 * "Try again", so a double click never mails an insurer twice.
 */
export function SendRfqDialog({
  record,
  insurers,
}: {
  record: ProposalRecord;
  insurers: ProposalInsurer[];
}) {
  const ids = { due: useId(), format: useId() };
  const saveRecord = useSaveRecord();
  const markMailOff = useMarkMailOff();
  const [open, setOpen] = useState(false);
  const [sendId, setSendId] = useState('');
  const [today, setToday] = useState('');
  const [dueDate, setDueDate] = useState(record.dueDate);
  const [format, setFormat] = useState<MailAttachmentFormat>('xlsx');
  const [picks, setPicks] = useState<Picks>({});
  const [results, setResults] = useState<SendResult[] | null>(null);

  const chosen: RfqRecipient[] = insurers.flatMap((insurer) => {
    const pick = picks[insurer.insurerId];
    return pick?.chosen ? [{ insurerId: insurer.insurerId, to: pick.to }] : [];
  });
  const missingAddress = chosen.some((entry) => entry.to.length === 0);
  const pastDue = today !== '' && dueDate < today;

  const send = useMutation({
    mutationFn: (input: { sendId: string; insurers: RfqRecipient[] }) =>
      apiFetch(`proposals/${record.id}/rfq/email`, {
        method: 'POST',
        body: { ...input, dueDate, format },
        schema: SendMailResponseSchema,
      }),
    onSuccess: (response) => {
      saveRecord(response.proposal);
      setResults((current) => {
        const byInsurer = new Map((current ?? []).map((result) => [result.insurerId, result]));
        for (const result of response.results) byInsurer.set(result.insurerId, result);
        return [...byInsurer.values()];
      });
      const sentCount = response.results.filter((result) => result.outcome === 'SENT').length;
      if (sentCount > 0) {
        toast({
          title: `RFQ emailed to ${sentCount} ${sentCount === 1 ? 'insurer' : 'insurers'}`,
          variant: 'success',
        });
      }
    },
  });

  const retry = (insurerId: string) => {
    const to = picks[insurerId]?.to ?? [];
    send.mutate({ sendId: newSendId(), insurers: [{ insurerId, to }] });
  };

  // Mail being off is remembered on closing, so the message stays readable until then.
  const close = () => {
    if (isMailDisabled(send.error)) markMailOff();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const now = todayIst();
          setToday(now);
          setDueDate(defaultDueDate(record, now));
          setFormat('xlsx');
          setPicks(initialPicks(insurers));
          setResults(null);
          setSendId(newSendId());
          send.reset();
        }
        if (!next) {
          close();
          return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <Mail aria-hidden="true" />
          Email the RFQ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Email the RFQ</DialogTitle>
          <DialogDescription>
            Each insurer gets its own mail, to the addresses you tick, with the RFQ attached. No
            insurer sees another’s address.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <SendResults
            results={results}
            onRetry={retry}
            retrying={send.isPending ? (send.variables.insurers[0]?.insurerId ?? null) : null}
          />
        ) : (
          <div className="grid gap-5">
            <RecipientChoice insurers={insurers} picks={picks} onChange={setPicks} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={ids.due}>Quotes due by</Label>
                <Input
                  id={ids.due}
                  type="date"
                  value={dueDate}
                  min={today || undefined}
                  aria-invalid={pastDue || undefined}
                  onChange={(event) => setDueDate(event.target.value)}
                />
                {pastDue ? (
                  <p className="text-sm text-destructive">The due date cannot be before today.</p>
                ) : null}
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="text-sm font-medium">Attach the RFQ as</legend>
                <div className="flex gap-4 pt-1.5">
                  {(['xlsx', 'pdf'] as const).map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={ids.format}
                        value={value}
                        checked={format === value}
                        onChange={() => setFormat(value)}
                        className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {value === 'xlsx' ? 'Excel' : 'PDF'}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <section aria-label="Preview" className="grid gap-2">
              <h3 className="text-sm font-medium">Preview</h3>
              {missingAddress || pastDue ? (
                <p className="text-sm text-muted-foreground">
                  Fix the choices above to see the mails.
                </p>
              ) : (
                <MailPreviews
                  proposalId={record.id}
                  insurers={chosen}
                  dueDate={dueDate}
                  format={format}
                />
              )}
            </section>
          </div>
        )}

        {send.isError ? (
          <Alert variant="destructive" role="alert">
            {isMailDisabled(send.error) ? <AlertTitle>Mail is turned off</AlertTitle> : null}
            <AlertDescription>{errorMessage(send.error)}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {results ? null : (
            <Button
              type="button"
              disabled={send.isPending || chosen.length === 0 || missingAddress || pastDue}
              onClick={() => send.mutate({ sendId, insurers: chosen })}
            >
              {send.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Send to {chosen.length} {chosen.length === 1 ? 'insurer' : 'insurers'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
