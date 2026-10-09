'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
} from '@/components/ui/dialog';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { isRecordId } from '@/lib/api/new-business';
import { ProposalRecordSchema } from '@/shared';

// Moving a case to the Deleted bin (Admins, proposals.delete): it is kept with all its work but
// left out of every list until restored from the bin. Used on the Proposals list and the RFQ,
// Quotes and QCR and Placement Slips lists, which all refresh under the "proposals" key.

export function DeleteCaseButton({
  id,
  reference,
  clientName,
}: {
  id: string;
  reference: string;
  clientName: string;
}) {
  const canDelete = usePermission('proposals.delete');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${id}`, { method: 'DELETE', schema: ProposalRecordSchema }),
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({
        title: `${reference} moved to the Deleted bin`,
        description: 'An Admin can restore it from Proposals → Deleted bin.',
        variant: 'success',
      });
    },
  });
  // Sample cases (demo mode) have no API record to delete.
  if (!canDelete || !isRecordId(id)) return null;

  return (
    // The rows open their case on click, and the dialog's clicks reach the row through the
    // portal: none of them should.
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${reference}`}
        title="Delete"
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => (remove.isPending ? undefined : setOpen(next))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {reference}?</DialogTitle>
            <DialogDescription>
              {clientName}’s case, with its Data Sheet, RFQ, quotes, QCR, client approval and
              placement slip, moves to the Deleted bin. It disappears from every list; an Admin can
              restore it from the bin.
            </DialogDescription>
          </DialogHeader>
          {remove.isError ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{errorMessage(remove.error)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Delete case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
