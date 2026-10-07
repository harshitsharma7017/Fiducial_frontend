'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, MessageSquareReply } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  INSURER_STATUS_LABELS,
  ProposalRecordSchema,
  RESPONSE_STATUSES,
  canMoveInsurer,
  type ProposalInsurer,
  type ProposalRecord,
  type ResponseStatus,
} from '@/shared';
import { useSaveRecord } from './use-rfq';

const NOTE_MAX = 500;

/**
 * Records an insurer's answer: Quoted, Declined or No response, with a note (E-4). Only the
 * changes canMoveInsurer() allows are offered; an answer can be corrected.
 */
export function ResponseDialog({
  record,
  insurer,
}: {
  record: ProposalRecord;
  insurer: ProposalInsurer;
}) {
  const ids = { status: useId(), note: useId() };
  const saveRecord = useSaveRecord();
  const [open, setOpen] = useState(false);
  const allowed = RESPONSE_STATUSES.filter((status) => canMoveInsurer(insurer.status, status));
  const [status, setStatus] = useState<ResponseStatus | null>(null);
  const [note, setNote] = useState('');
  const name = `${insurer.company}, ${insurer.branch}`;
  const answered = insurer.response !== null;
  // Q-5: a decline is recorded with the insurer's reason; the QCR then leaves the insurer out.
  const needsReason = status === 'DECLINED';
  const missingReason = needsReason && note.trim() === '';

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/insurers/${insurer.insurerId}/response`, {
        method: 'PUT',
        body: { status, note },
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      saveRecord(saved);
      setOpen(false);
      toast({
        title: `${name}: ${status ? INSURER_STATUS_LABELS[status] : ''}`,
        variant: 'success',
      });
    },
  });

  if (allowed.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setStatus(insurer.response?.status ?? null);
          setNote(insurer.response?.note ?? '');
          save.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`${answered ? 'Change answer' : 'Record answer'} for ${name}`}
        >
          <MessageSquareReply aria-hidden="true" />
          {answered ? 'Change answer' : 'Record answer'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name}: the insurer’s answer</DialogTitle>
          <DialogDescription>
            Now {INSURER_STATUS_LABELS[insurer.status]}. Everyone on the case sees the answer.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend id={ids.status} className="mb-1 text-sm font-medium">
            Answer
          </legend>
          {allowed.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={ids.status}
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              {INSURER_STATUS_LABELS[value]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.note}>
            {needsReason ? 'Reason for declining' : 'Note (optional)'}
          </Label>
          <Textarea
            id={ids.note}
            value={note}
            maxLength={NOTE_MAX}
            rows={3}
            required={needsReason}
            aria-required={needsReason}
            onChange={(event) => setNote(event.target.value)}
          />
          <p className="text-xs text-muted-foreground tabular">
            {needsReason ? 'Required. A declined insurer is left out of the QCR. ' : ''}
            {note.length} of {NOTE_MAX} characters
          </p>
        </div>
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!status || missingReason || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Save answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
