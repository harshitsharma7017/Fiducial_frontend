'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { PincodeSummary } from '@/components/forms/pincode-summary';
import { OccupancyField } from '@/components/rating/occupancy-picker';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { applyServerFieldErrors } from '@/lib/form-errors';
import { queryKeys } from '@/lib/query-keys';
import {
  ClientLocationSchema,
  CreateClientLocationRequestSchema,
  type Client,
  type ClientLocation,
  type CreateClientLocationFormValues,
  type CreateClientLocationRequest,
} from '@/shared';

function toFormValues(location: ClientLocation | undefined): CreateClientLocationFormValues {
  return {
    name: location?.name ?? '',
    line1: location?.address.line1 ?? '',
    line2: location?.address.line2 ?? '',
    city: location?.address.city ?? '',
    pincode: location?.address.pincode ?? '',
    occupancyCode: location?.occupancy?.tacCode ?? '',
  };
}

function LocationForm({
  client,
  location,
  onSaved,
  onCancel,
}: {
  client: Client;
  location?: ClientLocation;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const ownOccupancyId = useId();
  const [ownOccupancy, setOwnOccupancy] = useState(Boolean(location?.occupancy));
  const [generalError, setGeneralError] = useState<unknown>(null);
  const form = useForm<CreateClientLocationFormValues, unknown, CreateClientLocationRequest>({
    resolver: zodResolver(CreateClientLocationRequestSchema),
    defaultValues: toFormValues(location),
    mode: 'onTouched',
  });
  const pincode = useWatch({ control: form.control, name: 'pincode' });

  const save = useMutation({
    mutationFn: (body: CreateClientLocationRequest) =>
      location
        ? apiFetch(`clients/${client.id}/locations/${location.id}`, {
            method: 'PATCH',
            body,
            schema: ClientLocationSchema,
          })
        : apiFetch(`clients/${client.id}/locations`, {
            method: 'POST',
            body,
            schema: ClientLocationSchema,
          }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toast({
        title: location ? 'Risk location updated' : 'Risk location added',
        description: saved.name,
        variant: 'success',
      });
      onSaved();
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError)) setGeneralError(error);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    // Unticked means the location has the client's occupancy, which the API stores as null.
    if (ownOccupancy && !values.occupancyCode) {
      form.setError('occupancyCode', { message: "Choose this location's occupancy" });
      return;
    }
    setGeneralError(null);
    save.mutate({ ...values, occupancyCode: ownOccupancy ? values.occupancyCode : null });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {generalError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(generalError)}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location name</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder="For example Plant 2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="line1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address line 1</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="line2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Address line 2 <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
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
                    autoComplete="off"
                    className="tabular"
                  />
                </FormControl>
                <FormMessage />
                <PincodeSummary pincode={pincode} />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id={ownOccupancyId}
              checked={ownOccupancy}
              onCheckedChange={(checked) => {
                setOwnOccupancy(checked === true);
                form.clearErrors('occupancyCode');
              }}
              className="mt-0.5"
            />
            <Label htmlFor={ownOccupancyId} className="leading-snug font-normal">
              This location has a different occupancy from the client&apos;s (
              {client.occupancy.tacCode} — {client.occupancy.description})
            </Label>
          </div>
          {ownOccupancy ? (
            <FormField
              control={form.control}
              name="occupancyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location occupancy</FormLabel>
                  <OccupancyField
                    ref={field.ref}
                    initialValue={location?.occupancy}
                    onBlur={field.onBlur}
                    onSelect={(choice) => field.onChange(choice?.tacCode ?? '')}
                  />
                  <FormDescription>From the active IIB occupancy master.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {location ? 'Save location' : 'Add location'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** Adds a risk location to a client, or edits one. The pincode fills the state and EQ zone. */
export function LocationFormDialog({
  client,
  location,
  trigger,
}: {
  client: Client;
  location?: ClientLocation;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{location ? 'Edit risk location' : 'Add risk location'}</DialogTitle>
          <DialogDescription>
            {client.name}. The state, district and earthquake zone come from the pincode master.
          </DialogDescription>
        </DialogHeader>
        <LocationForm
          client={client}
          location={location}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
