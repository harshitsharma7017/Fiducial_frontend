'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, FileCheck2, LoaderCircle, Paperclip, Pencil, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { todayIst } from '@/lib/dates';
import { queryKeys } from '@/lib/query-keys';
import {
  CLIENT_APPROVAL_FILE_TYPES,
  ClientApprovalFileSchema,
  ProposalClientApprovalSchema,
  QUOTE_OPTION_LABELS,
  RecordClientApprovalRequestSchema,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type ClientApproval,
  type ClientApprovalChoice,
  type ClientApprovalFile,
  type ProposalClientApproval,
  type ProposalRecord,
  type RecordClientApprovalFormValues,
  type RecordClientApprovalRequest,
} from '@/shared';

// The Client approval tab: once the QCR has gone to the insured, the quote the client accepted
// (insurer and option, Fire with or without terrorism), when and by whom it was confirmed, and the
// client's mail or signed letter. Recording it moves the case to Client Approval.

const ACCEPT = [
  ...Object.keys(CLIENT_APPROVAL_FILE_TYPES),
  ...Object.values(CLIENT_APPROVAL_FILE_TYPES),
].join(',');

const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;
const choiceKey = (choice: { insurerId: string; option: string }) =>
  `${choice.insurerId}|${choice.option}`;

export function ClientApprovalPanel({ record }: { record: ProposalRecord }) {
  const canEdit = usePermission('proposals.edit');
  const query = useQuery({
    queryKey: queryKeys.proposals.clientApproval(record.id),
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${record.id}/client-approval`, {
        schema: ProposalClientApprovalSchema,
        signal,
      }),
  });
  const [editing, setEditing] = useState(false);

  if (query.isPending) return <LoadingState label="Loading the client approval…" />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  const writable = canEdit && data.blocked === null;
  const showForm = writable && (data.approval === null || editing);

  return (
    <div className="grid gap-6">
      {data.approval && !editing ? (
        <ApprovalCard
          record={record}
          approval={data.approval}
          onChange={writable ? () => setEditing(true) : undefined}
        />
      ) : null}
      {data.blocked && (data.approval === null || data.blocked !== 'This case is closed.') ? (
        <Alert variant="info">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>
            {data.approval ? 'The client approval is final' : 'Not ready for the client approval'}
          </AlertTitle>
          <AlertDescription>{data.blocked}</AlertDescription>
        </Alert>
      ) : null}
      {!canEdit && data.approval === null && data.blocked === null ? (
        <p className="text-sm text-muted-foreground">The client’s approval is not recorded yet.</p>
      ) : null}
      {showForm ? (
        <ApprovalForm
          record={record}
          data={data}
          onDone={() => setEditing(false)}
          onCancel={data.approval ? () => setEditing(false) : undefined}
        />
      ) : null}
    </div>
  );
}

function ApprovalCard({
  record,
  approval,
  onChange,
}: {
  record: ProposalRecord;
  approval: ClientApproval;
  onChange?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 aria-hidden="true" className="size-5 text-success" />
            Accepted by the client
          </CardTitle>
          <CardDescription>
            Recorded by {approval.recordedBy}, {formatDateTime(approval.recordedAt)}.
          </CardDescription>
        </div>
        {onChange ? (
          <Button type="button" variant="outline" onClick={onChange}>
            <Pencil aria-hidden="true" />
            Change
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {approval.quoteCurrent ? null : (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>The insurer revised this quote afterwards</AlertTitle>
            <AlertDescription>
              The premium below is version {approval.version}. If the client accepted the revised
              quote, record the approval again.
            </AlertDescription>
          </Alert>
        )}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Insurer">
            {approval.company}, {approval.branch}
          </Fact>
          <Fact label="Option">
            {QUOTE_OPTION_LABELS[approval.option]}
            {approval.version > 1 ? ` (quote version ${approval.version})` : ''}
          </Fact>
          {approval.withTerrorism === null ? null : (
            <Fact label="Fire">
              {approval.withTerrorism ? 'With terrorism' : 'Without terrorism'}
            </Fact>
          )}
          <Fact label="Net premium">{paise(approval.premium.net)}</Fact>
          <Fact label="GST">{paise(approval.premium.gst)}</Fact>
          <Fact label="Total premium">
            <span className="font-semibold">{paise(approval.premium.total)}</span>
          </Fact>
          <Fact label="Accepted on">{formatDate(approval.acceptedOn)}</Fact>
          <Fact label="Confirmed by">{approval.confirmedBy}</Fact>
          {approval.note ? <Fact label="Note">{approval.note}</Fact> : null}
        </dl>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">The client’s confirmation</p>
          <ul className="grid gap-1 text-sm">
            {approval.files.map((file) => (
              <li key={file.id}>
                <a
                  className="text-primary underline-offset-2 hover:underline"
                  href={`/api/proxy/proposals/${record.id}/client-approval/files/${file.id}`}
                >
                  {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

function defaultsOf(data: ProposalClientApproval): RecordClientApprovalFormValues {
  const approval = data.approval;
  const preferred = approval
    ? undefined
    : (data.choices.find((choice) => choice.recommended) ?? data.choices[0]);
  return {
    insurerId: approval?.insurerId ?? preferred?.insurerId ?? '',
    option: approval?.option ?? preferred?.option ?? 'P1',
    withTerrorism: approval?.withTerrorism ?? null,
    acceptedOn: approval?.acceptedOn ?? todayIst(),
    confirmedBy: approval?.confirmedBy ?? data.contacts[0] ?? '',
    note: approval?.note ?? '',
    attachmentIds: approval?.files.map((file) => file.id) ?? [],
  };
}

function ApprovalForm({
  record,
  data,
  onDone,
  onCancel,
}: {
  record: ProposalRecord;
  data: ProposalClientApproval;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<RecordClientApprovalFormValues, unknown, RecordClientApprovalRequest>({
    resolver: zodResolver(RecordClientApprovalRequestSchema),
    defaultValues: defaultsOf(data),
  });
  const save = useMutation({
    mutationFn: (body: RecordClientApprovalRequest) =>
      apiFetch(`proposals/${record.id}/client-approval`, {
        method: 'PUT',
        body,
        schema: ProposalClientApprovalSchema,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.proposals.clientApproval(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(record.id) });
      toast({
        title: data.approval ? 'Client approval changed' : 'Client approval recorded',
        description: data.approval ? undefined : 'The case moved to Client Approval.',
        variant: 'success',
      });
      onDone();
    },
  });
  const [insurerId, option, withTerrorism] = [
    useWatch({ control: form.control, name: 'insurerId' }),
    useWatch({ control: form.control, name: 'option' }),
    useWatch({ control: form.control, name: 'withTerrorism' }),
  ];
  const chosen = data.choices.find(
    (choice) => choice.insurerId === insurerId && choice.option === option,
  );
  const bothWays = chosen?.withoutTerrorism != null;
  // A quote with Fire one way only takes no choice.
  useEffect(() => {
    if (!bothWays && withTerrorism !== null) form.setValue('withTerrorism', null);
  }, [bothWays, withTerrorism, form]);
  const contactsId = useId();
  const serverIssue =
    save.error instanceof ApiError && Array.isArray(save.error.details)
      ? (save.error.details as { message?: string }[]).map((item) => item.message).join(' ')
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {data.approval ? 'Change the client approval' : 'Record the client approval'}
        </CardTitle>
        <CardDescription>
          The quote the client accepted from the QCR, with the client’s mail or signed letter.
          Recording it moves the case to Client Approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-5"
            onSubmit={(event) =>
              void form.handleSubmit((values) => {
                // The terrorism choice is asked for below; nothing is sent until it is made.
                if (!(bothWays && values.withTerrorism === null)) save.mutate(values);
              })(event)
            }
          >
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Quote accepted</legend>
              {data.choices.length === 0 ? (
                <p className="text-sm text-muted-foreground">The QCR compares no quotes.</p>
              ) : (
                data.choices.map((choice) => (
                  <ChoiceRow
                    key={choiceKey(choice)}
                    choice={choice}
                    checked={chosen !== undefined && choiceKey(chosen) === choiceKey(choice)}
                    onSelect={() => {
                      form.setValue('insurerId', choice.insurerId, { shouldDirty: true });
                      form.setValue('option', choice.option, { shouldDirty: true });
                    }}
                  />
                ))
              )}
              {form.formState.errors.insurerId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.insurerId.message}
                </p>
              ) : null}
            </fieldset>

            {chosen && chosen.withoutTerrorism ? (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Fire</legend>
                {[
                  { value: false, label: 'Without terrorism', totals: chosen.withoutTerrorism },
                  { value: true, label: 'With terrorism', totals: chosen.withTerrorism },
                ].map((item) => (
                  <label key={item.label} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="client-approval-terrorism"
                      checked={withTerrorism === item.value}
                      onChange={() =>
                        form.setValue('withTerrorism', item.value, { shouldDirty: true })
                      }
                      className="size-4 accent-primary"
                    />
                    {item.label}
                    <span className="text-muted-foreground tabular">
                      — total {paise(item.totals.total)}
                    </span>
                  </label>
                ))}
                {bothWays && withTerrorism === null && form.formState.isSubmitted ? (
                  <p className="text-xs text-destructive">
                    Say whether the client takes Fire with or without terrorism.
                  </p>
                ) : null}
              </fieldset>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="acceptedOn"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Accepted on</FormLabel>
                    <FormControl>
                      <Input type="date" max={todayIst()} {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmedBy"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel>Confirmed by</FormLabel>
                    <FormControl>
                      <Input list={contactsId} maxLength={200} {...field} />
                    </FormControl>
                    <datalist id={contactsId}>
                      {data.contacts.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
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
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Confirmation
              record={record}
              files={data.files}
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
              <Button type="submit" disabled={save.isPending || data.choices.length === 0}>
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileCheck2 aria-hidden="true" />
                )}
                {data.approval ? 'Save the change' : 'Record client approval'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ChoiceRow({
  choice,
  checked,
  onSelect,
}: {
  choice: ClientApprovalChoice;
  checked: boolean;
  onSelect: () => void;
}) {
  const id = `client-approval-${choiceKey(choice)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2">
      <input
        id={id}
        type="radio"
        name="client-approval-choice"
        checked={checked}
        onChange={onSelect}
        className="size-4 accent-primary"
      />
      <Label htmlFor={id} className="font-normal">
        <span className="font-medium">
          {choice.company}, {choice.branch}
        </span>{' '}
        — {QUOTE_OPTION_LABELS[choice.option]}
      </Label>
      {choice.recommended ? <Badge variant="info">Recommended in the QCR</Badge> : null}
      {choice.lowest ? <Badge variant="success">Lowest</Badge> : null}
      <span className="ml-auto text-sm text-muted-foreground tabular">
        {choice.withoutTerrorism
          ? `${paise(choice.withoutTerrorism.total)} without terrorism · ${paise(choice.withTerrorism.total)} with`
          : `Total ${paise(choice.withTerrorism.total)}`}
      </span>
    </div>
  );
}

/** The client's mail or signed letter: upload one, or tick one already kept for this case. */
function Confirmation({
  record,
  files,
  control,
  setValue,
  error,
}: {
  record: ProposalRecord;
  files: readonly ClientApprovalFile[];
  control: Control<RecordClientApprovalFormValues, unknown, RecordClientApprovalRequest>;
  setValue: (value: string[]) => void;
  error: string | undefined;
}) {
  const queryClient = useQueryClient();
  const chosen = useWatch({ control, name: 'attachmentIds' }) ?? [];
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiFetch(
        `proposals/${record.id}/client-approval/files?fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          body: new Blob([file], { type: file.type || 'application/octet-stream' }),
          schema: ClientApprovalFileSchema,
        },
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<ProposalClientApproval>(
        queryKeys.proposals.clientApproval(record.id),
        (current) => (current ? { ...current, files: [...current.files, saved] } : current),
      );
      setValue([...chosen, saved.id]);
    },
  });
  const toggle = (id: string, on: boolean) =>
    setValue(on ? [...chosen, id] : chosen.filter((item) => item !== id));

  return (
    <section aria-labelledby="client-approval-proof" className="grid gap-2">
      <h3 id="client-approval-proof" className="text-sm font-semibold">
        The client’s mail or signed letter (required)
      </h3>
      {files.length > 0 ? (
        <ul className="grid gap-1">
          {files.map((file) => {
            const id = `client-file-${file.id}`;
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
                  href={`/api/proxy/proposals/${record.id}/client-approval/files/${file.id}`}
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
          aria-label="Client’s mail or signed letter"
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
          Upload mail or letter
        </Button>
        <span className="text-xs text-muted-foreground">
          <Paperclip aria-hidden="true" className="mr-1 inline size-3" />
          .eml, .msg, .pdf, .png or .jpg, up to 10 MB
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
