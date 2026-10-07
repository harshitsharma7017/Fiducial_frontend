'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, FileText, LoaderCircle, Search, Send, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  DocumentTemplateListSchema,
  InsurerListResponseSchema,
  MAX_PROPOSAL_INSURERS,
  ProposalRecordSchema,
  formatDateTime,
  type ProposalInsurer,
  type ProposalRecord,
} from '@/shared';

const SEARCH_LIMIT = 50;

function useSaveRecord() {
  const queryClient = useQueryClient();
  return (saved: ProposalRecord) => {
    queryClient.setQueryData(queryKeys.proposals.record(saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: ['proposals'] });
  };
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${what} copied`, description: text, variant: 'success' });
  } catch {
    toast({
      title: 'Could not copy',
      description: 'Select the addresses and copy them instead.',
      variant: 'destructive',
    });
  }
}

/**
 * The RFQ round: choose up to five insurers from the insurer master, download the RFQ workbook,
 * email it to each insurer's RFQ addresses and mark it as sent. Sending locks the Data Sheet.
 */
export function InsurersRfqPanel({ record }: { record: ProposalRecord }) {
  const canEdit = usePermission('proposals.edit');
  const canSend = usePermission('proposals.send');
  const canExport = usePermission('proposals.export');
  const unsent = record.insurers.filter((insurer) => insurer.status === 'NOT_SENT');
  const complete = record.missing.length === 0;

  return (
    <div className="grid gap-6 *:min-w-0">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Insurers</CardTitle>
            <CardDescription>
              Up to {MAX_PROPOSAL_INSURERS} active insurers from the insurer master. The RFQ goes to
              each branch’s RFQ email addresses.
            </CardDescription>
          </div>
          {canEdit ? <ChooseInsurersDialog record={record} /> : null}
        </CardHeader>
        <CardContent>
          <InsurersTable record={record} canEdit={canEdit} canSend={canSend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send the RFQ</CardTitle>
          <CardDescription>
            Email the workbook from your mailbox, then record it here so everyone sees where the
            proposal stands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-5">
            <Step number={1} title="Download the RFQ workbook">
              {complete ? (
                <p className="text-sm text-muted-foreground">
                  Premium details for the insurer to fill in, the schedule, Fire by location, risk
                  details and claim details.
                </p>
              ) : (
                <p className="text-sm text-warning">
                  Complete the Data Sheet first: {record.missing.length}{' '}
                  {record.missing.length === 1 ? 'item is' : 'items are'} still needed.
                </p>
              )}
              {canExport ? (
                <DownloadRfqButton record={record} disabled={!complete} />
              ) : (
                <p className="text-sm text-muted-foreground">Your role cannot download the RFQ.</p>
              )}
            </Step>
            <Step number={2} title="Email it to the insurers">
              {unsent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {record.insurers.length === 0
                    ? 'Choose insurers above first.'
                    : 'Every chosen insurer has the RFQ.'}
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Attach the workbook and send it to these addresses:
                  </p>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm break-words select-all">
                    {emailsOf(unsent).join(', ') || 'No RFQ addresses on file'}
                  </p>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={emailsOf(unsent).length === 0}
                      onClick={() => void copyText(emailsOf(unsent).join(', '), 'Addresses')}
                    >
                      <Copy aria-hidden="true" />
                      Copy all addresses
                    </Button>
                  </div>
                </>
              )}
            </Step>
            <Step number={3} title="Mark it as sent">
              <p className="text-sm text-muted-foreground">
                Records who sent it and when, and moves the proposal to RFQ Sent. The Data Sheet
                then locks.
              </p>
              {canSend && unsent.length > 0 ? (
                <div>
                  <MarkSentDialog
                    record={record}
                    insurers={unsent}
                    disabled={!complete}
                    trigger={
                      <Button type="button" disabled={!complete}>
                        <Send aria-hidden="true" />
                        Mark as sent to {unsent.length === 1 ? '1 insurer' : `all ${unsent.length}`}
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </Step>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function emailsOf(insurers: readonly ProposalInsurer[]): string[] {
  return [...new Set(insurers.flatMap((insurer) => insurer.rfqEmails))];
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary tabular"
      >
        {number}
      </span>
      <div className="grid min-w-0 gap-2">
        <h3 className="text-sm font-semibold">
          <span className="sr-only">Step {number}: </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

/**
 * The RFQ downloads (R-3, R-4): Excel in the client's template and the same as an A4 PDF with the
 * broker's letterhead. Says whether the client's template is in use or the built-in layout.
 */
function DownloadRfqButton({ record, disabled }: { record: ProposalRecord; disabled: boolean }) {
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: ({ signal }) => apiFetch('templates', { schema: DocumentTemplateListSchema, signal }),
  });
  const rfqTemplate = templates.data?.items.find((item) => item.kind === 'RFQ')?.template ?? null;
  const download = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      apiDownload(
        `proposals/${record.id}/rfq?format=${format}`,
        `RFQ-${record.reference}.${format}`,
      ),
    onSuccess: (file) => {
      saveFile(file);
      void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(record.id) });
    },
  });
  const pending = (format: 'xlsx' | 'pdf') => download.isPending && download.variables === format;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {(['xlsx', 'pdf'] as const).map((format) => (
          <Button
            key={format}
            type="button"
            variant="outline"
            disabled={disabled || download.isPending}
            onClick={() => download.mutate(format)}
          >
            {pending(format) ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : format === 'pdf' ? (
              <FileText aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            Download RFQ ({format === 'pdf' ? 'PDF' : 'Excel'})
          </Button>
        ))}
      </div>
      {templates.isSuccess ? (
        <p className="text-xs text-muted-foreground">
          {rfqTemplate ? (
            <>
              In the client’s RFQ template ({rfqTemplate.fileName}); the PDF has the broker’s
              letterhead.
            </>
          ) : (
            <>
              In the built-in layout: the client’s RFQ template has not been uploaded (Masters →
              Document templates).
            </>
          )}
        </p>
      ) : null}
      {download.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(download.error)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function InsurersTable({
  record,
  canEdit,
  canSend,
}: {
  record: ProposalRecord;
  canEdit: boolean;
  canSend: boolean;
}) {
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
  const complete = record.missing.length === 0;

  if (record.insurers.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-md border border-dashed p-6 text-center">
        <Users className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">No insurers chosen yet</p>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'Choose the insurers to ask for quotes.'
            : 'A Relationship Manager or the placement team chooses them.'}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption className="sr-only">Insurers on this proposal</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Insurer</TableHead>
          <TableHead>RFQ email addresses</TableHead>
          <TableHead>RFQ</TableHead>
          {canEdit || canSend ? (
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {record.insurers.map((insurer) => {
          const name = `${insurer.company}, ${insurer.branch}`;
          return (
            <TableRow key={insurer.insurerId}>
              <TableCell className="min-w-40 whitespace-normal">
                <span className="font-medium">{insurer.company}</span>
                <span className="block text-xs text-muted-foreground">{insurer.branch}</span>
                {insurer.active ? null : <Badge variant="warning">Inactive</Badge>}
              </TableCell>
              <TableCell className="min-w-48 whitespace-normal">
                {insurer.rfqEmails.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None on file</span>
                ) : (
                  <div className="flex items-start gap-1">
                    <span className="text-sm break-all">{insurer.rfqEmails.join(', ')}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => void copyText(insurer.rfqEmails.join(', '), 'Addresses')}
                    >
                      <Copy aria-hidden="true" />
                      <span className="sr-only">Copy addresses for {name}</span>
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                {insurer.status === 'SENT' ? (
                  <>
                    <Badge variant="success">Sent</Badge>
                    <span className="block text-xs text-muted-foreground tabular">
                      {insurer.sentAt ? formatDateTime(insurer.sentAt) : ''}
                      {insurer.sentBy ? ` · ${insurer.sentBy}` : ''}
                    </span>
                  </>
                ) : (
                  <Badge variant="muted">Not sent</Badge>
                )}
              </TableCell>
              {canEdit || canSend ? (
                <TableCell className="text-right whitespace-nowrap">
                  {insurer.status === 'NOT_SENT' ? (
                    <div className="flex justify-end gap-1">
                      {canSend ? (
                        <MarkSentDialog
                          record={record}
                          insurers={[insurer]}
                          disabled={!complete}
                          trigger={
                            <Button type="button" variant="outline" size="sm" disabled={!complete}>
                              Mark sent<span className="sr-only"> to {name}</span>
                            </Button>
                          }
                        />
                      ) : null}
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(insurer.insurerId)}
                        >
                          <X aria-hidden="true" />
                          Remove<span className="sr-only"> {name}</span>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ChooseInsurersDialog({ record }: { record: ProposalRecord }) {
  const searchId = useId();
  const saveRecord = useSaveRecord();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const q = useDebouncedValue(search.trim(), 250);
  const sent = new Set(
    record.insurers.filter((i) => i.status === 'SENT').map((insurer) => insurer.insurerId),
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

function MarkSentDialog({
  record,
  insurers,
  disabled,
  trigger,
}: {
  record: ProposalRecord;
  insurers: ProposalInsurer[];
  disabled: boolean;
  trigger: ReactElement;
}) {
  const saveRecord = useSaveRecord();
  const [open, setOpen] = useState(false);
  const mark = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/rfq/sent`, {
        method: 'POST',
        body: { insurerIds: insurers.map((insurer) => insurer.insurerId) },
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        mark.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark the RFQ as sent?</DialogTitle>
          <DialogDescription>Confirm you have emailed the RFQ workbook to:</DialogDescription>
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
          <Button type="button" disabled={mark.isPending} onClick={() => mark.mutate()}>
            {mark.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Mark as sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
