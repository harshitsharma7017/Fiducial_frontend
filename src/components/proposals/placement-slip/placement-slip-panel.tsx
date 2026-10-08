'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  Mail,
  Paperclip,
  Pencil,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { todayIst } from '@/lib/dates';
import { queryKeys } from '@/lib/query-keys';
import {
  PLACED_DOCUMENT_KINDS,
  PLACED_DOCUMENT_KIND_LABELS,
  PLACEMENT_FILE_TYPES,
  PLACEMENT_SLIP_STATUS_LABELS,
  PlacementFileSchema,
  PlacementSlipSchema,
  PlacementSlipSendResponseSchema,
  QUOTE_OPTION_LABELS,
  RecordPlacedRequestSchema,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type PlacementFile,
  type PlacementSlip,
  type ProposalRecord,
  type RecordPlacedFormValues,
  type RecordPlacedRequest,
} from '@/shared';

// The Placement slip tab: the quote the client accepted as the client's Placement Slip format,
// the broker's remarks, approval of exactly what is shown, the downloads, the mail to the insurer
// (the case moves to Placement Slip), and the policy or cover note issued (the case moves to
// Placed).

const ACCEPT = [...Object.keys(PLACEMENT_FILE_TYPES), ...Object.values(PLACEMENT_FILE_TYPES)].join(
  ',',
);
const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;
const rupees = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 0)}`;

export function PlacementSlipPanel({ record }: { record: ProposalRecord }) {
  const canEdit = usePermission('proposals.edit') && record.stage !== 'CLOSED';
  const canApprove = usePermission('proposals.approve') && record.stage !== 'CLOSED';
  const canSend = usePermission('proposals.send') && record.stage !== 'CLOSED';
  const query = useQuery({
    queryKey: queryKeys.proposals.placementSlip(record.id),
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${record.id}/placement-slip`, { schema: PlacementSlipSchema, signal }),
  });
  const [dirty, setDirty] = useState(false);

  if (query.isPending) return <LoadingState label="Loading the placement slip…" />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  const slip = query.data;
  if (!slip.accepted) {
    return (
      <Alert variant="info">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Not ready for the placement slip</AlertTitle>
        <AlertDescription>{slip.blocked}</AlertDescription>
      </Alert>
    );
  }
  const sent = slip.sends.some((send) => send.result !== 'FAILED');
  return (
    <div className="grid gap-6">
      <StatusCard
        record={record}
        slip={slip}
        canApprove={canApprove}
        canSend={canSend}
        unsaved={dirty}
      />
      <SummaryCard slip={slip} />
      {/* Remounted when the saved remarks change, so the box starts from them. */}
      <RemarksCard
        key={slip.remarks ?? ''}
        record={record}
        slip={slip}
        readOnly={!canEdit}
        onDirty={setDirty}
      />
      {slip.sends.length > 0 ? <Sends slip={slip} /> : null}
      {sent || slip.placed ? <PlacedCard record={record} slip={slip} canEdit={canEdit} /> : null}
    </div>
  );
}

function useSetSlip(id: string) {
  const queryClient = useQueryClient();
  return (saved: PlacementSlip) => {
    queryClient.setQueryData(queryKeys.proposals.placementSlip(id), saved);
    void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(id) });
  };
}

