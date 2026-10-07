'use client';

import { useDashboardStats } from '@/lib/api/proposals';
import { cn } from '@/lib/utils';
import { STAGES, STAGE_LABELS, type ProposalType, type Stage } from '@/types/proposal';

/**
 * The six stages as toggle chips with counts. Selecting one filters the table (via ?stage=);
 * selecting the active one clears the filter. It scrolls horizontally on narrow screens.
 */
export function PipelineStrip({
  type,
  selected,
  onToggle,
}: {
  type: ProposalType;
  selected: Stage | null;
  onToggle: (stage: Stage) => void;
}) {
  const stats = useDashboardStats(type);

  return (
    <div
      role="group"
      aria-label="Filter by stage"
      className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
    >
      {STAGES.map((stage) => {
        const active = selected === stage;
        const count = stats.data?.stageCounts[stage];
        return (
          <button
            key={stage}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(stage)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              active
                ? 'border-primary bg-primary-soft font-medium text-primary'
                : 'border-border hover:bg-muted',
            )}
          >
            <span>{STAGE_LABELS[stage]}</span>
            <span
              className={cn(
                'min-w-5 rounded-full px-1.5 text-center text-xs tabular',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {count ?? '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
