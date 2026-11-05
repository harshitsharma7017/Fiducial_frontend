'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EB_MAX_QUOTE_OPTIONS } from '@/shared';
import { SumInsuredBasisFields, type BasisValue } from './sum-insured-basis-fields';

/**
 * Options 2–4 of a GPA or GTLI case (client review 4/11/2026), as in GMC and Fire: other sum insured
 * bases each insurer quotes besides Option 1 (the basis above). Options are numbered in the order
 * added and can be deleted.
 */
export function EbQuoteOptions({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: { basis: BasisValue }[];
  onChange: (value: { basis: BasisValue }[]) => void;
  disabled: boolean;
  errors: Record<string, string>;
}) {
  const fieldErrors = (index: number) => {
    const path = `quoteOptions.${index}.basis`;
    return {
      kind: errors[path],
      amount: errors[`${path}.amount`],
      amounts: errors[`${path}.amounts`],
      multiplier: errors[`${path}.multiplier`],
      maximum: errors[`${path}.maximum`],
    };
  };
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="text-sm">Options for the insurers to quote</legend>
      <p className="text-xs text-muted-foreground">
        Option 1 is the basis above. Add up to three more options; each insurer quotes a premium for
        every option.
      </p>
      {value.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Option {index + 2}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete Option ${index + 2}`}
              onClick={() => onChange(value.filter((_, at) => at !== index))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <SumInsuredBasisFields
            value={item.basis}
            disabled={disabled}
            errors={fieldErrors(index)}
            onChange={(basis) =>
              onChange(value.map((entry, at) => (at === index ? { basis } : entry)))
            }
          />
        </div>
      ))}
      {value.length < EB_MAX_QUOTE_OPTIONS - 1 ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...value, { basis: null }])}
          >
            <Plus aria-hidden="true" />
            Add Option {value.length + 2}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}
