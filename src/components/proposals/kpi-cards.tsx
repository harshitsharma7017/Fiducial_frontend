'use client';

import Link from 'next/link';
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
  /** Where the figure's cases are listed. */
  href?: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Insurers that are Sent or Reminded on open cases (rfq-email requirement 9.1). */
function awaitingKpi(stats: DashboardStats): Kpi {
  return {
    label: 'Awaiting quotes',
    value: stats.awaitingQuotesInsurers,
    helper: `${plural(stats.awaitingQuotesInsurers, 'insurer')} on ${plural(stats.awaitingQuotes, 'case')}`,
  };
}

/** Insurers still waiting after their quote due date (requirement 9.2). */
function overdueKpi(stats: DashboardStats): Kpi {
  return {
    label: 'Overdue responses',
    value: stats.overdueInsurers,
    helper:
      stats.overdueInsurers === 0
        ? 'No insurer is past its due date'
        : `Past the due date on ${plural(stats.overdueCases, 'case')}`,
    href: '/rfq?filter=overdue',
  };
}

/** The KPIs for a type (design.md KPI definitions). Amounts are Fire SI (Proposed 1). */
function kpisFor(type: ProposalType, stats: DashboardStats): Kpi[] {
  if (type === 'NEW') {
    return [
      {
        label: 'Open proposals',
        value: stats.openCount,
        helper: `${formatInrCompact(stats.openSum)} total sum insured`,
      },
      awaitingKpi(stats),
      overdueKpi(stats),
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
    awaitingKpi(stats),
    overdueKpi(stats),
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

const CARD_GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

export function KpiCards({ type }: { type: ProposalType }) {
  const stats = useDashboardStats(type);

  if (stats.isPending) {
    return (
      <div className={CARD_GRID} role="status" aria-label="Loading key figures">
        {Array.from({ length: 5 }, (_, index) => (
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
        <Card key={kpi.label} className={kpi.href ? 'relative hover:bg-muted/50' : undefined}>
          <CardContent className="grid gap-1 pt-6">
            <span className="text-2xl font-semibold tabular">{kpi.value}</span>
            {kpi.href ? (
              <Link
                href={kpi.href}
                className="rounded-sm text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {kpi.label}
              </Link>
            ) : (
              <span className="text-sm font-medium">{kpi.label}</span>
            )}
            <span className="text-xs text-muted-foreground">{kpi.helper}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
