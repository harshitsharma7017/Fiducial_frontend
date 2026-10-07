'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { LoaderCircle, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  InsurerListResponseSchema,
  MAX_PROPOSAL_INSURERS,
  ProposalRecordSchema,
  hasRfq,
  type ProposalRecord,
} from '@/shared';
import { useSaveRecord } from './use-rfq';

const SEARCH_LIMIT = 50;

/** Chooses up to five active insurers from the insurer master; ones with the RFQ stay. */
export function ChooseInsurersDialog({ record }: { record: ProposalRecord }) {
  const searchId = useId();
  const saveRecord = useSaveRecord();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const q = useDebouncedValue(search.trim(), 250);
  const sent = new Set(
    record.insurers.filter((i) => hasRfq(i.status)).map((insurer) => insurer.insurerId),
  );

  const insurers = useQuery({
    queryKey: queryKeys.insurers.list({ q, active: true, picker: true }),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ active: 'true', limit: String(SEARCH_LIMIT) });
      if (q) params.set('q', q);
      return apiFetch(`insurers?${params.toString()}`, {
        schema: InsurerListResponseSchema,
        signal,
      });
    },
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: (insurerIds: string[]) =>
      apiFetch(`proposals/${record.id}/insurers`, {
        method: 'PUT',
        body: { insurerIds },
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      saveRecord(saved);
      setOpen(false);
      toast({
        title: 'Insurers saved',
        description: `${saved.insurers.length} on this proposal`,
        variant: 'success',
      });
    },
  });

  const full = chosen.length >= MAX_PROPOSAL_INSURERS;
  const items = insurers.data?.items ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setChosen(record.insurers.map((insurer) => insurer.insurerId));
          setSearch('');
          save.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Users aria-hidden="true" />
          Choose insurers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose insurers</DialogTitle>
          <DialogDescription>
            Up to {MAX_PROPOSAL_INSURERS}. Insurers the RFQ was already sent to stay on the
            proposal.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={searchId}>Search by company or branch</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {insurers.isPending ? (
            <LoadingState label="Loading insurers" />
          ) : insurers.isError ? (
            <ErrorState error={insurers.error} onRetry={() => void insurers.refetch()} />
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {q ? `No active insurers match “${q}”.` : 'No active insurers yet. '}
              {q ? null : (
                <Link href="/masters/insurers" className="text-accent-strong hover:underline">
                  Add them in the insurer master.
                </Link>
              )}
            </p>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="sr-only">Insurers</legend>
              {items.map((insurer) => {
                const id = `insurer-${insurer.id}`;
                const checked = chosen.includes(insurer.id);
                const locked = sent.has(insurer.id);
                return (
                  <div
                    key={insurer.id}
                    className="flex items-start gap-3 rounded-md border px-3 py-2"
                  >
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={checked}
                      disabled={locked || (!checked && full)}
                      onCheckedChange={(value) =>
                        setChosen((current) =>
                          value === true
                            ? [...current, insurer.id]
                            : current.filter((item) => item !== insurer.id),
                        )
                      }
                    />
                    <Label htmlFor={id} className="grid gap-0.5 font-normal">
                      <span className="font-medium">
                        {insurer.company}, {insurer.branch}
                      </span>
                      <span className="text-xs break-all text-muted-foreground">
                        {insurer.rfqEmails.join(', ') || 'No RFQ email addresses'}
                        {locked ? ' · RFQ sent' : ''}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </fieldset>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular" aria-live="polite">
          {chosen.length} of {MAX_PROPOSAL_INSURERS} chosen
        </p>
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate(chosen)}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Save insurers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
