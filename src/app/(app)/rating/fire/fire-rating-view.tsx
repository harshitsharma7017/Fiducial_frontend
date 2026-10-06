'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Calculator, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { FireBreakdown } from '@/components/rating/fire-breakdown';
import { PincodeSummary } from '@/components/forms/pincode-summary';
import { OccupancyField } from '@/components/rating/occupancy-picker';
import { SumInsuredInput } from '@/components/rating/sum-insured-input';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ApiError, apiFetch } from '@/lib/api-client';
import { displayRate, riskTypeLabel } from '@/lib/display';
import {
  FireRatingResponseSchema,
  PerMilleRateSchema,
  PincodeValueSchema,
  SumInsuredSchema,
  TacCodeSchema,
  type FireRatingRequest,
  type Occupancy,
} from '@/shared';

/** The request schema from the shared package, with an empty terrorism rate allowed in the form. */
const FireRatingFormSchema = z.object({
  occupancyCode: TacCodeSchema,
  pincode: PincodeValueSchema,
  sumInsured: SumInsuredSchema,
  terrorismRate: z.union([z.literal(''), PerMilleRateSchema]),
});

function OccupancySummary({ occupancy }: { occupancy: Occupancy }) {
  return (
    <div className="grid gap-1 rounded-md bg-muted/60 p-3 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>Risk grade {occupancy.riskGrade ?? '—'}</span>
        <span>IIB {displayRate(occupancy.iibRate)} ‰</span>
        <span>Min STFI {displayRate(occupancy.minStfiRate)} ‰</span>
        <span>Fire risk: {riskTypeLabel(occupancy.fireRiskType)}</span>
      </div>
      {!occupancy.fireRiskType ? (
        <Badge variant="warning">Blank Fire risk type: the rating will be refused</Badge>
      ) : null}
      {!occupancy.iibRate && occupancy.iibRateNote ? (
        <span className="text-warning">No numeric IIB rate: “{occupancy.iibRateNote}”</span>
      ) : null}
    </div>
  );
}

function ratingErrorTitle(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'MASTER_DATA_ERROR') return 'The master data cannot support this rating';
    if (error.code === 'OCCUPANCY_NOT_FOUND' || error.code === 'PINCODE_NOT_FOUND')
      return 'Not in the active master';
    if (error.code === 'MASTER_NOT_ACTIVE') return 'No master data is active';
  }
  return 'The rating failed';
}

export function FireRatingView() {
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const form = useForm({
    resolver: zodResolver(FireRatingFormSchema),
    defaultValues: { occupancyCode: '', pincode: '', sumInsured: '', terrorismRate: '' },
  });
  const pincode = useWatch({ control: form.control, name: 'pincode' });

  const rating = useMutation({
    mutationFn: (body: FireRatingRequest) =>
      apiFetch('rating/fire', { method: 'POST', body, schema: FireRatingResponseSchema }),
  });

  const onSubmit = form.handleSubmit((values) => {
    rating.mutate({
      occupancyCode: values.occupancyCode,
      pincode: values.pincode,
      sumInsured: values.sumInsured,
      ...(values.terrorismRate ? { terrorismRate: values.terrorismRate } : {}),
    });
  });

  return (
    <>
      <PageHeader
        title="Fire rate check"
        description="Indicative Fire premium from the active IIB occupancy and pincode masters."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Risk details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={onSubmit} noValidate className="grid gap-5">
                <FormField
                  control={form.control}
                  name="occupancyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupancy</FormLabel>
                      <OccupancyField
                        ref={field.ref}
                        onBlur={field.onBlur}
                        onSelect={(choice) => {
                          setOccupancy(choice);
                          field.onChange(choice?.tacCode ?? '');
                        }}
                      />
                      <FormDescription>
                        Search by TAC code or description, then pick from the list.
                      </FormDescription>
                      <FormMessage />
                      {occupancy ? <OccupancySummary occupancy={occupancy} /> : null}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="postal-code"
                          className="tabular"
                          placeholder="400001"
                        />
                      </FormControl>
                      <FormMessage />
                      <PincodeSummary pincode={pincode} />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sumInsured"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sum insured</FormLabel>
                      <FormControl>
                        <SumInsuredInput
                          ref={field.ref}
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="10,00,00,000"
                        />
                      </FormControl>
                      <FormDescription>Rupees, up to 2 decimals.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="terrorismRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terrorism rate (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="decimal"
                          autoComplete="off"
                          className="tabular"
                          placeholder="0.05"
                        />
                      </FormControl>
                      <FormDescription>
                        Per mille. Leave blank to exclude terrorism; the rate source is still to be
                        confirmed.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={rating.isPending}>
                  {rating.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Calculator aria-hidden="true" />
                  )}
                  {rating.isPending ? 'Calculating…' : 'Calculate premium'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <section aria-label="Result" aria-live="polite" aria-busy={rating.isPending}>
          {rating.isPending ? (
            <Card>
              <CardContent>
                <LoadingState label="Calculating the premium…" />
              </CardContent>
            </Card>
          ) : rating.isError ? (
            <ErrorState error={rating.error} title={ratingErrorTitle(rating.error)} />
          ) : rating.data ? (
            <FireBreakdown result={rating.data} />
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<Calculator className="size-8" />}
                  title="No calculation yet"
                  description="Choose an occupancy, enter the pincode and sum insured, then calculate."
                />
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
