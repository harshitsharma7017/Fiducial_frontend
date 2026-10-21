'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, FileText, LoaderCircle, Paperclip, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { SumInsuredInput } from '@/components/rating/sum-insured-input';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { FillReview, applyExtraction, type FillSummary } from './quote-autofill';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { formatInr } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import {
  ProposalQuotesSchema,
  QUOTE_ATTACHMENT_TYPES,
  QUOTE_OPTION_LABELS,
  QuoteAttachmentSchema,
  QuoteExtractionSchema,
  RecordQuoteRequestSchema,
  formatIndianNumber,
  quoteDeviations,
  quoteTotals,
  wholeRupees,
  type ProposalQuotes,
  type ProposalRecord,
  type QuoteAttachment,
  type QuoteExtraction,
  type QuoteExpectation,
  type QuoteOption,
  type QuoteVersion,
  type RecordQuoteFormValues,
  type RecordQuoteRequest,
} from '@/shared';

// The quote entry form (Q-1 to Q-4): one insurer, one option. The premiums of the sections the
// RFQ asked for, Fire with and without terrorism, add up to net, GST and total as you type; the
// insurer's terms are checked against the RFQ; the insurer's mail or PDF is required.

const ACCEPT = [
  ...Object.keys(QUOTE_ATTACHMENT_TYPES),
  ...Object.values(QUOTE_ATTACHMENT_TYPES),
].join(',');

const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;

function defaultsOf(
  option: QuoteOption,
  expectation: QuoteExpectation,
  latest: QuoteVersion | undefined,
): RecordQuoteFormValues {
  const quoted = new Map(latest?.sections.map((section) => [section.code, section]));
  return {
    option,
    reason: '',
    sections: expectation.sections.map((section) => {
      const last = quoted.get(section.code);
      return {
        code: section.code,
        sumInsured: last?.sumInsured ?? '',
        premium: last?.premium ?? '',
        premiumWithoutTerrorism: last?.premiumWithoutTerrorism ?? '',
      };
    }),
    terms: latest?.terms ?? [],
    deductibles: latest?.deductibles ?? '',
    capacityPercent: latest?.capacityPercent ?? '',
    conditions: latest?.conditions ?? '',
    validUntil: latest?.validUntil ?? '',
    // The proof is chosen again for every version.
    attachmentIds: [],
  };
}

export interface QuoteTarget {
  insurerId: string;
  name: string;
  option: QuoteOption;
  expectation: QuoteExpectation;
  latest: QuoteVersion | undefined;
}

