'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, FileText, Info, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  FormDescription,
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
import { apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { todayIst } from '@/lib/dates';
import { queryKeys } from '@/lib/query-keys';
import {
  COVERAGE_CONFIRMATION_CHANNELS,
  COVERAGE_CONFIRMATION_CHANNEL_LABELS,
  CoverageConfirmationSchema,
  CoverageConfirmationSendResponseSchema,
  PLACED_DOCUMENT_KIND_LABELS,
  QUOTE_OPTION_LABELS,
  RecordCoverageConfirmationRequestSchema,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type CoverageConfirmation,
  type ProposalRecord,
  type RecordCoverageConfirmationFormValues,
  type RecordCoverageConfirmationRequest,
} from '@/shared';

// Q4: the Coverage confirmation tab. After the case is placed, staff record the insurer's
// confirmation of cover, review the policy details (read live from the placement slip), generate
// the branded letter PDF, and explicitly email the confirmation to the insured. The letter format
// and the signatory are configurable and shown with a clear "awaiting client confirmation" note;
// no signature is ever rendered and nothing is sent by recording.

const rupees = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 0)}`;
const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;

export function CoverageConfirmationPanel({ record }: { record: ProposalRecord }) {
  const query = useQuery({
    queryKey: queryKeys.proposals.coverageConfirmation(record.id),
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${record.id}/coverage-confirmation`, {
        schema: CoverageConfirmationSchema,
        signal,
      }),
  });

  if (query.isPending) return <LoadingState label="Loading the coverage confirmation…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const coverage = query.data;
  if (coverage.blocked) {
    return (
      <Alert variant="info">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Not ready for the coverage confirmation</AlertTitle>
        <AlertDescription>{coverage.blocked}</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="grid gap-6">
      <StatusCard record={record} coverage={coverage} />
      {coverage.policy ? <PolicyCard coverage={coverage} /> : null}
      <RecordCard
        key={coverage.confirmation?.updatedAt ?? 'new'}
        record={record}
        coverage={coverage}
      />
      {coverage.sends.length > 0 ? <Sends coverage={coverage} /> : null}
    </div>
  );
}

function useSetCoverage(id: string) {
  const queryClient = useQueryClient();
  return (saved: CoverageConfirmation) =>
    queryClient.setQueryData(queryKeys.proposals.coverageConfirmation(id), saved);
}

