'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProposalSummary } from '@/lib/proposal-metrics';
import { INSURER_STATUS_LABELS } from '@/shared';

/**
 * Responded (Quoted or Declined) out of the insurers listed, with the count per status in a
 * tooltip on hover or focus, and in the accessible name (rfq-email requirement 9.3).
 */
export function InsurersCell({ item }: { item: ProposalSummary }) {
  if (item.insurersListed === 0) return <>None yet</>;
  const breakdown = item.insurerStatusCounts
    .map(({ status, count }) => `${count} ${INSURER_STATUS_LABELS[status]}`)
    .join(', ');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.insurersResponded}/{item.insurersListed}
            <span className="sr-only"> responded: {breakdown}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{breakdown}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