function StatusCard({
  record,
  slip,
  canApprove,
  canSend,
  unsaved,
}: {
  record: ProposalRecord;
  slip: PlacementSlip;
  canApprove: boolean;
  canSend: boolean;
  unsaved: boolean;
}) {
  const setSlip = useSetSlip(record.id);
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/placement-slip/approve`, {
        method: 'POST',
        body: { fingerprint: slip.fingerprint },
        schema: PlacementSlipSchema,
      }),
    onSuccess: (saved) => {
      setSlip(saved);
      toast({ title: 'Placement slip approved', variant: 'success' });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PLACEMENT_SLIP_CHANGED') {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.proposals.placementSlip(record.id),
        });
      }
    },
  });
  const download = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      apiDownload(
        `proposals/${record.id}/placement-slip/document?format=${format}`,
        `Placement-Slip-${record.reference}.${format}`,
      ),
    onSuccess: (file) => saveFile(file),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            Placement slip
            <Badge
              variant={
                slip.status === 'DRAFT' ? 'muted' : slip.status === 'APPROVED' ? 'info' : 'success'
              }
            >
              {PLACEMENT_SLIP_STATUS_LABELS[slip.status]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {slip.approval
              ? slip.approval.current
                ? `Approved by ${slip.approval.by}, ${formatDateTime(slip.approval.at)}.`
                : `Approved by ${slip.approval.by}, ${formatDateTime(slip.approval.at)}, but it changed since: approve it again before sending.`
              : 'Not approved yet. Only an approved slip can be sent to the insurer.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['xlsx', 'pdf'] as const).map((format) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              disabled={!slip.templateUploaded || download.isPending}
              onClick={() => download.mutate(format)}
            >
              {download.isPending && download.variables === format ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : format === 'pdf' ? (
                <FileText aria-hidden="true" />
              ) : (
                <Download aria-hidden="true" />
              )}
              Download slip ({format === 'pdf' ? 'PDF' : 'Excel'})
            </Button>
          ))}
          {canApprove && slip.status === 'DRAFT' ? (
            <Button
              type="button"
              disabled={slip.missing.length > 0 || unsaved || approve.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              Approve slip
            </Button>
          ) : null}
          {canSend ? <SendDialog record={record} slip={slip} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {slip.missing.length > 0 ? (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Needed before approval</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {slip.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : slip.status === 'DRAFT' ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheck aria-hidden="true" className="size-4 text-success" />
            Ready for approval{unsaved ? ' once the remarks are saved' : ''}.
          </p>
        ) : null}
        {approve.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(approve.error)}</AlertDescription>
          </Alert>
        ) : null}
        {download.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(download.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ slip }: { slip: PlacementSlip }) {
  const accepted = slip.accepted;
  if (!accepted || !slip.premium) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {accepted.company}, {accepted.branch}
        </CardTitle>
        <CardDescription>
          {QUOTE_OPTION_LABELS[accepted.option]}
          {accepted.withTerrorism === null
            ? ''
            : accepted.withTerrorism
              ? ' · Fire with terrorism'
              : ' · Fire without terrorism'}{' '}
          · accepted on {formatDate(accepted.acceptedOn)}, confirmed by {accepted.confirmedBy}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead className="text-right">Sum insured</TableHead>
              <TableHead className="text-right">Premium</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slip.sections.map((section) => (
              <TableRow key={section.code}>
                <TableCell>{section.name}</TableCell>
                <TableCell className="text-right tabular">{rupees(section.sumInsured)}</TableCell>
                <TableCell className="text-right tabular">{paise(section.premium)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Net premium</TableCell>
              <TableCell className="text-right tabular">{paise(slip.premium.net)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2}>GST {slip.gstRatePercent}%</TableCell>
              <TableCell className="text-right tabular">{paise(slip.premium.gst)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Total premium
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {paise(slip.premium.total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Capacity</dt>
            <dd>{slip.capacityPercent ? `${slip.capacityPercent}%` : 'Not stated'}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Deductibles</dt>
            <dd>{slip.deductibles ?? '—'}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Conditions</dt>
            <dd>{slip.conditions ?? '—'}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function RemarksCard({
  record,
  slip,
  readOnly,
  onDirty,
}: {
  record: ProposalRecord;
  slip: PlacementSlip;
  readOnly: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const setSlip = useSetSlip(record.id);
  const remarksId = useId();
  const [remarks, setRemarks] = useState(slip.remarks ?? '');
  const dirty = remarks.trim() !== (slip.remarks ?? '');
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/placement-slip`, {
        method: 'PUT',
        body: { remarks },
        schema: PlacementSlipSchema,
      }),
    onSuccess: (saved) => {
      setSlip(saved);
      toast({
        title: 'Remarks saved',
        description: slip.approval?.current ? 'The change needs approval again.' : undefined,
        variant: 'success',
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remarks</CardTitle>
        <CardDescription>
          Printed on the slip. Changing them after approval needs approval again.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Label htmlFor={remarksId} className="sr-only">
          Remarks
        </Label>
        <Textarea
          id={remarksId}
          rows={3}
          maxLength={2000}
          value={remarks}
          disabled={readOnly}
          onChange={(event) => setRemarks(event.target.value)}
        />
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        {readOnly ? null : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {dirty
                ? 'Unsaved changes'
                : slip.updatedAt
                  ? `Saved by ${slip.updatedBy ?? 'unknown'}, ${formatDateTime(slip.updatedAt)}`
                  : 'Not saved yet'}
            </p>
            <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Save remarks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Mails the approved slip to the insurer the client accepted. */
function SendDialog({ record, slip }: { record: ProposalRecord; slip: PlacementSlip }) {
  const setSlip = useSetSlip(record.id);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [sendId, setSendId] = useState('');
  const approved = slip.status !== 'DRAFT';
  const send = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/placement-slip/email`, {
        method: 'POST',
        body: { sendId, to: chosen, format },
        schema: PlacementSlipSendResponseSchema,
      }),
    onSuccess: (result) => {
      setSlip(result.slip);
      if (result.outcome === 'SENT') {
        toast({
          title: 'Placement slip sent to the insurer',
          description: chosen.join(', '),
          variant: 'success',
        });
        setOpen(false);
      } else {
        toast({
          title: 'The placement slip was not sent',
          description: result.reason ?? undefined,
          variant: 'destructive',
        });
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setChosen(slip.recipients.slice(0, 1).map((recipient) => recipient.email));
          setSendId(crypto.randomUUID());
          send.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={approved ? 'default' : 'outline'} disabled={!approved}>
          <Mail aria-hidden="true" />
          Send to the insurer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send the placement slip</DialogTitle>
          <DialogDescription>
            One mail to {slip.accepted?.company}, from the Placement slip email template, with the
            approved slip attached.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">To</legend>
          {slip.recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The insurer has no address; add one in the insurer master.
            </p>
          ) : (
            slip.recipients.map((recipient) => {
              const id = `slip-to-${recipient.email}`;
              return (
                <div key={recipient.email} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={chosen.includes(recipient.email)}
                    onCheckedChange={(value) =>
                      setChosen((current) =>
                        value === true
                          ? [...current, recipient.email]
                          : current.filter((item) => item !== recipient.email),
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {recipient.name} &lt;{recipient.email}&gt;
                  </Label>
                </div>
              );
            })
          )}
        </fieldset>
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm font-medium">Attach as</legend>
          {(['pdf', 'xlsx'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="slip-format"
                value={value}
                checked={format === value}
                onChange={() => setFormat(value)}
                className="size-4 accent-primary"
              />
              {value === 'pdf' ? 'PDF' : 'Excel'}
            </label>
          ))}
        </fieldset>
        {send.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(send.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={chosen.length === 0 || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Mail aria-hidden="true" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Sends({ slip }: { slip: PlacementSlip }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent to the insurer</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 text-sm">
          {slip.sends.map((send) => (
            <li key={send.mailId}>
              {formatDateTime(send.at)} · {send.by} · {send.to.join(', ')} ·{' '}
              {send.result === 'FAILED'
                ? `Failed: ${send.error ?? ''}`
                : send.result === 'OUTBOX'
                  ? 'Kept in the outbox'
                  : 'Delivered to the mail server'}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function placedDefaults(slip: PlacementSlip): RecordPlacedFormValues {
  const placed = slip.placed;
  return {
    documentKind: placed?.documentKind ?? 'POLICY',
    number: placed?.number ?? '',
    issuedOn: placed?.issuedOn ?? todayIst(),
    note: placed?.note ?? '',
    attachmentIds: placed?.files.map((file) => file.id) ?? [],
  };
}

/** The policy or cover note the insurer issued: recording it moves the case to Placed. */
function PlacedCard({
  record,
  slip,
  canEdit,
}: {
  record: ProposalRecord;
  slip: PlacementSlip;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const placed = slip.placed;
  if (placed && !editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 aria-hidden="true" className="size-5 text-success" />
              Placed: {PLACED_DOCUMENT_KIND_LABELS[placed.documentKind]} {placed.number}
            </CardTitle>
            <CardDescription>
              Issued on {formatDate(placed.issuedOn)} · recorded by {placed.recordedBy},{' '}
              {formatDateTime(placed.recordedAt)}
            </CardDescription>
          </div>
          {canEdit ? (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Change
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {placed.note ? <p>{placed.note}</p> : null}
          <ul className="grid gap-1">
            {placed.files.map((file) => (
              <li key={file.id}>
                <a
                  className="text-primary underline-offset-2 hover:underline"
                  href={`/api/proxy/proposals/${record.id}/placement-slip/files/${file.id}`}
                >
                  {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }
  if (!canEdit) return null;
  return (
    <PlacedForm
      record={record}
      slip={slip}
      onDone={() => setEditing(false)}
      onCancel={placed ? () => setEditing(false) : undefined}
    />
  );
}

function PlacedForm({
  record,
  slip,
  onDone,
  onCancel,
}: {
  record: ProposalRecord;
  slip: PlacementSlip;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const setSlip = useSetSlip(record.id);
  const kindId = useId();
  const form = useForm<RecordPlacedFormValues, unknown, RecordPlacedRequest>({
    resolver: zodResolver(RecordPlacedRequestSchema),
    defaultValues: placedDefaults(slip),
  });
  const save = useMutation({
    mutationFn: (body: RecordPlacedRequest) =>
      apiFetch(`proposals/${record.id}/placement-slip/placed`, {
        method: 'PUT',
        body,
        schema: PlacementSlipSchema,
      }),
    onSuccess: (saved) => {
      setSlip(saved);
      toast({
        title: slip.placed ? 'Placement corrected' : 'Case placed',
        description: slip.placed ? undefined : 'The case moved to Placed.',
        variant: 'success',
      });
      onDone();
    },
  });
  const serverIssue =
    save.error instanceof ApiError && Array.isArray(save.error.details)
      ? (save.error.details as { message?: string }[]).map((item) => item.message).join(' ')
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {slip.placed ? 'Change the policy or cover note' : 'Record the policy or cover note'}
        </CardTitle>
        <CardDescription>
          What the insurer issued against the slip, with its file. Recording it moves the case to
          Placed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="documentKind"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel htmlFor={kindId}>Issued</FormLabel>
                    <NativeSelect
                      id={kindId}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      {PLACED_DOCUMENT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {PLACED_DOCUMENT_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Number</FormLabel>
                    <FormControl>
                      <Input maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issuedOn"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Issued on</FormLabel>
                    <FormControl>
                      <Input type="date" max={todayIst()} {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={1000}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <PlacedFiles
              record={record}
              files={slip.files}
              control={form.control}
              setValue={(value) =>
                form.setValue('attachmentIds', value, { shouldDirty: true, shouldValidate: true })
              }
              error={form.formState.errors.attachmentIds?.message}
            />
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{serverIssue || errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {onCancel ? (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileCheck2 aria-hidden="true" />
                )}
                {slip.placed ? 'Save the change' : 'Record and mark as placed'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** The insurer's policy or cover note: upload one, or tick one already kept for this case. */
function PlacedFiles({
  record,
  files,
  control,
  setValue,
  error,
}: {
  record: ProposalRecord;
  files: readonly PlacementFile[];
  control: Control<RecordPlacedFormValues, unknown, RecordPlacedRequest>;
  setValue: (value: string[]) => void;
  error: string | undefined;
}) {
  const queryClient = useQueryClient();
  const chosen = useWatch({ control, name: 'attachmentIds' }) ?? [];
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiFetch(
        `proposals/${record.id}/placement-slip/files?fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          body: new Blob([file], { type: file.type || 'application/octet-stream' }),
          schema: PlacementFileSchema,
        },
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<PlacementSlip>(
        queryKeys.proposals.placementSlip(record.id),
        (current) => (current ? { ...current, files: [...current.files, saved] } : current),
      );
      setValue([...chosen, saved.id]);
    },
  });
  const toggle = (id: string, on: boolean) =>
    setValue(on ? [...chosen, id] : chosen.filter((item) => item !== id));

  return (
    <section aria-labelledby="placed-files" className="grid gap-2">
      <h3 id="placed-files" className="text-sm font-semibold">
        The policy or cover note (required)
      </h3>
      {files.length > 0 ? (
        <ul className="grid gap-1">
          {files.map((file) => {
            const id = `placed-file-${file.id}`;
            return (
              <li key={file.id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={chosen.includes(file.id)}
                  onCheckedChange={(value) => toggle(file.id, value === true)}
                />
                <Label htmlFor={id} className="font-normal">
                  {file.fileName}
                </Label>
                <a
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  href={`/api/proxy/proposals/${record.id}/placement-slip/files/${file.id}`}
                >
                  Download
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Policy or cover note"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload aria-hidden="true" />
          )}
          Upload policy or cover note
        </Button>
        <span className="text-xs text-muted-foreground">
          <Paperclip aria-hidden="true" className="mr-1 inline size-3" />
          .pdf, .eml, .msg, .png or .jpg, up to 10 MB
        </span>
      </div>
      {upload.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {upload.error instanceof ApiError && Array.isArray(upload.error.details)
            ? ((upload.error.details as { message?: string }[])[0]?.message ??
              errorMessage(upload.error))
            : errorMessage(upload.error)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