export function QuoteFormSheet({
  record,
  quotes,
  target,
  onClose,
}: {
  record: ProposalRecord;
  quotes: ProposalQuotes;
  target: QuoteTarget | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {target ? (
          <QuoteForm
            key={`${target.insurerId}-${target.option}-${target.latest?.version ?? 0}`}
            record={record}
            quotes={quotes}
            target={target}
            onSaved={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function QuoteForm({
  record,
  quotes,
  target,
  onSaved,
}: {
  record: ProposalRecord;
  quotes: ProposalQuotes;
  target: QuoteTarget;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { insurerId, name, option, expectation, latest } = target;
  const revising = latest !== undefined;
  const form = useForm<RecordQuoteFormValues, unknown, RecordQuoteRequest>({
    resolver: zodResolver(RecordQuoteRequestSchema),
    defaultValues: defaultsOf(option, expectation, latest),
  });

  const save = useMutation({
    mutationFn: (body: RecordQuoteRequest) =>
      apiFetch(`proposals/${record.id}/insurers/${insurerId}/quotes`, {
        method: 'POST',
        body,
        schema: ProposalQuotesSchema,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.proposals.quotes(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(record.id) });
      toast({
        title: `${name}: ${QUOTE_OPTION_LABELS[option]} quote saved`,
        description: revising ? `Version ${latest.version + 1}` : undefined,
        variant: 'success',
      });
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        for (const detail of error.details as { path?: unknown; message?: unknown }[]) {
          if (detail.path === 'reason' && typeof detail.message === 'string') {
            form.setError('reason', { message: detail.message });
          }
        }
      }
    },
  });

  // Q1: values filled from the insurer's PDF must be checked before the quote is saved.
  const [fill, setFill] = useState<FillSummary | null>(null);
  const [fillChecked, setFillChecked] = useState(false);
  const [fillError, setFillError] = useState(false);
  const fillUnchecked = () => {
    if (!fill || fill.manualEntryRequired || fillChecked) return false;
    setFillError(true);
    return true;
  };
  const onFill = (fileName: string, extraction: QuoteExtraction) => {
    setFill(
      applyExtraction(extraction, fileName, expectation, (path, value, options) =>
        form.setValue(path as 'validUntil', value, options),
      ),
    );
    setFillChecked(false);
    setFillError(false);
    if (
      !extraction.manualEntryRequired &&
      !form.getValues('attachmentIds')?.includes(extraction.attachmentId)
    ) {
      form.setValue(
        'attachmentIds',
        [...(form.getValues('attachmentIds') ?? []), extraction.attachmentId],
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    }
  };

  // A revision needs its reason (Q-4); it is asked for with the other missing entries.
  const reasonMissing = () => {
    if (!revising || form.getValues('reason')?.trim()) return false;
    form.setError('reason', { message: 'Say why the quote was revised' });
    return true;
  };
  const onSubmit = form.handleSubmit(
    (values) => {
      const reason = reasonMissing();
      const unchecked = fillUnchecked();
      if (!reason && !unchecked) save.mutate(values);
    },
    () => {
      reasonMissing();
      fillUnchecked();
    },
  );

  return (
    <Form {...form}>
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="grid gap-6 pb-6">
        <SheetHeader>
          <SheetTitle>
            {name}: {QUOTE_OPTION_LABELS[option]}
          </SheetTitle>
          <SheetDescription>
            {revising
              ? `Revising version ${latest.version}: this saves version ${latest.version + 1}. Earlier versions are kept.`
              : 'The premium of each section the RFQ asked for. Net, GST and total add up as you type.'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-4">
          <section aria-labelledby="quote-premiums" className="grid gap-2">
            <h3 id="quote-premiums" className="text-sm font-semibold">
              Premiums
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">RFQ sum insured</TableHead>
                  <TableHead className="text-right">Quoted on</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expectation.sections.map((section, index) => (
                  <TableRow key={section.code}>
                    <TableCell className="align-top whitespace-normal">{section.name}</TableCell>
                    <TableCell className="text-right align-top tabular whitespace-nowrap">
                      {section.sumInsured ? formatInr(wholeRupees(section.sumInsured)) : '—'}
                    </TableCell>
                    <TableCell className="align-top">
                      <AmountField
                        control={form.control}
                        name={`sections.${index}.sumInsured`}
                        label={`${section.name} sum insured quoted`}
                        placeholder="As asked"
                        whole
                      />
                    </TableCell>
                    <TableCell className="grid gap-1 align-top">
                      <AmountField
                        control={form.control}
                        name={`sections.${index}.premium`}
                        label={section.code === 'FIRE' ? 'Fire premium' : `${section.name} premium`}
                        placeholder={section.code === 'FIRE' ? 'With terrorism' : 'Premium'}
                        caption={section.code === 'FIRE' ? 'With terrorism' : undefined}
                      />
                      {section.code === 'FIRE' ? (
                        <AmountField
                          control={form.control}
                          name={`sections.${index}.premiumWithoutTerrorism`}
                          label="Fire premium"
                          placeholder="Without terrorism"
                          caption="Without terrorism"
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <Totals control={form.control} gstRatePercent={quotes.gstRatePercent} />
            </Table>
            {(form.formState.errors.sections?.root?.message ??
            form.formState.errors.sections?.message) ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.sections.root?.message ??
                  form.formState.errors.sections.message}
              </p>
            ) : null}
          </section>

          <Terms control={form.control} asked={expectation.asked} setValue={form.setValue} />

          <section aria-labelledby="quote-terms" className="grid gap-3 sm:grid-cols-2">
            <h3 id="quote-terms" className="text-sm font-semibold sm:col-span-2">
              The insurer’s terms
            </h3>
            <TextAreaInput control={form.control} name="deductibles" label="Deductibles" />
            <TextAreaInput control={form.control} name="conditions" label="Conditions" />
            <FormField
              control={form.control}
              name="capacityPercent"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <FormLabel>Capacity (% of the risk)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                      placeholder="100"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <FormLabel>Valid until</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
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
          </section>

          <Proof
            onFill={onFill}
            record={record}
            insurerId={insurerId}
            attachments={quotes.attachments.filter((item) => item.insurerId === insurerId)}
            control={form.control}
            setValue={form.setValue}
            error={form.formState.errors.attachmentIds?.message}
          />

          {fill ? (
            <FillReview
              summary={fill}
              checked={fillChecked}
              onChecked={setFillChecked}
              showError={fillError}
            />
          ) : null}

          {revising ? (
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <FormLabel>Why the quote was revised</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={500}
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
          ) : null}

          <Deviations
            control={form.control}
            expectation={expectation}
            policyStart={record.policyStart}
          />

          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {errorMessage(save.error)}
                {save.error instanceof ApiError && Array.isArray(save.error.details) ? (
                  <ul className="list-disc pl-4">
                    {(save.error.details as { message?: string }[]).map((detail, index) => (
                      <li key={index}>{detail.message}</li>
                    ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSaved}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {revising ? `Save version ${latest.version + 1}` : 'Save quote'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

type QuoteControl = Control<RecordQuoteFormValues, unknown, RecordQuoteRequest>;
type AmountPath =
  | `sections.${number}.sumInsured`
  | `sections.${number}.premium`
  | `sections.${number}.premiumWithoutTerrorism`;

function AmountField({
  control,
  name,
  label,
  placeholder,
  whole = false,
  caption,
}: {
  control: QuoteControl;
  name: AmountPath;
  label: string;
  placeholder: string;
  whole?: boolean;
  /** A visible caption above the input (Fire's two premiums). */
  caption?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1">
          <FormLabel className={caption ? 'text-xs font-normal text-muted-foreground' : 'sr-only'}>
            {caption ? (
              <>
                <span className="sr-only">{label} </span>
                {caption}
              </>
            ) : (
              label
            )}
          </FormLabel>
          <FormControl>
            <SumInsuredInput
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={typeof field.value === 'string' ? field.value : ''}
              placeholder={placeholder}
              onValueChange={(value) => field.onChange(whole ? (value.split('.')[0] ?? '') : value)}
              className="min-w-36 text-right"
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

function TextAreaInput({
  control,
  name,
  label,
}: {
  control: QuoteControl;
  name: 'deductibles' | 'conditions';
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              rows={3}
              maxLength={name === 'deductibles' ? 2000 : 4000}
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
  );
}

/** Net, GST and total as typed, with terrorism and (when Fire has it) without. */
function Totals({ control, gstRatePercent }: { control: QuoteControl; gstRatePercent: string }) {
  const sections = useWatch({ control, name: 'sections' }) ?? [];
  const totals = quoteTotals(
    sections.map((section) => ({
      code: section.code,
      premium: section.premium ?? null,
      premiumWithoutTerrorism: section.premiumWithoutTerrorism ?? null,
    })),
    gstRatePercent,
  );
  const rows: [string, string, string | undefined][] = [
    ['Net premium', totals.withTerrorism.net, totals.withoutTerrorism?.net],
    [`GST ${gstRatePercent}%`, totals.withTerrorism.gst, totals.withoutTerrorism?.gst],
    ['Total premium', totals.withTerrorism.total, totals.withoutTerrorism?.total],
  ];
  return (
    <TableFooter aria-live="polite">
      {rows.map(([label, withTerrorism, without]) => (
        <TableRow key={label}>
          <TableCell colSpan={3} className="font-medium">
            {label}
          </TableCell>
          <TableCell className="text-right tabular whitespace-nowrap">
            <span className="block font-medium">{paise(withTerrorism)}</span>
            {without ? (
              <span className="block text-xs text-muted-foreground">
                without terrorism {paise(without)}
              </span>
            ) : null}
          </TableCell>
        </TableRow>
      ))}
    </TableFooter>
  );
}

/** The add-ons and covers the RFQ asked for: did the insurer accept each? (Q-2) */
function Terms({
  control,
  asked,
  setValue,
}: {
  control: QuoteControl;
  asked: readonly string[];
  setValue: (name: 'terms', value: { name: string; accepted: boolean }[], options: object) => void;
}) {
  const terms = useWatch({ control, name: 'terms' }) ?? [];
  if (asked.length === 0) return null;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">Add-ons and covers asked for</legend>
      <ul className="grid gap-1.5">
        {asked.map((item) => {
          const answer = terms.find((term) => term.name === item)?.accepted ?? null;
          const choose = (accepted: boolean) => {
            const others = terms.filter((term) => term.name !== item);
            setValue(
              'terms',
              answer === accepted ? others : [...others, { name: item, accepted }],
              {
                shouldDirty: true,
              },
            );
          };
          return (
            <li
              key={item}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5"
            >
              <span className="text-sm">{item}</span>
              <span role="group" aria-label={item} className="flex gap-1">
                {([true, false] as const).map((accepted) => (
                  <Button
                    key={String(accepted)}
                    type="button"
                    size="sm"
                    variant={answer === accepted ? 'default' : 'outline'}
                    aria-pressed={answer === accepted}
                    className="h-7 px-2 text-xs"
                    onClick={() => choose(accepted)}
                  >
                    {accepted ? 'Accepted' : 'Declined'}
                  </Button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** The insurer's mail or PDF (Q-3): upload one, or pick one already kept for this insurer. */
function Proof({
  onFill,
  record,
  insurerId,
  attachments,
  control,
  setValue,
  error,
}: {
  onFill: (fileName: string, extraction: QuoteExtraction) => void;
  record: ProposalRecord;
  insurerId: string;
  attachments: readonly QuoteAttachment[];
  control: QuoteControl;
  setValue: (name: 'attachmentIds', value: string[], options: object) => void;
  error: string | undefined;
}) {
  const queryClient = useQueryClient();
  const chosen = useWatch({ control, name: 'attachmentIds' }) ?? [];
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiFetch(
        `proposals/${record.id}/insurers/${insurerId}/quote-attachments?fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          body: new Blob([file], { type: file.type || 'application/octet-stream' }),
          schema: QuoteAttachmentSchema,
        },
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<ProposalQuotes>(queryKeys.proposals.quotes(record.id), (current) =>
        current ? { ...current, attachments: [...current.attachments, saved] } : current,
      );
      setValue('attachmentIds', [...chosen, saved.id], { shouldDirty: true, shouldValidate: true });
    },
  });
  // Q1: reads a kept PDF into candidate values for the form (nothing is saved).
  const read = useMutation({
    mutationFn: (attachment: QuoteAttachment) =>
      apiFetch(`proposals/${record.id}/quote-attachments/${attachment.id}/read`, {
        method: 'POST',
        schema: QuoteExtractionSchema,
      }).then((extraction) => ({ extraction, fileName: attachment.fileName })),
    onSuccess: ({ extraction, fileName }) => onFill(fileName, extraction),
  });
  const toggle = (id: string, on: boolean) =>
    setValue('attachmentIds', on ? [...chosen, id] : chosen.filter((item) => item !== id), {
      shouldDirty: true,
      shouldValidate: true,
    });

  return (
    <section aria-labelledby="quote-proof" className="grid gap-2">
      <h3 id="quote-proof" className="text-sm font-semibold">
        The insurer’s mail or PDF (required)
      </h3>
      {attachments.length > 0 ? (
        <ul className="grid gap-1">
          {attachments.map((attachment) => {
            const id = `proof-${attachment.id}`;
            return (
              <li key={attachment.id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={chosen.includes(attachment.id)}
                  onCheckedChange={(value) => toggle(attachment.id, value === true)}
                />
                <Label htmlFor={id} className="font-normal">
                  {attachment.fileName}
                </Label>
                <a
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  href={`/api/proxy/proposals/${record.id}/quote-attachments/${attachment.id}`}
                >
                  Download
                </a>
                {attachment.contentType === 'application/pdf' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={read.isPending}
                    onClick={() => read.mutate(attachment)}
                  >
                    {read.isPending && read.variables?.id === attachment.id ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : (
                      <FileText aria-hidden="true" />
                    )}
                    Fill the form from this PDF
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Insurer’s mail or PDF"
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
          Upload mail or PDF
        </Button>
        <span className="text-xs text-muted-foreground">
          <Paperclip aria-hidden="true" className="mr-1 inline size-3" />
          .eml, .msg, .pdf, .png or .jpg, up to 10 MB
        </span>
      </div>
      {read.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(read.error)}
        </p>
      ) : null}
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

/** Where the quote, as typed, departs from the RFQ (Q-2). */
function Deviations({
  control,
  expectation,
  policyStart,
}: {
  control: QuoteControl;
  expectation: QuoteExpectation;
  policyStart: string | null;
}) {
  const values = useWatch({ control });
  const deviations = quoteDeviations(
    expectation,
    {
      sections: (values.sections ?? []).map((section) => ({
        code: section?.code ?? '',
        sumInsured: /^\d+$/.test(section?.sumInsured ?? '') ? (section?.sumInsured ?? null) : null,
        premium: section?.premium?.trim() ? section.premium : null,
      })),
      terms: (values.terms ?? []).flatMap((term) =>
        term?.name !== undefined && term.accepted !== undefined
          ? [{ name: term.name, accepted: term.accepted }]
          : [],
      ),
      capacityPercent: values.capacityPercent?.trim() ? values.capacityPercent : null,
      validUntil: values.validUntil || null,
    },
    policyStart,
  );
  if (deviations.length === 0) return null;
  return (
    <Alert variant="warning" aria-live="polite">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>Departs from the RFQ</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {deviations.map((deviation) => (
            <li key={deviation}>{deviation}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
