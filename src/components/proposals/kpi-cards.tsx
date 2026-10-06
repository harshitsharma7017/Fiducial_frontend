'use client';

import { ErrorState } from '@/components/states';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/lib/api/proposals';
import { formatInrCompact } from '@/lib/money';
import type { DashboardStats } from '@/lib/proposal-metrics';
import type { ProposalType } from '@/types/proposal';

interface Kpi {
  label: string;
  value: number;
  helper: string;
}

/** The four KPIs for a type (design.md KPI definitions). Amounts are Fire SI (Proposed 1). */
function kpisFor(type: ProposalType, stats: DashboardStats): Kpi[] {
  if (type === 'NEW') {
    return [
      {
        label: 'Open proposals',
        value: stats.openCount,
        helper: `${formatInrCompact(stats.openSum)} total sum insured`,
      },
      {
        label: 'Awaiting quotes',
        value: stats.awaitingQuotes,
        helper: `${stats.awaitingQuotesInsurers} insurer${stats.awaitingQuotesInsurers === 1 ? '' : 's'} awaiting response`,
      },
      {
        label: 'Pending approval',
        value: stats.pendingApproval,
        helper: `${formatInrCompact(stats.pendingApprovalSum)} at QCR`,
      },
      {
        label: 'Placed this month',
        value: stats.placedThisMonth,
        helper: `${formatInrCompact(stats.placedThisMonthSum)} placed`,
      },
    ];
  }
  const nearest = stats.nearestDue
    ? `Nearest: ${stats.nearestDue.client}, ${nearestDays(stats.nearestDue.days)}`
    : 'None due within 30 days';
  return [
    { label: 'Renewals due in 30 days', value: stats.dueIn30, helper: nearest },
    {
      label: 'Renewals due in 60 days',
      value: stats.dueIn60,
      helper: `31 to 60 days from today · ${formatInrCompact(stats.dueIn60Sum)}`,
    },
    {
      label: 'Awaiting quotes',
      value: stats.awaitingQuotes,
      helper: `${stats.awaitingQuotesInsurers} insurer${stats.awaitingQuotesInsurers === 1 ? '' : 's'} awaiting response`,
    },
    {
      label: 'Placed this month',
      value: stats.placedThisMonth,
      helper: `${formatInrCompact(stats.placedThisMonthSum)} placed`,
    },
  ];
}

function nearestDays(days: number): string {
  if (days < 0) return `expired ${-days} ${-days === 1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'due today';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

const CARD_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4';

export function KpiCards({ type }: { type: ProposalType }) {
  const stats = useDashboardStats(type);

  if (stats.isPending) {
    return (
      <div className={CARD_GRID} role="status" aria-label="Loading key figures">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent className="grid gap-2 pt-6">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (stats.isError) {
    return (
      <ErrorState
        error={stats.error}
        onRetry={() => void stats.refetch()}
        title="Key figures unavailable"
      />
    );
  }

  return (
    <div className={CARD_GRID}>
      {kpisFor(type, stats.data).map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="grid gap-1 pt-6">
            <span className="text-2xl font-semibold tabular">{kpi.value}</span>
            <span className="text-sm font-medium">{kpi.label}</span>
            <span className="text-xs text-muted-foreground">{kpi.helper}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
