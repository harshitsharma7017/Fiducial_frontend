'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/use-permission';
import { ApiError, apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  QCR_STATUS_LABELS,
  QUOTE_OPTION_LABELS,
  QcrSchema,
  QcrSendResponseSchema,
  SaveQcrRequestSchema,
  formatDateTime,
  type ProposalRecord,
  type Qcr,
  type QuoteOption,
  type SaveQcrFormValues,
  type SaveQcrRequest,
} from '@/shared';
import { QcrComparison } from './qcr-comparison';

// The QCR tab (QC-1 to QC-6): the comparison, the broker's recommendation, remarks and payment,
// approval of exactly what is shown, the downloads, and the mail to the insured once approved.

export function QcrPanel({ record }: { record: ProposalRecord }) {
  const canEdit = usePermission('proposals.edit') && record.stage !== 'CLOSED';
  const canApprove = usePermission('proposals.approve');
  const canSend = usePermission('proposals.send');
  const qcr = useQuery({
    queryKey: queryKeys.proposals.qcr(record.id),
    queryFn: ({ signal }) => apiFetch(`proposals/${record.id}/qcr`, { schema: QcrSchema, signal }),
  });
  const [dirty, setDirty] = useState(false);

  if (qcr.isPending) return <LoadingState label="Loading the QCR…" />;
  if (qcr.isError) return <ErrorState error={qcr.error} onRetry={() => void qcr.refetch()} />;
  const data = qcr.data;
  return (
    <div className="grid gap-6">
      <StatusCard
        record={record}
        qcr={data}
        canApprove={canApprove && record.stage !== 'CLOSED'}
        canSend={canSend && record.stage !== 'CLOSED'}
        unsaved={dirty}
      />
      <QcrComparison qcr={data} renewal={record.type === 'EXISTING'} />
      <BrokerCard record={record} qcr={data} readOnly={!canEdit} onDirty={setDirty} />
      {data.sends.length > 0 ? <Sends qcr={data} /> : null}
    </div>
  );
}

function useSetQcr(id: string) {
  const queryClient = useQueryClient();
  return (saved: Qcr) => {
    queryClient.setQueryData(queryKeys.proposals.qcr(id), saved);
    void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(id) });
  };
}

