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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { applyServerFieldErrors } from '@/lib/form-errors';
import {
  CreatePincodeRequestSchema,
  EQ_ZONES,
  EQ_ZONE_LABELS,
  PincodeRecordSchema,
  type CreatePincodeRequest,
  type PincodeFormValues,
  type PincodeRecord,
} from '@/shared';

type Values = PincodeFormValues;

const ZONE_OPTIONS = EQ_ZONES.map((zone) => ({ value: String(zone), label: EQ_ZONE_LABELS[zone] }));

function toFormValues(record: PincodeRecord | undefined): Values {
  return {
    pincode: record?.pincode ?? '',
    state: record?.state ?? '',
    district: record?.district ?? '',
    eqZone: record?.eqZone ? (String(record.eqZone) as '1' | '2' | '3' | '4') : '',
    eqRates: {
      residential: record?.eqRates.residential ?? '',
      nonIndustrial: record?.eqRates.nonIndustrial ?? '',
      industrial: record?.eqRates.industrial ?? '',
    },
  };
}

function PincodeForm({
  record,
  onSaved,
  onCancel,
}: {
  record?: PincodeRecord;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [generalError, setGeneralError] = useState<unknown>(null);
  const form = useForm<Values, unknown, CreatePincodeRequest>({
    resolver: zodResolver(CreatePincodeRequestSchema),
    defaultValues: toFormValues(record),
    mode: 'onTouched',
  });

  const save = useMutation({
    mutationFn: ({ pincode, ...fields }: CreatePincodeRequest) =>
      record
        ? apiFetch(`masters/pincodes/${record.pincode}`, {
            method: 'PATCH',
            body: fields,
            schema: PincodeRecordSchema,
          })
        : apiFetch('masters/pincodes', {
            method: 'POST',
            body: { pincode, ...fields },
            schema: PincodeRecordSchema,
          }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast({
        title: record ? 'Pincode updated' : 'Pincode added',
        description: `${saved.pincode} · ${saved.district}`,
        variant: 'success',
      });
      onSaved();
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError, { CONFLICT: 'pincode' })) {
        setGeneralError(error);
      }
    },
  });

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit((values) => {
          setGeneralError(null);
          save.mutate(values);
        })}
      >
        {generalError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(generalError)}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField<Values>
            name="pincode"
            label="Pincode"
            disabled={Boolean(record)}
            description={record ? 'The pincode cannot change.' : '6 digits.'}
          />
          <ChoiceField<Values> name="eqZone" label="AIFT earthquake zone" options={ZONE_OPTIONS} />
          <TextField<Values> name="district" label="District" />
          <TextField<Values> name="state" label="State" />
        </div>
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">EQ rates (per mille)</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <RateField<Values> name="eqRates.residential" label="Residential" />
            <RateField<Values> name="eqRates.nonIndustrial" label="Non-industrial" />
            <RateField<Values> name="eqRates.industrial" label="Industrial" />
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Risk locations saved earlier keep the state, district and zone they were given.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {record ? 'Save changes' : 'Add pincode'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** Adds a pincode to the active master, or corrects one (Admin). Audited field by field. */
export function PincodeFormDialog({
  record,
  trigger,
}: {
  record?: PincodeRecord;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? `Edit pincode ${record.pincode}` : 'Add pincode'}</DialogTitle>
          <DialogDescription>
            Changes apply at once to the active pincode master and are recorded in the audit log
            with the old and new values.
          </DialogDescription>
        </DialogHeader>
        <PincodeForm
          record={record}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
