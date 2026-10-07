'use client';

import type { ComponentProps } from 'react';
import { useFormContext, type FieldPath } from 'react-hook-form';
import { SumInsuredInput } from '@/components/rating/sum-insured-input';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DataSheetForm } from '@/lib/data-sheet';
import { cn } from '@/lib/utils';

// Inputs bound to the Data Sheet form. In tables the label is visually hidden (the column header
// shows it) but still names the input for screen readers.

type Name = FieldPath<DataSheetForm>;

interface FieldProps {
  name: Name;
  label: string;
  hideLabel?: boolean;
  description?: string;
  className?: string;
}

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

/** Whole rupees with Indian grouping as you type; decimals are dropped. */
export function RupeesField({ name, label, hideLabel, description, className }: FieldProps) {
  const form = useFormContext<DataSheetForm>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('gap-1', className)}>
          <FormLabel className={cn(hideLabel && 'sr-only')}>{label}</FormLabel>
          <FormControl>
            <SumInsuredInput
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              disabled={field.disabled}
              value={asText(field.value)}
              onValueChange={(value) => field.onChange(value.split('.')[0] ?? '')}
              className="min-w-32 text-right"
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

export function TextField({
  name,
  label,
  hideLabel,
  description,
  className,
  ...input
}: FieldProps & Omit<ComponentProps<'input'>, 'name' | 'value' | 'onChange'>) {
  const form = useFormContext<DataSheetForm>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('gap-1', className)}>
          <FormLabel className={cn(hideLabel && 'sr-only')}>{label}</FormLabel>
          <FormControl>
            <Input
              {...input}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              disabled={field.disabled}
              value={asText(field.value)}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

export function TextAreaField({
  name,
  label,
  description,
  className,
  maxLength,
}: FieldProps & { maxLength: number }) {
  const form = useFormContext<DataSheetForm>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('gap-1', className)}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              disabled={field.disabled}
              maxLength={maxLength}
              rows={2}
              value={asText(field.value)}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
