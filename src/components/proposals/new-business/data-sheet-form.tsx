'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, LoaderCircle, Lock, Plus, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { DataSheetImportControl } from './data-sheet-import';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { clientLocationsQuery } from '@/lib/api/new-business';
import {
  blankLocation,
  contentsOptions,
  contentsTotal,
  fireGroupTotals,
  fireTotal,
  onBasis,
  sectionOption2,
  sectionSumInsured,
  sumOfLines,
  sumRupeesOf,
  toDataSheetForm,
  toDataSheetRequest,
  type DataSheetForm as DataSheetFormValues,
} from '@/lib/data-sheet';
import { formatInr } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import {
  DataSheetInputSchema,
  FIRE_GROUP_LABELS,
  FIRE_GROUPS,
  MAX_CLAIM_ROWS,
  OTHER_SECTION_LABELS,
  SECTION_LINES,
  SUM_INSURED_FROM,
  SUM_INSURED_LINES,
  hasBasis,
  isAnnexureSection,
  ProposalRecordSchema,
  formatDateTime,
  type ClientLocation,
  type DataSheetInput,
  type ProposalRecord,
} from '@/shared';
import { RupeesField, TextAreaField, TextField } from './data-sheet-fields';
import { AnnexureGrid, BasisField, CoverToggles, SectionLines } from './section-details';
import { LocationCard, type LocationInfo } from './location-card';
import { ProductAndAddons, useProductChoice } from './product-addons';

/** The field messages of a 400 from the API, as { path, message }. */
function fieldIssues(error: unknown): { path: string; message: string }[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return error.details.flatMap((detail: unknown) => {
    if (typeof detail !== 'object' || detail === null) return [];
    const { path, message } = detail as { path?: unknown; message?: unknown };
    return typeof path === 'string' && typeof message === 'string' ? [{ path, message }] : [];
  });
}

/** Fields the API may name in a 400, shown under the field itself. */
const FIELD_PATHS = ['product.code', 'product.reason', 'existing.insurer'] as const;

function addressOf(address: ClientLocation['address']): string {
  return [address.line1, address.line2, address.city, `${address.state} ${address.pincode}`]
    .filter(Boolean)
    .join(', ');
}

/** Names and addresses for the sheet's locations: the proposal's view first, then the master. */
function useLocationInfo(record: ProposalRecord, clientLocations: ClientLocation[] | undefined) {
  return useMemo(() => {
    const info = new Map<string, LocationInfo>();
    for (const location of clientLocations ?? []) {
      info.set(location.id, {
        name: location.name,
        address: addressOf(location.address),
        district: location.district,
        eqZone: location.eqZone,
        occupancy: location.occupancy,
      });
    }
    for (const entry of record.locations) {
      if (!entry.location) continue;
      info.set(entry.locationId, {
        name: entry.location.name,
        address: addressOf(entry.location.address),
        district: entry.location.district,
        eqZone: entry.location.eqZone,
        occupancy: entry.location.occupancy,
      });
    }
    return info;
  }, [record.locations, clientLocations]);
}

/**
 * The Data Sheet: dates, each risk location's Fire items and risk details, the Fire Option 2
 * lines, the other sections, past claims and notes. Saved as a whole; read-only once the RFQ has
 * been sent or for roles that cannot edit proposals.
 */
