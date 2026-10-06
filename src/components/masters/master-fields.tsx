'use client';

import type { ReactNode } from 'react';
import { useFormContext, type FieldValues, type Path } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

/** A per-mille rate: text, so it is kept exactly as typed (0.075 stays 0.075). Blank is no rate. */
export function RateField<T extends FieldValues>({
  name,
  label,
  description,
}: {
  name: Path<T>;
  label: ReactNode;
  description?: string;
}) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ''}
              inputMode="decimal"
              autoComplete="off"
              placeholder="—"
              className="tabular"
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** A choice from a short list, with a blank option for "none". */
export function ChoiceField<T extends FieldValues>({
  name,
  label,
  options,
  blankLabel = 'Not set',
}: {
  name: Path<T>;
  label: string;
  options: readonly { value: string; label: string }[];
  blankLabel?: string;
}) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NativeSelect
              {...field}
              value={field.value === null || field.value === undefined ? '' : String(field.value)}
            >
              <option value="">{blankLabel}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** A plain text field. */
export function TextField<T extends FieldValues>({
  name,
  label,
  disabled,
  description,
  className,
}: {
  name: Path<T>;
  label: string;
  disabled?: boolean;
  description?: string;
  className?: string;
}) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={field.value ?? ''} disabled={disabled} autoComplete="off" />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
