'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useCurrentUser } from '@/hooks/use-current-user';
import { toast } from '@/hooks/use-toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiFetch } from '@/lib/api-client';
import { clientLocationsQuery } from '@/lib/api/new-business';
import { setPendingDataSheet } from '@/lib/data-sheet-import';
import { addDays, todayIst } from '@/lib/dates';
import { applyServerFieldErrors } from '@/lib/form-errors';
import { formatInr } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  ClientListResponseSchema,
  CreateProposalRequestSchema,
  ExistingPolicyLookupSchema,
  ProposalOwnersResponseSchema,
  ProposalRecordSchema,
  formatDate,
  wholeRupees,
  type Client,
  type CreateProposalFormValues,
  type CreateProposalRequest,
  type ProposalType,
} from '@/shared';

const RESULT_LIMIT = 20;

/** The request, with a plain message while no client is chosen. */
const NewCaseSchema = CreateProposalRequestSchema.safeExtend({
  clientId: z.string().regex(/^[a-f0-9]{24}$/i, 'Choose the insured client'),
});
/** Quotes are usually wanted within a week. */
const DEFAULT_DAYS_TO_DUE = 7;

const TYPE_CHOICES: { value: ProposalType; label: string; hint: string }[] = [
  { value: 'NEW', label: 'New business', hint: 'No policy with us yet: start from a Data Sheet.' },
  {
    value: 'EXISTING',
    label: 'Renewal',
    hint: 'Last year’s policy is copied from the policy software as the Existing column.',
  },
];

/**
 * Creates a case (D-1): New business or Renewal, the insured and its risk locations, the policy
 * period, the assigned staff and the date quotes are needed by. It gets the next case number and
 * starts at stage 1 (Draft). A renewal shows last year's policy before it is created (D-2).
 */