export function DataSheetForm({ record, canEdit }: { record: ProposalRecord; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const readOnly = record.locked || !canEdit;
  const [saveError, setSaveError] = useState<unknown>(null);
  const [invalidSubmit, setInvalidSubmit] = useState(false);
  const clientLocations = useQuery(clientLocationsQuery(record.client.id));
  const locationInfo = useLocationInfo(record, clientLocations.data);

  const form = useForm<DataSheetFormValues, unknown, DataSheetInput>({
    resolver: zodResolver(DataSheetInputSchema),
    defaultValues: toDataSheetForm(record),
    disabled: readOnly,
  });
  const locations = useFieldArray({ control: form.control, name: 'locations' });
  const { isDirty } = form.formState;
  const renewal = record.type === 'EXISTING';
  const choice = useProductChoice(form.control);

  // A newer saved version (another tab, or a change of insurers) replaces an untouched form.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toDataSheetForm(record));
  }, [record, form]);

  const save = useMutation({
    mutationFn: (body: DataSheetInput) =>
      apiFetch(`proposals/${record.id}/data-sheet`, {
        method: 'PUT',
        body,
        schema: ProposalRecordSchema,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.proposals.record(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      form.reset(toDataSheetForm(saved));
      toast({
        title: 'Data Sheet saved',
        description:
          saved.missing.length === 0
            ? 'Complete: the RFQ can be downloaded.'
            : `${saved.missing.length} ${saved.missing.length === 1 ? 'item' : 'items'} still needed before the RFQ.`,
        variant: 'success',
      });
    },
    onError: (error) => {
      setSaveError(error);
      for (const issue of fieldIssues(error)) {
        const path = FIELD_PATHS.find((item) => item === issue.path);
        if (path) form.setError(path, { message: issue.message });
      }
      if (error instanceof ApiError && error.code === 'PROPOSAL_LOCKED') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(record.id) });
      }
    },
  });

  const onSubmit = form.handleSubmit(
    (values) => {
      setSaveError(null);
      // C-1: a product the Fire sum insured does not suggest is saved with the reason.
      if (choice.override && !values.product.reason) {
        form.setError('product.reason', {
          message: `Say why this policy is chosen over ${choice.suggested.map((p) => p.code).join(' or ')}`,
        });
        setInvalidSubmit(true);
        return;
      }
      setInvalidSubmit(false);
      const request = toDataSheetRequest(values);
      // C-4: add-ons from another product's lists are left out (the picker lists them).
      save.mutate(
        choice.loaded
          ? {
              ...request,
              addons: request.addons.filter((addon) => choice.lists.includes(addon.list)),
            }
          : request,
      );
    },
    () => setInvalidSubmit(true),
  );

  const chosenIds = new Set(locations.fields.map((field) => field.locationId));
  const addable = (clientLocations.data ?? []).filter((location) => !chosenIds.has(location.id));

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="grid gap-6 pb-4 *:min-w-0"
      >
        {record.locked ? (
          <Alert variant="info">
            <Lock aria-hidden="true" />
            <AlertTitle>The Data Sheet is locked</AlertTitle>
            <AlertDescription>
              The RFQ has been sent to insurers, so the figures they quoted on stay as they are.
            </AlertDescription>
          </Alert>
        ) : (
          <Completeness missing={record.missing} updatedAt={record.updatedAt} />
        )}

        {readOnly ? null : (
          <DataSheetImportControl
            record={record}
            getValues={() => form.getValues()}
            // The workbook's values are unsaved changes: checked, then saved as usual.
            onApply={(values) => form.reset(values, { keepDefaultValues: true })}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField name="dueDate" label="Quotes needed by" type="date" />
            <TextField
              name="policyStart"
              label="Policy start"
              type="date"
              description="Leave blank for 1 year from the date of payment."
            />
            <TextField name="policyEnd" label="Policy end" type="date" />
          </CardContent>
        </Card>

        <section aria-labelledby="locations-heading" className="grid gap-4 *:min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="locations-heading" className="text-base font-semibold tracking-tight">
                Risk locations
              </h2>
              <p className="text-sm text-muted-foreground">
                Fire sums insured per location. The RFQ adds them up by line.
              </p>
            </div>
            {readOnly ? null : (
              <AddLocationsDialog
                addable={addable}
                loading={clientLocations.isPending}
                onAdd={(ids) => locations.append(ids.map(blankLocation))}
              />
            )}
          </div>
          {locations.fields.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No locations on this proposal yet. Add the client’s risk locations to enter the Fire
              sums insured.
            </p>
          ) : (
            locations.fields.map((field, index) => (
              <LocationCard
                key={field.id}
                index={index}
                info={locationInfo.get(field.locationId)}
                readOnly={readOnly}
                onRemove={() => locations.remove(index)}
              />
            ))
          )}
        </section>

        {renewal ? <ExistingPolicyFields record={record} /> : null}
        <FireOptions record={record} renewal={renewal} readOnly={readOnly} />
        <ProductAndAddons clientId={record.client.id} readOnly={readOnly} canEdit={canEdit} />
        <OtherSections record={record} renewal={renewal} readOnly={readOnly} />
        <Claims readOnly={readOnly} />

        <Card>
          <CardHeader>
            <CardTitle>Notes for the insurers</CardTitle>
          </CardHeader>
          <CardContent>
            <TextAreaField
              name="notes"
              label="Notes"
              description="Printed on the RFQ schedule."
              maxLength={1000}
            />
          </CardContent>
        </Card>

        {readOnly ? null : (
          <div className="sticky bottom-0 z-10 -mx-1 grid gap-2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
            {saveError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {errorMessage(saveError)}
                  {fieldIssues(saveError).length > 0 ? (
                    <ul className="list-disc pl-4">
                      {fieldIssues(saveError).map((issue) => (
                        <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {invalidSubmit && Object.keys(form.formState.errors).length > 0 ? (
              <p role="alert" className="text-sm text-destructive">
                Some entries need fixing. They are marked in red.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {isDirty ? 'Unsaved changes' : 'All changes saved'}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isDirty || save.isPending}
                  onClick={() => {
                    form.reset(toDataSheetForm(record));
                    setSaveError(null);
                    setInvalidSubmit(false);
                  }}
                >
                  Discard changes
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Save Data Sheet
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}

/** What the saved Data Sheet still needs before the RFQ. */
function Completeness({ missing, updatedAt }: { missing: string[]; updatedAt: string }) {
  if (missing.length === 0) {
    return (
      <Alert variant="success">
        <CircleCheck aria-hidden="true" />
        <AlertTitle>Ready for the RFQ</AlertTitle>
        <AlertDescription>
          The saved Data Sheet is complete. Download the RFQ from the Insurers and RFQ tab.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="warning">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>Needed before the RFQ</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <span className="text-xs text-muted-foreground">
          As last saved, {formatDateTime(updatedAt)}.
        </span>
      </AlertDescription>
    </Alert>
  );
}

function AddLocationsDialog({
  addable,
  loading,
  onAdd,
}: {
  addable: ClientLocation[];
  loading: boolean;
  onAdd: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setChosen([]);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={loading}>
          <Plus aria-hidden="true" />
          Add locations
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add risk locations</DialogTitle>
          <DialogDescription>
            The client’s locations not yet on this proposal. New sites are added on the client’s
            page.
          </DialogDescription>
        </DialogHeader>
        {addable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every location of this client is already on the proposal.
          </p>
        ) : (
          <fieldset className="relative grid max-h-80 gap-2 overflow-y-auto">
            <legend className="sr-only">Locations</legend>
            {addable.map((location) => {
              const id = `add-location-${location.id}`;
              return (
                <div
                  key={location.id}
                  className="flex items-start gap-3 rounded-md border px-3 py-2"
                >
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={chosen.includes(location.id)}
                    onCheckedChange={(value) =>
                      setChosen((current) =>
                        value === true
                          ? [...current, location.id]
                          : current.filter((item) => item !== location.id),
                      )
                    }
                  />
                  <Label htmlFor={id} className="grid gap-0.5 font-normal">
                    <span className="font-medium">{location.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {addressOf(location.address)}
                    </span>
                  </Label>
                </div>
              );
            })}
          </fieldset>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => {
              onAdd(chosen);
              setOpen(false);
            }}
          >
            Add {chosen.length > 0 ? chosen.length : ''}{' '}
            {chosen.length === 1 ? 'location' : 'locations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A renewal's Existing column (C-2): last year's insurer and policy number. The figures are typed
 * in the Existing columns below; they start as the policy software's copy.
 */
function ExistingPolicyFields({ record }: { record: ProposalRecord }) {
  const copy = record.existingPolicy;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Existing policy (last year)</CardTitle>
        <CardDescription>
          {record.existing?.source === 'DATA_SHEET'
            ? 'The Existing column as typed on this Data Sheet.'
            : copy
              ? `The Existing column as copied from ${copy.source}; change any figure that differs.`
              : 'Last year’s policy was not copied: type its insurer and figures in the Existing columns.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <TextField name="existing.insurer" label="Insurer" maxLength={200} autoComplete="off" />
        <TextField
          name="existing.policyNumber"
          label="Policy number"
          maxLength={100}
          autoComplete="off"
        />
      </CardContent>
    </Card>
  );
}

/**
 * The RFQ's Fire lines in three options (C-2): Existing (a renewal's last year), Option 1 adding
 * up the locations, and Option 2 typed per line; then Fire's add-on covers (C-6).
 */
function FireOptions({
  record,
  renewal,
  readOnly,
}: {
  record: ProposalRecord;
  renewal: boolean;
  readOnly: boolean;
}) {
  const form = useFormContext<DataSheetFormValues>();
  const locations = useWatch({ control: form.control, name: 'locations' });
  const option2 = useWatch({ control: form.control, name: 'fireOption2' });
  const existingLines = useWatch({ control: form.control, name: 'existing.fireLines' });
  const totals = fireGroupTotals(locations ?? []);
  const seconds = (option2 ?? []).map((line) => line.amount?.trim() ?? '').filter(Boolean);
  const typedLines = (existingLines ?? [])
    .map((line) => line.amount?.trim() ?? '')
    .filter((value) => /^\d+$/.test(value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fire and allied perils</CardTitle>
        <CardDescription>
          Sum insured by line. Option 2 is optional: enter it for the lines the client wants quoted
          at a second figure.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Line</TableHead>
              {renewal ? <TableHead className="text-right">Existing</TableHead> : null}
              <TableHead className="text-right">Option 1</TableHead>
              <TableHead className="text-right">Option 2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FIRE_GROUPS.map((group, index) => (
              <TableRow key={group}>
                <TableCell className="min-w-56 whitespace-normal">
                  {FIRE_GROUP_LABELS[group]}
                </TableCell>
                {renewal ? (
                  <TableCell className="align-top">
                    <RupeesField
                      name={`existing.fireLines.${index}.amount`}
                      label={`Existing for ${FIRE_GROUP_LABELS[group]}`}
                      hideLabel
                    />
                  </TableCell>
                ) : null}
                <TableCell className="text-right tabular whitespace-nowrap">
                  {formatInr(totals[group])}
                </TableCell>
                <TableCell className="align-top">
                  <RupeesField
                    name={`fireOption2.${index}.amount`}
                    label={`Option 2 for ${FIRE_GROUP_LABELS[group]}`}
                    hideLabel
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total sum insured</TableCell>
              {renewal ? (
                <TableCell className="text-right font-medium tabular whitespace-nowrap">
                  {typedLines.length > 0 ? (
                    formatInr(sumRupeesOf(typedLines))
                  ) : (
                    <RupeesField
                      name="existing.fireTotal"
                      label="Existing Fire total"
                      hideLabel
                      placeholder="Total"
                    />
                  )}
                </TableCell>
              ) : null}
              <TableCell className="text-right font-medium tabular whitespace-nowrap">
                {formatInr(fireTotal(locations ?? []))}
              </TableCell>
              <TableCell className="text-right font-medium tabular whitespace-nowrap">
                {seconds.length > 0 && seconds.every((value) => /^\d+$/.test(value))
                  ? formatInr(sumRupeesOf(seconds))
                  : '—'}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <CoverToggles
          path="fireCovers"
          covers={record.fire.covers}
          name="Fire"
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  );
}

/**
 * The other coverage sections: included or not, in three options (C-2), with their lines,
 * annexure, Burglary basis (C-3) and add-on covers (C-6).
 */
function OtherSections({
  record,
  renewal,
  readOnly,
}: {
  record: ProposalRecord;
  renewal: boolean;
  readOnly: boolean;
}) {
  const saved = new Map(record.sections.map((section) => [section.code, section]));
  const form = useFormContext<DataSheetFormValues>();
  const sections = useWatch({ control: form.control, name: 'sections' });
  const locations = useWatch({ control: form.control, name: 'locations' });
  const option2 = useWatch({ control: form.control, name: 'fireOption2' });
  // Burglary covers "all the contents as per Fire section except building" (the RFQ schedule).
  const contents = contentsTotal(locations ?? []);
  const fromContents = contentsOptions(
    locations ?? [],
    (option2 ?? []).map((line) => ({ group: line.group, amount: line.amount ?? null })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Other sections</CardTitle>
        <CardDescription>
          Tick the covers to quote and fill their details; untick a cover to mark it not required
          (the RFQ lists it so). An annexure’s items add up to its sum insured.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              {renewal ? <TableHead className="text-right">Existing</TableHead> : null}
              <TableHead className="text-right">Proposed 1</TableHead>
              <TableHead className="text-right">Proposed 2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sections ?? []).map((section, index) => {
              const { code, included } = section;
              const savedSection = saved.get(code);
              const name = savedSection?.name ?? OTHER_SECTION_LABELS[code];
              const covers = savedSection?.covers ?? [];
              const annexureSection = isAnnexureSection(code);
              const hasLines = code in SECTION_LINES;
              const basis = hasBasis(code) ? (section.basis ?? null) : null;
              // C-3: on a basis, Burglary's sum insured is the Fire contents.
              const contentsBased = code === 'BURGLARY' && basis !== null;
              // D-5: the sum insured comes from the annexure, or from its lines (FLOP's gross
              // profit, Money's safe and single carrying, Fidelity's and PL's limits), when given.
              const fromAnnexure = annexureSection && (section.annexure?.length ?? 0) > 0;
              const derived = fromAnnexure || sumOfLines(code, section.lines) !== null;
              // Money's Option 2 adds up its Option 2 lines, when given.
              const derived2 =
                (SUM_INSURED_LINES[code]?.length ?? 0) > 1 &&
                sumOfLines(code, section.lines2) !== null;
              const option1 = contentsBased ? fromContents.proposed1 : sectionSumInsured(section);
              const option2Value = contentsBased
                ? fromContents.proposed2
                : sectionOption2(section)?.trim() || null;
              const details =
                included && (annexureSection || hasLines || hasBasis(code) || covers.length > 0);
              const columnCount = renewal ? 4 : 3;
              return (
                <Fragment key={code}>
                  <TableRow className={details ? 'border-b-0' : undefined}>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`sections.${index}.included`}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                ref={field.ref}
                                name={field.name}
                                disabled={field.disabled}
                                checked={field.value}
                                onCheckedChange={(value) => field.onChange(value === true)}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{name}</FormLabel>
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    {renewal ? (
                      <TableCell className="align-top">
                        <RupeesField
                          name={`sections.${index}.existing`}
                          label={`${name} Existing`}
                          hideLabel
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="align-top">
                      {included ? (
                        <div className="grid justify-items-end gap-1">
                          {derived || contentsBased ? (
                            <span
                              className="py-2 text-right text-sm font-medium tabular"
                              aria-label={`${name} Proposed 1`}
                            >
                              {formatInr(option1 ?? '0')}
                              <span className="block text-xs font-normal text-muted-foreground">
                                {contentsBased
                                  ? 'Fire contents'
                                  : fromAnnexure
                                    ? 'From the annexure'
                                    : (SUM_INSURED_FROM[code] ?? 'From the lines')}
                              </span>
                            </span>
                          ) : (
                            <RupeesField
                              name={`sections.${index}.proposed1`}
                              label={`${name} Proposed 1`}
                              hideLabel
                            />
                          )}
                          {code === 'BURGLARY' &&
                          !contentsBased &&
                          contents !== '0' &&
                          !form.formState.disabled ? (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() =>
                                form.setValue(`sections.${index}.proposed1`, contents, {
                                  shouldDirty: true,
                                })
                              }
                            >
                              Use contents total {formatInr(contents)}
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="block text-right text-sm text-muted-foreground">
                          Not required
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {!included ? null : contentsBased || derived2 ? (
                        <span
                          className="block py-2 text-right text-sm font-medium tabular"
                          aria-label={`${name} Proposed 2`}
                        >
                          {option2Value ? formatInr(option2Value) : '—'}
                          {derived2 ? (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {SUM_INSURED_FROM[code]}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <RupeesField
                          name={`sections.${index}.proposed2`}
                          label={`${name} Proposed 2`}
                          hideLabel
                        />
                      )}
                    </TableCell>
                  </TableRow>
                  {details ? (
                    <TableRow>
                      <TableCell
                        colSpan={columnCount}
                        className="bg-muted/30 pb-4 whitespace-normal"
                      >
                        <section aria-label={`${name} details`} className="grid gap-4">
                          {hasBasis(code) ? (
                            <BasisField
                              index={index}
                              name={name}
                              allowTyped={
                                savedSection?.basis === null && savedSection.proposed1 !== null
                              }
                              amounts={
                                basis
                                  ? {
                                      proposed1: onBasis(option1, basis),
                                      proposed2: onBasis(option2Value, basis),
                                    }
                                  : null
                              }
                            />
                          ) : null}
                          {annexureSection ? (
                            <AnnexureGrid
                              index={index}
                              code={code}
                              name={name}
                              readOnly={readOnly}
                            />
                          ) : hasLines ? (
                            <SectionLines index={index} code={code} name={name} renewal={renewal} />
                          ) : null}
                          <CoverToggles
                            path={`sections.${index}.covers`}
                            covers={covers}
                            name={name}
                            readOnly={readOnly}
                          />
                        </section>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Up to three past years of claims, as the RFQ's claim details. */
function Claims({ readOnly }: { readOnly: boolean }) {
  const form = useFormContext<DataSheetFormValues>();
  const claims = useFieldArray({ control: form.control, name: 'claims' });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Claims in the past 3 years</CardTitle>
          <CardDescription>Leave empty when there were none: the RFQ says so.</CardDescription>
        </div>
        {readOnly || claims.fields.length >= MAX_CLAIM_ROWS ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              claims.append({
                period: '',
                policyType: '',
                sumInsured: '',
                premium: '',
                claimedAmount: '',
                remarks: '',
                insurer: '',
              })
            }
          >
            <Plus aria-hidden="true" />
            Add a year
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {claims.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No claims entered.</p>
        ) : (
          claims.fields.map((field, index) => (
            <fieldset key={field.id} className="grid gap-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Year {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  name={`claims.${index}.period`}
                  label="Policy period"
                  placeholder="2024-25"
                  maxLength={20}
                />
                <TextField
                  name={`claims.${index}.policyType`}
                  label="Policy type"
                  placeholder="SFSP"
                  maxLength={100}
                />
                <TextField name={`claims.${index}.insurer`} label="Insurer" maxLength={200} />
                <RupeesField name={`claims.${index}.sumInsured`} label="Sum insured" />
                <RupeesField name={`claims.${index}.premium`} label="Premium before tax" />
                <RupeesField name={`claims.${index}.claimedAmount`} label="Claimed amount" />
              </div>
              <TextField name={`claims.${index}.remarks`} label="Claim remarks" maxLength={300} />
              {readOnly ? null : (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => claims.remove(index)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remove year {index + 1}
                  </Button>
                </div>
              )}
            </fieldset>
          ))
        )}
      </CardContent>
    </Card>
  );
}