function StatusCard({
  record,
  qcr,
  canApprove,
  canSend,
  unsaved,
}: {
  record: ProposalRecord;
  qcr: Qcr;
  canApprove: boolean;
  canSend: boolean;
  unsaved: boolean;
}) {
  const setQcr = useSetQcr(record.id);
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/qcr/approve`, {
        method: 'POST',
        body: { fingerprint: qcr.fingerprint },
        schema: QcrSchema,
      }),
    onSuccess: (saved) => {
      setQcr(saved);
      toast({ title: 'QCR approved', variant: 'success' });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'QCR_CHANGED') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.qcr(record.id) });
      }
    },
  });
  const download = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      apiDownload(
        `proposals/${record.id}/qcr/document?format=${format}`,
        `QCR-${record.reference}.${format}`,
      ),
    onSuccess: (file) => saveFile(file),
  });
  const anyQuote = qcr.options.some((option) => option.quotes.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            Quote comparison report
            <Badge
              variant={
                qcr.status === 'DRAFT' ? 'muted' : qcr.status === 'APPROVED' ? 'info' : 'success'
              }
            >
              {QCR_STATUS_LABELS[qcr.status]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {qcr.approval
              ? qcr.approval.current
                ? `Approved by ${qcr.approval.by}, ${formatDateTime(qcr.approval.at)}.`
                : `Approved by ${qcr.approval.by}, ${formatDateTime(qcr.approval.at)}, but it changed since: approve it again before sending.`
              : 'Not approved yet. Only an approved QCR can be sent to the insured.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['xlsx', 'pdf'] as const).map((format) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              disabled={!anyQuote || download.isPending}
              onClick={() => download.mutate(format)}
            >
              {download.isPending && download.variables === format ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : format === 'pdf' ? (
                <FileText aria-hidden="true" />
              ) : (
                <Download aria-hidden="true" />
              )}
              Download QCR ({format === 'pdf' ? 'PDF' : 'Excel'})
            </Button>
          ))}
          {canApprove && qcr.status === 'DRAFT' ? (
            <Button
              type="button"
              disabled={qcr.missing.length > 0 || unsaved || approve.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              Approve QCR
            </Button>
          ) : null}
          {canSend ? <SendDialog record={record} qcr={qcr} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {qcr.missing.length > 0 ? (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Needed before approval</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {qcr.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : qcr.status === 'DRAFT' ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheck aria-hidden="true" className="size-4 text-success" />
            Ready for approval{unsaved ? ' once the changes below are saved' : ''}.
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

const choiceKey = (insurerId: string, option: QuoteOption) => `${insurerId}|${option}`;

function formValues(qcr: Qcr): SaveQcrFormValues {
  return {
    recommendedInsurerId: qcr.recommendedInsurerId,
    recommendedOption: qcr.recommendedOption,
    recommendation: qcr.recommendation ?? '',
    remarks: qcr.remarks ?? '',
    paymentInFavourOf: qcr.paymentInFavourOf ?? '',
  };
}

/** The broker's part (QC-3): recommendation, remarks and "cheque / payment in favour of". */
function BrokerCard({
  record,
  qcr,
  readOnly,
  onDirty,
}: {
  record: ProposalRecord;
  qcr: Qcr;
  readOnly: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const setQcr = useSetQcr(record.id);
  const form = useForm<SaveQcrFormValues, unknown, SaveQcrRequest>({
    resolver: zodResolver(SaveQcrRequestSchema),
    defaultValues: formValues(qcr),
    disabled: readOnly,
  });
  const { isDirty } = form.formState;
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(formValues(qcr));
  }, [qcr, form]);
  const save = useMutation({
    mutationFn: (body: SaveQcrRequest) =>
      apiFetch(`proposals/${record.id}/qcr`, { method: 'PUT', body, schema: QcrSchema }),
    onSuccess: (saved) => {
      setQcr(saved);
      form.reset(formValues(saved));
      toast({
        title: 'QCR saved',
        description: qcr.approval?.current ? 'The change needs approval again.' : undefined,
        variant: 'success',
      });
    },
  });
  const [insurerId, option] = [
    useWatch({ control: form.control, name: 'recommendedInsurerId' }),
    useWatch({ control: form.control, name: 'recommendedOption' }),
  ];
  const choices = qcr.options.flatMap((item) =>
    item.quotes.map((quote) => {
      const insurer = qcr.insurers.find((entry) => entry.insurerId === quote.insurerId);
      return {
        key: choiceKey(quote.insurerId, item.option),
        insurerId: quote.insurerId,
        option: item.option,
        label: `${insurer ? `${insurer.company}, ${insurer.branch}` : ''} — ${QUOTE_OPTION_LABELS[item.option]}${quote.lowest ? ' (lowest)' : ''}`,
      };
    }),
  );
  const recommended = qcr.insurers.find((insurer) => insurer.insurerId === insurerId);
  const selectId = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendation and payment</CardTitle>
        <CardDescription>
          Printed on the QCR. Changing them after approval needs approval again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}
          >
            <div className="grid gap-1">
              <Label htmlFor={selectId}>Recommended insurer and option</Label>
              <NativeSelect
                id={selectId}
                disabled={readOnly}
                value={insurerId && option ? choiceKey(insurerId, option) : ''}
                onChange={(event) => {
                  const choice = choices.find((item) => item.key === event.target.value);
                  form.setValue('recommendedInsurerId', choice?.insurerId ?? null, {
                    shouldDirty: true,
                  });
                  form.setValue('recommendedOption', choice?.option ?? null, { shouldDirty: true });
                }}
              >
                <option value="">Not chosen</option>
                {choices.map((choice) => (
                  <option key={choice.key} value={choice.key}>
                    {choice.label}
                  </option>
                ))}
              </NativeSelect>
              {form.formState.errors.recommendedOption ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.recommendedOption.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextAreaField form={form} name="recommendation" label="Recommendation" />
              <TextAreaField form={form} name="remarks" label="Remarks" />
            </div>
            <FormField
              control={form.control}
              name="paymentInFavourOf"
              render={({ field }) => (
                <FormItem className="gap-1 sm:max-w-lg">
                  <FormLabel>Cheque / payment in favour of</FormLabel>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      disabled={field.disabled}
                      maxLength={300}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  {recommended && !readOnly && field.value !== recommended.company ? (
                    <FormDescription>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() =>
                          form.setValue('paymentInFavourOf', recommended.company, {
                            shouldDirty: true,
                          })
                        }
                      >
                        Use {recommended.company}
                      </Button>
                    </FormDescription>
                  ) : null}
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            {readOnly ? null : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {isDirty
                    ? 'Unsaved changes'
                    : qcr.updatedAt
                      ? `Saved by ${qcr.updatedBy ?? 'unknown'}, ${formatDateTime(qcr.updatedAt)}`
                      : 'Not saved yet'}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isDirty || save.isPending}
                    onClick={() => form.reset(formValues(qcr))}
                  >
                    Discard changes
                  </Button>
                  <Button type="submit" disabled={!isDirty || save.isPending}>
                    {save.isPending ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function TextAreaField({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<SaveQcrFormValues, unknown, SaveQcrRequest>>;
  name: 'recommendation' | 'remarks';
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              rows={3}
              maxLength={2000}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              disabled={field.disabled}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

/** Mails the approved QCR to the insured's chosen contacts (QC-6). */
function SendDialog({ record, qcr }: { record: ProposalRecord; qcr: Qcr }) {
  const setQcr = useSetQcr(record.id);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [sendId, setSendId] = useState('');
  const otherId = useId();
  const approved = qcr.status !== 'DRAFT';
  const extra = other
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  // chosen is already lower-cased; dedup so an address typed again is never mailed twice.
  const to = [...new Set([...chosen, ...extra])];
  const send = useMutation({
    mutationFn: () =>
      apiFetch(`proposals/${record.id}/qcr/email`, {
        method: 'POST',
        body: { sendId, to, format },
        schema: QcrSendResponseSchema,
      }),
    onSuccess: (result) => {
      setQcr(result.qcr);
      if (result.outcome === 'SENT') {
        toast({ title: 'QCR sent to the insured', description: to.join(', '), variant: 'success' });
        setOpen(false);
      } else {
        toast({
          title: 'The QCR was not sent',
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
          // Q3: auto-fill every contact email of the selected insured from the client master.
          // Opening afresh each time means a different case never keeps the previous one's
          // addresses. "Other addresses" below stays free for extra recipients.
          setChosen([...new Set(qcr.recipients.map((recipient) => recipient.email.toLowerCase()))]);
          setOther('');
          setSendId(crypto.randomUUID());
          send.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={approved ? 'default' : 'outline'} disabled={!approved}>
          <Mail aria-hidden="true" />
          Send to the insured
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send the QCR to {record.client.name}</DialogTitle>
          <DialogDescription>
            One mail from the QCR email template, with the approved QCR attached.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">To</legend>
          {qcr.recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The client has no contact with an email; type the address below.
            </p>
          ) : (
            qcr.recipients.map((recipient) => {
              const id = `qcr-to-${recipient.email}`;
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
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm font-medium">Attach as</legend>
          {(['pdf', 'xlsx'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="qcr-format"
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

function Sends({ qcr }: { qcr: Qcr }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent to the insured</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 text-sm">
          {qcr.sends.map((send) => (
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
