'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ChoiceField, RateField, TextField } from '@/components/masters/master-fields';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { riskTypeLabel } from '@/lib/display';
import { applyServerFieldErrors } from '@/lib/form-errors';
import {
  CreateOccupancyRequestSchema,
  EQ_ZONES,
  EQ_ZONE_LABELS,
  OccupancySchema,
  RISK_GRADES,
  RISK_TYPES,
  type CreateOccupancyRequest,
  type Occupancy,
  type OccupancyFormValues,
} from '@/shared';

type Values = OccupancyFormValues;

const GRADE_OPTIONS = RISK_GRADES.map((grade) => ({ value: grade, label: grade }));
const RISK_TYPE_OPTIONS = RISK_TYPES.map((type) => ({ value: type, label: riskTypeLabel(type) }));

function toFormValues(occupancy: Occupancy | undefined): Values {
  return {
    tacCode: occupancy?.tacCode ?? '',
    description: occupancy?.description ?? '',
    riskGrade: occupancy?.riskGrade ?? '',
    iibRate: occupancy?.iibRate ?? '',
    iibRateNote: occupancy?.iibRateNote ?? '',
    fireRiskType: occupancy?.fireRiskType ?? '',
    terrorismRiskType: occupancy?.terrorismRiskType ?? '',
    minStfiRate: occupancy?.minStfiRate ?? '',
    minEqRates: {
      zone1: occupancy?.minEqRates.zone1 ?? '',
      zone2: occupancy?.minEqRates.zone2 ?? '',
      zone3: occupancy?.minEqRates.zone3 ?? '',
      zone4: occupancy?.minEqRates.zone4 ?? '',
    },
  };
}

function OccupancyForm({
  occupancy,
  onSaved,
}: {
  occupancy?: Occupancy;
  onSaved: (saved: Occupancy) => void;
}) {
  const queryClient = useQueryClient();
  const [generalError, setGeneralError] = useState<unknown>(null);
  const form = useForm<Values, unknown, CreateOccupancyRequest>({
    resolver: zodResolver(CreateOccupancyRequestSchema),
    defaultValues: toFormValues(occupancy),
    mode: 'onTouched',
  });

  const save = useMutation({
    mutationFn: ({ tacCode, ...fields }: CreateOccupancyRequest) =>
      occupancy
        ? apiFetch(`masters/occupancies/${encodeURIComponent(occupancy.tacCode)}`, {
            method: 'PATCH',
            body: fields,
            schema: OccupancySchema,
          })
        : apiFetch('masters/occupancies', {
            method: 'POST',
            body: { tacCode, ...fields },
            schema: OccupancySchema,
          }),
    onSuccess: (saved) => {
      // Every occupancy lookup, picker and rating reads the active master.
      void queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast({
        title: occupancy ? 'Occupancy updated' : 'Occupancy added',
        description: `${saved.tacCode} · ${saved.description}`,
        variant: 'success',
      });
      onSaved(saved);
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError, { CONFLICT: 'tacCode' })) {
        setGeneralError(error);
      }
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          setGeneralError(null);
          save.mutate(values);
        })}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="grid flex-1 content-start gap-5 overflow-y-auto p-5">
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(generalError)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <TextField<Values>
              name="tacCode"
              label="TAC code"
              disabled={Boolean(occupancy)}
              description={occupancy ? 'The code cannot change.' : 'For example 2001 or 1001_2.'}
            />
            <TextField<Values> name="description" label="Description" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ChoiceField<Values> name="riskGrade" label="Risk grade" options={GRADE_OPTIONS} />
            <ChoiceField<Values>
              name="fireRiskType"
              label="Fire risk type"
              options={RISK_TYPE_OPTIONS}
            />
            <ChoiceField<Values>
              name="terrorismRiskType"
              label="Terrorism risk type"
              options={RISK_TYPE_OPTIONS}
            />
          </div>
          <fieldset className="grid gap-4">
            <legend className="mb-1 text-sm font-medium">Rates (per mille)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <RateField<Values> name="iibRate" label="IIB rate" />
              <RateField<Values> name="minStfiRate" label="Minimum STFI rate" />
            </div>
            <TextField<Values>
              name="iibRateNote"
              label="IIB rate note"
              description="Only when the master gives text instead of a rate, as for code 2191."
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {EQ_ZONES.map((zone) => (
                <RateField<Values>
                  key={zone}
                  name={`minEqRates.zone${zone}`}
                  label={`Min EQ ${EQ_ZONE_LABELS[zone]}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a rate blank when the master has none; rating reports it as a data error rather
              than guessing.
            </p>
          </fieldset>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {occupancy ? 'Save changes' : 'Add occupancy'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Adds an occupancy to the active master, or corrects one (Admin). Audited field by field. */
export function OccupancyFormSheet({
  occupancy,
  trigger,
  onSaved,
}: {
  occupancy?: Occupancy;
  trigger: ReactNode;
  onSaved?: (saved: Occupancy) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {occupancy ? `Edit occupancy ${occupancy.tacCode}` : 'Add occupancy'}
          </SheetTitle>
          <SheetDescription>
            Changes apply at once to the active master: lookups, client forms and the Fire rate
            check. Each change is recorded in the audit log with the old and new values.
          </SheetDescription>
        </SheetHeader>
        <OccupancyForm
          occupancy={occupancy}
          onSaved={(saved) => {
            setOpen(false);
            onSaved?.(saved);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
