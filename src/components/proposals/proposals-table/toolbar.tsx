'use client';

import { Search } from 'lucide-react';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { STAGES, STAGE_LABELS, type Stage } from '@/types/proposal';

/** Search box and stage select. The stage select mirrors the pipeline strip. */
export function TableToolbar({
  query,
  onQuery,
  stage,
  onStage,
  resultCount,
}: {
  query: string;
  onQuery: (value: string) => void;
  stage: Stage | null;
  onStage: (stage: Stage | null) => void;
  resultCount: number;
}) {
  const searchId = useId();
  const stageId = useId();

  return (
    <div className="flex flex-wrap items-end gap-3 p-3">
      <div className="grid gap-1">
        <label htmlFor={searchId} className="text-xs font-medium text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Reference or client"
            className="w-56 pl-8"
          />
        </div>
      </div>
      <div className="grid gap-1">
        <label htmlFor={stageId} className="text-xs font-medium text-muted-foreground">
          Stage
        </label>
        <select
          id={stageId}
          value={stage ?? ''}
          onChange={(event) => onStage((event.target.value || null) as Stage | null)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All stages</option>
          {STAGES.map((value) => (
            <option key={value} value={value}>
              {STAGE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <p role="status" className="ml-auto self-center text-sm text-muted-foreground tabular">
        {resultCount} {resultCount === 1 ? 'proposal' : 'proposals'}
      </p>
    </div>
  );
}
