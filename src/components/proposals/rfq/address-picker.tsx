'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ProposalInsurer } from '@/shared';

export interface AddressOption {
  email: string;
  /** The contact's name and designation, or null for an RFQ address. */
  contact: string | null;
}

/** The insurer's own addresses from the insurer master: RFQ addresses first, then contacts. */
export function addressOptions(insurer: ProposalInsurer): AddressOption[] {
  const options: AddressOption[] = insurer.rfqEmails.map((email) => ({ email, contact: null }));
  for (const contact of insurer.contacts) {
    const email = contact.email.toLowerCase();
    if (options.some((option) => option.email === email)) continue;
    options.push({
      email,
      contact: contact.designation ? `${contact.name}, ${contact.designation}` : contact.name,
    });
  }
  return options;
}

/**
 * Checkboxes for an insurer's addresses. There is no text field: mails go only to addresses in
 * the insurer master (requirement 4.3).
 */
export function AddressPicker({
  insurer,
  selected,
  onChange,
  disabled = false,
}: {
  insurer: ProposalInsurer;
  selected: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const baseId = useId();
  const name = `${insurer.company}, ${insurer.branch}`;
  const options = addressOptions(insurer);
  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="sr-only">Addresses for {name}</legend>
      {options.map((option, index) => {
        const id = `${baseId}-${index}`;
        const checked = selected.includes(option.email);
        return (
          <div key={option.email} className="flex items-start gap-2">
            <Checkbox
              id={id}
              className="mt-0.5"
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) =>
                onChange(
                  value === true
                    ? [...selected, option.email]
                    : selected.filter((email) => email !== option.email),
                )
              }
            />
            <Label htmlFor={id} className="grid gap-0 font-normal">
              <span className="text-sm break-all">{option.email}</span>
              <span className="text-xs text-muted-foreground">
                {option.contact ? `Contact: ${option.contact}` : 'RFQ address'}
              </span>
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}