export function NewProposalForm({ initialType = 'NEW' }: { initialType?: ProposalType }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const [client, setClient] = useState<Client | null>(null);
  const [generalError, setGeneralError] = useState<unknown>(null);

  const form = useForm<CreateProposalFormValues, unknown, CreateProposalRequest>({
    resolver: zodResolver(NewCaseSchema),
    defaultValues: {
      type: initialType,
      clientId: '',
      locationIds: [],
      ownerId: undefined,
      policyStart: '',
      policyEnd: '',
      dueDate: addDays(todayIst(), DEFAULT_DAYS_TO_DUE),
    },
  });
  const type = useWatch({ control: form.control, name: 'type' }) ?? 'NEW';
  const renewal = type === 'EXISTING';

  // The signed-in user is the assigned staff unless someone else is chosen.
  useEffect(() => {
    if (me.data && !form.getValues('ownerId')) form.setValue('ownerId', me.data.id);
  }, [me.data, form]);

  const [dataSheet, setDataSheet] = useState<File | null>(null);
  const dataSheetId = useId();
  const create = useMutation({
    mutationFn: (body: CreateProposalRequest) =>
      apiFetch('proposals', { method: 'POST', body, schema: ProposalRecordSchema }),
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.proposals.record(record.id), record);
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({
        title: record.type === 'EXISTING' ? 'Renewal created' : 'Proposal created',
        description: record.reference,
        variant: 'success',
      });
      // The workbook chosen here fills the Data Sheet as the case opens.
      if (dataSheet) setPendingDataSheet(record.id, dataSheet);
      router.push(`/proposals/${record.id}${dataSheet ? '?tab=data-sheet' : ''}`);
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError)) setGeneralError(error);
    },
  });

  const chooseClient = (next: Client | null) => {
    setClient(next);
    form.setValue('clientId', next?.id ?? '', { shouldValidate: form.formState.isSubmitted });
    form.setValue('locationIds', []);
  };

  const listHref = `/proposals?type=${renewal ? 'existing' : 'new'}`;

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid max-w-3xl gap-6"
        onSubmit={(event) =>
          void form.handleSubmit((values) => {
            setGeneralError(null);
            create.mutate(values);
          })(event)
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Type of case</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <fieldset className="grid gap-2 sm:grid-cols-2">
                    <legend className="sr-only">Type of case</legend>
                    {TYPE_CHOICES.map((choice) => {
                      const id = `case-type-${choice.value}`;
                      const checked = field.value === choice.value;
                      return (
                        <label
                          key={choice.value}
                          htmlFor={id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                            checked && 'border-primary bg-primary-soft/40',
                          )}
                        >
                          <input
                            id={id}
                            type="radio"
                            name={field.name}
                            value={choice.value}
                            checked={checked}
                            onChange={() => field.onChange(choice.value)}
                            className="mt-1 accent-[var(--primary)]"
                          />
                          <span className="grid gap-0.5">
                            <span className="text-sm font-medium">{choice.label}</span>
                            <span className="text-xs text-muted-foreground">{choice.hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insured</CardTitle>
            <CardDescription>
              Choose a client from the client master. Its GSTIN, address and occupancy go on the
              RFQ.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField
              control={form.control}
              name="clientId"
              render={() => (
                <FormItem>
                  {client ? (
                    <ChosenClient client={client} onChange={() => chooseClient(null)} />
                  ) : (
                    <ClientSearch onChoose={chooseClient} />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {client && renewal ? <LastPolicy client={client} /> : null}
          </CardContent>
        </Card>

        {client ? <LocationsCard client={client} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Policy period and team</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <PolicyPeriodFields renewal={renewal} />
            <OwnerField />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotes needed by</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>Shown on the RFQ. You can change it later.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client’s Data Sheet (optional)</CardTitle>
            <CardDescription>
              The client’s Data Sheet workbook, in its own format, fills the new case’s Data Sheet:
              Fire lines, other sections, risk details and annexure. You check and save it there.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Input
              id={dataSheetId}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Client’s Data Sheet workbook"
              className="max-w-sm"
              onChange={(event) => setDataSheet(event.target.files?.[0] ?? null)}
            />
            {dataSheet ? (
              <span className="text-sm text-muted-foreground">{dataSheet.name}</span>
            ) : null}
          </CardContent>
        </Card>

        {generalError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(generalError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {renewal ? 'Create renewal' : 'Create proposal'}
          </Button>
          <Button asChild variant="outline">
            <Link href={listHref}>Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Start and end of the policy period, each typed: the end is not worked out from the start (client
 * review, 27 Oct 2026), as policies run for other terms than a year.
 */
function PolicyPeriodFields({ renewal }: { renewal: boolean }) {
  const form = useFormContext<CreateProposalFormValues, unknown, CreateProposalRequest>();
  return (
    <>
      <FormField
        control={form.control}
        name="policyStart"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Policy period from</FormLabel>
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
            <FormDescription>
              {renewal ? 'Usually the day after last year’s policy ends.' : 'The day cover starts.'}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="policyEnd"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Policy period to</FormLabel>
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
            <FormDescription>The day cover ends.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

/** The staff member the case is assigned to. */
function OwnerField() {
  const form = useFormContext<CreateProposalFormValues, unknown, CreateProposalRequest>();
  const owners = useQuery({
    queryKey: ['proposals', 'owners'],
    queryFn: ({ signal }) =>
      apiFetch('proposals/owners', { schema: ProposalOwnersResponseSchema, signal }),
  });
  return (
    <FormField
      control={form.control}
      name="ownerId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Assigned to</FormLabel>
          <FormControl>
            <NativeSelect
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value ?? ''}
              disabled={owners.isPending}
              onChange={(event) => field.onChange(event.target.value || undefined)}
            >
              {owners.isPending ? <option value="">Loading staff…</option> : null}
              {(owners.data?.items ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <FormDescription>Who works on the case. Staff who can edit proposals.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Last year's policy for a renewal, from the policy software. When found, the new policy period
 * starts the day after it ends; its end is typed.
 */
function LastPolicy({ client }: { client: Client }) {
  const form = useFormContext<CreateProposalFormValues, unknown, CreateProposalRequest>();
  const lookup = useQuery({
    queryKey: ['proposals', 'last-policy', client.id],
    queryFn: ({ signal }) =>
      apiFetch(`proposals/last-policy?clientId=${client.id}`, {
        schema: ExistingPolicyLookupSchema,
        signal,
      }),
  });
  const policy = lookup.data?.policy ?? null;

  useEffect(() => {
    if (!policy?.periodEnd || form.getFieldState('policyStart').isDirty) return;
    form.setValue('policyStart', addDays(policy.periodEnd, 1));
  }, [policy, form]);

  if (lookup.isPending) return <LoadingState label="Looking up last year’s policy" />;
  if (lookup.isError) {
    return <ErrorState error={lookup.error} onRetry={() => void lookup.refetch()} />;
  }
  if (!policy) {
    return (
      <Alert variant="warning" role="status">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Last year’s policy was not found</AlertTitle>
        <AlertDescription>
          {lookup.data.message} You can still create the renewal and fetch it again from the case.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <section
      aria-label="Last year’s policy"
      className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm"
    >
      <p className="font-medium">
        Last year’s policy, from {policy.source}: {policy.policyNumber}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <PolicyFact label="Insurer">{policy.insurer}</PolicyFact>
        <PolicyFact label="Period">
          {policy.periodStart && policy.periodEnd
            ? `${formatDate(policy.periodStart)} – ${formatDate(policy.periodEnd)}`
            : '—'}
        </PolicyFact>
        <PolicyFact label="Sum insured">
          {formatInr(wholeRupees(policy.totalSumInsured))}
        </PolicyFact>
        <PolicyFact label="Premium">
          {policy.totalPremium ? formatInr(wholeRupees(policy.totalPremium)) : '—'}
        </PolicyFact>
      </dl>
      <p className="text-xs text-muted-foreground">
        Copied into the renewal as the Existing column when you create it.
      </p>
    </section>
  );
}

function PolicyFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular">{children}</dd>
    </div>
  );
}

function ClientSearch({ onChoose }: { onChoose: (client: Client) => void }) {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 250);
  const clients = useQuery({
    queryKey: [...queryKeys.clients.list(q), 'picker'],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: String(RESULT_LIMIT) });
      if (q) params.set('q', q);
      return apiFetch(`clients?${params.toString()}`, { schema: ClientListResponseSchema, signal });
    },
    placeholderData: keepPreviousData,
  });
  const items = clients.data?.items ?? [];

  return (
    <div className="grid gap-3">
      <Label htmlFor={searchId}>Search clients by name or GSTIN</Label>
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="For example Fabrics or 27AAP"
          className="pl-9"
          autoComplete="off"
        />
      </div>
      {clients.isPending ? (
        <LoadingState label="Loading clients" />
      ) : clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={q ? `No clients match “${q}”` : 'No clients yet'}
          description={
            <>
              Add the insured in the{' '}
              <Link href="/masters/clients" className="text-accent-strong hover:underline">
                client master
              </Link>{' '}
              first.
            </>
          }
        />
      ) : (
        <ul className="grid gap-1" aria-label="Clients">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChoose(item)}
                className="grid w-full gap-0.5 rounded-md border px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.gstin ?? 'No GSTIN'} · {item.address.city}, {item.address.state} ·{' '}
                  {item.locationCount} {item.locationCount === 1 ? 'location' : 'locations'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChosenClient({ client, onChange }: { client: Client; onChange: () => void }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="grid gap-0.5 text-sm">
        <span className="font-medium">{client.name}</span>
        <span className="text-xs text-muted-foreground">
          {client.gstin ?? 'No GSTIN'} · {client.address.city}, {client.address.state} · Occupancy{' '}
          {client.occupancy.tacCode} — {client.occupancy.description}
        </span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onChange}>
        Change client
      </Button>
    </div>
  );
}

function LocationsCard({ client }: { client: Client }) {
  const locations = useQuery(clientLocationsQuery(client.id));
  const form = useFormContext<CreateProposalFormValues, unknown, CreateProposalRequest>();
  const chosen = useWatch({ control: form.control, name: 'locationIds' });

  // Every location is ticked when the client's list first arrives; untick the ones not covered.
  // A refetch of the list (after a submit the form refused, say) keeps what was unticked.
  const tickedFor = useRef<string | null>(null);
  useEffect(() => {
    if (locations.data && tickedFor.current !== client.id) {
      tickedFor.current = client.id;
      form.setValue(
        'locationIds',
        locations.data.map((location) => location.id),
      );
    }
  }, [locations.data, client.id, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk locations</CardTitle>
        <CardDescription>
          The sites this proposal covers. You can add or take off locations in the Data Sheet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="locationIds"
          render={() => (
            <FormItem>
              {locations.isPending ? (
                <LoadingState label="Loading locations" />
              ) : locations.isError ? (
                <ErrorState error={locations.error} onRetry={() => void locations.refetch()} />
              ) : locations.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This client has no risk locations yet.{' '}
                  <Link
                    href={`/masters/clients/${client.id}`}
                    className="text-accent-strong hover:underline"
                  >
                    Add them on the client’s page
                  </Link>
                  , or create the proposal now and add them later.
                </p>
              ) : (
                <fieldset className="grid gap-2">
                  <legend className="sr-only">Risk locations</legend>
                  {locations.data.map((location) => {
                    const checked = chosen.includes(location.id);
                    const id = `location-${location.id}`;
                    return (
                      <div
                        key={location.id}
                        className={cn(
                          'flex items-start gap-3 rounded-md border px-3 py-2',
                          checked && 'border-primary/40 bg-primary-soft/40',
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          className="mt-0.5"
                          onCheckedChange={(value) =>
                            form.setValue(
                              'locationIds',
                              value === true
                                ? [...chosen, location.id]
                                : chosen.filter((locationId) => locationId !== location.id),
                            )
                          }
                        />
                        <Label htmlFor={id} className="grid gap-0.5 font-normal">
                          <span className="font-medium">{location.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[
                              location.address.line1,
                              location.address.city,
                              location.address.pincode,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                            {location.occupancy ? ` · Occupancy ${location.occupancy.tacCode}` : ''}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground tabular">
                    {chosen.length} of {locations.data.length} chosen
                  </p>
                </fieldset>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