function StatusCard({
  record,
  coverage,
}: {
  record: ProposalRecord;
  coverage: CoverageConfirmation;
}) {
  const canSend = usePermission('property.send') && record.stage !== 'CLOSED';
  const canExport = usePermission('property.export');
  const recorded = coverage.confirmation !== null;
  const channel = coverage.confirmation?.channel ?? null;
  // The configured channel decides which output this confirmation calls for; the interface makes
  // that clear and emphasises the matching action. The client has not finalised the channel, so
  // nothing is hard-locked — the other action stays available but de-emphasised.
  const letterWanted = channel === 'LETTER' || channel === 'BOTH';
  const emailWanted = channel === 'EMAIL' || channel === 'BOTH';
  const download = useMutation({
    mutationFn: () =>
      apiDownload(
        `proposals/${record.id}/coverage-confirmation/document`,
        `Coverage-Confirmation-${record.reference}.pdf`,
      ),
    onSuccess: (file) => saveFile(file),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            Coverage confirmation
            <Badge variant={recorded ? 'success' : 'muted'}>
              {recorded ? 'Recorded' : 'Not recorded'}
            </Badge>
            {channel ? (
              <Badge variant="outline">{COVERAGE_CONFIRMATION_CHANNEL_LABELS[channel]}</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {recorded
              ? `Insurer confirmed on ${formatDate(coverage.confirmation!.confirmedOn)}, recorded by ${coverage.confirmation!.recordedBy}. ${
                  channel === 'LETTER'
                    ? 'This confirmation is set to a letter (PDF).'
                    : channel === 'EMAIL'
                      ? 'This confirmation is set to an email to the insured.'
                      : 'This confirmation is set to a letter and an email.'
                }`
              : 'Record the insurer’s confirmation of cover, then generate the letter or email the insured.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <Button
              type="button"
              variant={recorded && letterWanted ? 'default' : 'outline'}
              disabled={!recorded || download.isPending}
              onClick={() => download.mutate()}
            >
              {download.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <FileText aria-hidden="true" />
              )}
              Download letter (PDF)
            </Button>
          ) : null}
          {canSend ? (
            <SendDialog record={record} coverage={coverage} emphasise={recorded && emailWanted} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {coverage.presentationPending ? (
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>Awaiting client confirmation</AlertTitle>
            <AlertDescription>
              The client has not confirmed the final letter format (letter, email or both) or the
              authorised signatory. The letter uses the Fiducial design; the signatory is shown as
              typed text only and never as a signature.
            </AlertDescription>
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

function PolicyCard({ coverage }: { coverage: CoverageConfirmation }) {
  const policy = coverage.policy;
  if (!policy) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy details</CardTitle>
        <CardDescription>
          Read from the placement slip and the policy or cover note recorded. These are not edited
          here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Fact label="Insured">{policy.insuredName}</Fact>
          <Fact label="Insurer">
            {policy.insurerName}, {policy.insurerBranch}
          </Fact>
          {policy.documentKind && policy.policyNumber ? (
            <Fact label={`${PLACED_DOCUMENT_KIND_LABELS[policy.documentKind]} number`}>
              {policy.policyNumber}
            </Fact>
          ) : null}
          {policy.policyStart ? (
            <Fact label="Policy period">
              {formatDate(policy.policyStart)}
              {policy.policyEnd ? ` to ${formatDate(policy.policyEnd)}` : ''}
            </Fact>
          ) : null}
          {policy.option ? <Fact label="Basis">{QUOTE_OPTION_LABELS[policy.option]}</Fact> : null}
          <Fact label="Reference">{policy.reference}</Fact>
        </dl>
        {policy.premium ? (
          <Table>
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
                  <TableCell>{section.name}</TableCell>
                  <TableCell className="text-right tabular">{rupees(section.sumInsured)}</TableCell>
                  <TableCell className="text-right tabular">{paise(section.premium)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Net premium</TableCell>
                <TableCell className="text-right tabular">{paise(policy.premium.net)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>GST {policy.gstRatePercent}%</TableCell>
                <TableCell className="text-right tabular">{paise(policy.premium.gst)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total premium
                </TableCell>
                <TableCell className="text-right font-semibold tabular">
                  {paise(policy.premium.total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function recordDefaults(coverage: CoverageConfirmation): RecordCoverageConfirmationFormValues {
  const c = coverage.confirmation;
  return {
    confirmedOn: c?.confirmedOn ?? todayIst(),
    insurerReference: c?.insurerReference ?? '',
    channel: c?.channel ?? 'LETTER',
    notes: c?.notes ?? '',
    signatoryName: c?.signatoryName ?? '',
    signatoryTitle: c?.signatoryTitle ?? '',
    attachmentIds: c?.attachmentIds ?? [],
  };
}

/** Records (or corrects) the insurer's confirmation. Never sends anything. */
function RecordCard({
  record,
  coverage,
}: {
  record: ProposalRecord;
  coverage: CoverageConfirmation;
}) {
  const canEdit = usePermission('property.edit') && record.stage !== 'CLOSED';
  const setCoverage = useSetCoverage(record.id);
  const kindId = useId();
  const form = useForm<
    RecordCoverageConfirmationFormValues,
    unknown,
    RecordCoverageConfirmationRequest
  >({
    resolver: zodResolver(RecordCoverageConfirmationRequestSchema),
    defaultValues: recordDefaults(coverage),
    disabled: !canEdit,
  });
  const chosen = useWatch({ control: form.control, name: 'attachmentIds' }) ?? [];
  const save = useMutation({
    mutationFn: (body: RecordCoverageConfirmationRequest) =>
      apiFetch(`proposals/${record.id}/coverage-confirmation`, {
        method: 'PUT',
        body,
        schema: CoverageConfirmationSchema,
      }),
    onSuccess: (saved) => {
      setCoverage(saved);
      toast({ title: 'Coverage confirmation saved', variant: 'success' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record the insurer’s confirmation</CardTitle>
        <CardDescription>
          The insurer’s explicit confirmation of cover. Saving this does not email anyone; use “Send
          to the insured” when you are ready.
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
                name="confirmedOn"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Confirmed on</FormLabel>
                    <FormControl>
                      <Input type="date" max={todayIst()} {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="insurerReference"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Insurer reference</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={100}
                        name={field.name}
                        ref={field.ref}
                        disabled={field.disabled}
                        onBlur={field.onBlur}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel htmlFor={kindId}>Delivery (to be confirmed)</FormLabel>
                    <NativeSelect
                      id={kindId}
                      disabled={field.disabled}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      {COVERAGE_CONFIRMATION_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {COVERAGE_CONFIRMATION_CHANNEL_LABELS[channel]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="signatoryName"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Signatory name (to be confirmed)</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={200}
                        name={field.name}
                        ref={field.ref}
                        disabled={field.disabled}
                        onBlur={field.onBlur}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Shown as typed text on the letter, never as a signature.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="signatoryTitle"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Signatory title (to be confirmed)</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={200}
                        name={field.name}
                        ref={field.ref}
                        disabled={field.disabled}
                        onBlur={field.onBlur}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={2000}
                      name={field.name}
                      ref={field.ref}
                      disabled={field.disabled}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {coverage.files.length > 0 ? (
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">
                  Insurer’s confirmation document (optional)
                </legend>
                {coverage.files.map((file) => {
                  const id = `coverage-file-${file.id}`;
                  return (
                    <div key={file.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        disabled={!canEdit}
                        checked={chosen.includes(file.id)}
                        onCheckedChange={(value) =>
                          form.setValue(
                            'attachmentIds',
                            value === true
                              ? [...chosen, file.id]
                              : chosen.filter((item) => item !== file.id),
                            { shouldDirty: true },
                          )
                        }
                      />
                      <Label htmlFor={id} className="font-normal">
                        {file.fileName}
                      </Label>
                    </div>
                  );
                })}
              </fieldset>
            ) : null}
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            {canEdit ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck aria-hidden="true" />
                  )}
                  {coverage.confirmation ? 'Save changes' : 'Record confirmation'}
                </Button>
              </div>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** Emails the coverage confirmation to the insured (recipients auto-filled from the client, Q3). */
function SendDialog({
  record,
  coverage,
  emphasise,
}: {
  record: ProposalRecord;
  coverage: CoverageConfirmation;
  emphasise: boolean;
}) {
  const setCoverage = useSetCoverage(record.id);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [attachLetter, setAttachLetter] = useState(true);
  const [sendId, setSendId] = useState('');
  const otherId = useId();
  const recorded = coverage.confirmation !== null;
  const extra = other
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const to = [...new Set([...chosen, ...extra])];
  const send = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/coverage-confirmation/email`, {
        method: 'POST',
        body: { sendId, to, attachLetter },
        schema: CoverageConfirmationSendResponseSchema,
      }),
    onSuccess: (result) => {
      setCoverage(result.coverage);
      if (result.outcome === 'SENT') {
        toast({
          title: 'Confirmation sent to the insured',
          description: to.join(', '),
          variant: 'success',
        });
        setOpen(false);
      } else {
        toast({
          title: 'The confirmation was not sent',
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
          // Q3: auto-fill every client contact email, de-duplicated, fresh each time.
          setChosen([...new Set(coverage.recipients.map((item) => item.email.toLowerCase()))]);
          setOther('');
          setAttachLetter(true);
          setSendId(crypto.randomUUID());
          send.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={emphasise ? 'default' : 'outline'} disabled={!recorded}>
          <Mail aria-hidden="true" />
          Send to the insured
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send the coverage confirmation to {record.client.name}</DialogTitle>
          <DialogDescription>
            One mail from the Coverage confirmation email template, optionally with the letter PDF
            attached.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">To</legend>
          {coverage.recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The client has no contact with an email; type the address below.
            </p>
          ) : (
            coverage.recipients.map((recipient) => {
              const id = `coverage-to-${recipient.email}`;
              const email = recipient.email.toLowerCase();
              return (
                <div key={recipient.email} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={chosen.includes(email)}
                    onCheckedChange={(value) =>
                      setChosen((current) =>
                        value === true
                          ? [...new Set([...current, email])]
                          : current.filter((item) => item !== email),
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
        <div className="grid gap-1">
          <Label htmlFor={otherId}>Other addresses</Label>
          <Input
            id={otherId}
            value={other}
            placeholder="name@example.com"
            onChange={(event) => setOther(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={attachLetter}
            onCheckedChange={(value) => setAttachLetter(value === true)}
          />
          Attach the confirmation letter (PDF)
        </label>
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
            disabled={to.length === 0 || send.isPending}
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

function Sends({ coverage }: { coverage: CoverageConfirmation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent to the insured</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 text-sm">
          {coverage.sends.map((send) => (
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
