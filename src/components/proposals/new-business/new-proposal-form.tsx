'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useForm, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { toast } from '@/hooks/use-toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiFetch } from '@/lib/api-client';
import { clientLocationsQuery } from '@/lib/api/new-business';
import { addDays, todayIst } from '@/lib/dates';
import { applyServerFieldErrors } from '@/lib/form-errors';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  ClientListResponseSchema,
  CreateProposalRequestSchema,
  ProposalRecordSchema,
  type Client,
  type CreateProposalRequest,
} from '@/shared';

const RESULT_LIMIT = 20;

/** The request, with a plain message while no client is chosen. */
const NewProposalSchema = CreateProposalRequestSchema.extend({
  clientId: z.string().regex(/^[a-f0-9]{24}$/i, 'Choose the insured client'),
});
/** Quotes are usually wanted within a week. */
const DEFAULT_DAYS_TO_DUE = 7;

/**
 * Starts a new-business proposal: the insured, the risk locations it covers and the date quotes
 * are needed by. The Data Sheet is filled on the proposal's page.
 */
export function NewProposalForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [client, setClient] = useState<Client | null>(null);
  const [generalError, setGeneralError] = useState<unknown>(null);

  const form = useForm<CreateProposalRequest>({
    resolver: zodResolver(NewProposalSchema),
    defaultValues: {
      clientId: '',
      locationIds: [],
      dueDate: addDays(todayIst(), DEFAULT_DAYS_TO_DUE),
    },
  });

  const create = useMutation({
    mutationFn: (body: CreateProposalRequest) =>
      apiFetch('proposals', { method: 'POST', body, schema: ProposalRecordSchema }),
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.proposals.record(record.id), record);
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Proposal created', description: record.reference, variant: 'success' });
      router.push(`/proposals/${record.id}`);
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

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid max-w-3xl gap-6"
        onSubmit={form.handleSubmit((values) => {
          setGeneralError(null);
          create.mutate(values);
        })}
      >
        <Card>
          <CardHeader>
            <CardTitle>Insured</CardTitle>
            <CardDescription>
              Choose a client from the client master. Its GSTIN, address and occupancy go on the
              RFQ.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
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
          </CardContent>
        </Card>

        {client ? <LocationsCard client={client} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="max-w-xs">
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

        {generalError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(generalError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Create proposal
          </Button>
          <Button asChild variant="outline">
            <Link href="/proposals?type=new">Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
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
  const form = useFormContext<CreateProposalRequest>();
  const chosen = useWatch({ control: form.control, name: 'locationIds' });

  // Every location is ticked when the client's list arrives; untick the ones not covered.
  useEffect(() => {
    if (locations.data) {
      form.setValue(
        'locationIds',
        locations.data.map((location) => location.id),
      );
    }
  }, [locations.data, form]);

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
