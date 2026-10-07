'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ProposalInsurer } from '@/shared';
import { AddressPicker } from './address-picker';

export type Picks = Record<string, { chosen: boolean; to: string[] }>;

/** Every Not sent insurer chosen, with its RFQ addresses ticked and its contacts not (4.2, 4.4). */
export function initialPicks(insurers: readonly ProposalInsurer[]): Picks {
  return Object.fromEntries(
    insurers.map((insurer) => [insurer.insurerId, { chosen: true, to: [...insurer.rfqEmails] }]),
  );
}

/** The insurers to mail, each with its own addresses from the insurer master. */
export function RecipientChoice({
  insurers,
  picks,
  onChange,
}: {
  insurers: readonly ProposalInsurer[];
  picks: Picks;
  onChange: (next: Picks) => void;
}) {
  const baseId = useId();
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">Insurers and addresses</legend>
      {insurers.map((insurer) => {
        const pick = picks[insurer.insurerId] ?? { chosen: false, to: [] };
        const name = `${insurer.company}, ${insurer.branch}`;
        const checkboxId = `${baseId}-${insurer.insurerId}`;
        return (
          <div key={insurer.insurerId} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={pick.chosen}
                onCheckedChange={(value) =>
                  onChange({
                    ...picks,
                    [insurer.insurerId]: { ...pick, chosen: value === true },
                  })
                }
              />
              <Label htmlFor={checkboxId} className="font-medium">
                {name}
              </Label>
            </div>
            {pick.chosen ? (
              <div className="pl-6">
                <AddressPicker
                  insurer={insurer}
                  selected={pick.to}
                  onChange={(to) =>
                    onChange({
                      ...picks,
                      [insurer.insurerId]: { ...pick, to },
                    })
                  }
                />
                {pick.to.length === 0 ? (
                  <p className="mt-1 text-sm text-destructive">Tick at least one address.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
