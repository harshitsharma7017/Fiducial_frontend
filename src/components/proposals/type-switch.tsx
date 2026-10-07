'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProposalType } from '@/types/proposal';

/**
 * The dashboard's two-option control. Radix Tabs give a tablist with roving focus and arrow-key
 * movement; selecting a tab changes the whole dashboard and the URL (handled by the parent).
 */
export function TypeSwitch({
  type,
  counts,
  onChange,
}: {
  type: ProposalType;
  counts: { NEW: number | null; EXISTING: number | null };
  onChange: (type: ProposalType) => void;
}) {
  return (
    <Tabs
      value={type}
      onValueChange={(value) => onChange(value as ProposalType)}
      aria-label="Proposal type"
    >
      <TabsList className="h-auto max-w-full flex-wrap">
        <TabsTrigger value="NEW">
          New proposals
          <Count value={counts.NEW} />
        </TabsTrigger>
        <TabsTrigger value="EXISTING">
          Existing proposals (renewals)
          <Count value={counts.EXISTING} />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function Count({ value }: { value: number | null }) {
  return (
    <span className="min-w-5 rounded-full bg-muted px-1.5 text-center text-xs tabular group-data-[state=active]:bg-primary-soft">
      {value ?? '—'}
    </span>
  );
}
