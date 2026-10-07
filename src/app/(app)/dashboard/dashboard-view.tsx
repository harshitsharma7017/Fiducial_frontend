'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useDashboardStats } from '@/lib/api/proposals';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardHeader } from '@/components/proposals/dashboard-header';
import { KpiCards } from '@/components/proposals/kpi-cards';
import { PipelineStrip } from '@/components/proposals/pipeline-strip';
import { ProposalDrawer, type DrawerTarget } from '@/components/proposals/proposal-drawer';
import { ProposalsTable } from '@/components/proposals/proposals-table/proposals-table';
import { TypeSwitch } from '@/components/proposals/type-switch';
import {
  parseProposalParams,
  proposalParamsToSearch,
  toggleStage,
  withType,
} from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import type { Stage } from '@/types/proposal';

// Recharts is ~148 kB; load it only with the chart, with a skeleton in its place.
const StageChart = dynamic(
  () => import('@/components/proposals/stage-chart').then((module) => module.StageChart),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> },
);

export function DashboardView({ serverSearch }: { serverSearch: string }) {
  const { params, replace } = useUrlSearchParams(serverSearch);
  const { type, stage } = parseProposalParams(params);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  // Counts for the type switch come from each type's stats.
  const newStats = useDashboardStats('NEW');
  const existingStats = useDashboardStats('EXISTING');

  return (
    <>
      <DashboardHeader type={type} />
      <div className="grid gap-6 *:min-w-0">
        <TypeSwitch
          type={type}
          counts={{
            NEW: newStats.data?.total ?? null,
            EXISTING: existingStats.data?.total ?? null,
          }}
          onChange={(next) => replace(proposalParamsToSearch(withType(next)))}
        />
        <KpiCards type={type} />
        <PipelineStrip
          type={type}
          selected={stage}
          onToggle={(next: Stage) =>
            replace(proposalParamsToSearch(toggleStage({ type, stage }, next)))
          }
        />
        <StageChart type={type} />
        <ProposalsTable
          type={type}
          stage={stage}
          onStage={(next) => replace(proposalParamsToSearch({ type, stage: next }))}
          onOpen={(id, trigger) => setDrawer({ id, trigger })}
        />
      </div>
      <ProposalDrawer target={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}
