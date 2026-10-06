'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '@/components/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStats } from '@/lib/api/proposals';
import { formatInrCompact } from '@/lib/money';
import { PRODUCTS, STAGES, STAGE_LABELS, type ProposalType } from '@/types/proposal';
import { useState } from 'react';

type View = 'stage' | 'product';

interface Row {
  label: string;
  value: number;
  display: string;
}

/** A crore figure for a bar's height (drawing only); labels use formatInrCompact. */
function toCrore(rupees: string): number {
  return Number((BigInt(rupees) * 100n) / 10_000_000n) / 100;
}

/**
 * One bar chart with a tab control: proposals by stage, or Fire SI (Proposed 1) by product.
 * Colours come from the theme tokens, so a theme change needs no reload. The SVG is hidden from
 * assistive technology; a visually hidden table carries the same values.
 */
export function StageChart({ type }: { type: ProposalType }) {
  const stats = useDashboardStats(type);
  const [view, setView] = useState<View>('stage');

  const title = view === 'stage' ? 'Proposals by stage' : 'Sum insured by product';

  let body;
  if (stats.isPending) {
    body = <Skeleton className="h-64 w-full" />;
  } else if (stats.isError) {
    body = (
      <ErrorState
        error={stats.error}
        onRetry={() => void stats.refetch()}
        title="Chart unavailable"
      />
    );
  } else {
    const rows: Row[] =
      view === 'stage'
        ? STAGES.map((stage) => ({
            label: STAGE_LABELS[stage],
            value: stats.data.stageCounts[stage],
            display: String(stats.data.stageCounts[stage]),
          }))
        : PRODUCTS.map((product) => ({
            label: product,
            value: toCrore(stats.data.sumInsuredByProduct[product]),
            display: formatInrCompact(stats.data.sumInsuredByProduct[product]),
          }));
    const fill = view === 'stage' ? 'var(--chart-1)' : 'var(--chart-2)';
    const empty = rows.every((row) => row.value === 0);

    body = empty ? (
      <p className="grid h-64 place-items-center text-sm text-muted-foreground">
        No proposals of this type yet
      </p>
    ) : (
      <>
        <div className="h-64" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              accessibilityLayer={false}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                interval={0}
              />
              <YAxis
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--popover-foreground)',
                }}
                formatter={(_value, _name, item: { payload?: Row }) => [
                  item.payload?.display,
                  title,
                ]}
              />
              <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{view === 'stage' ? 'Stage' : 'Product'}</th>
              <th scope="col">{view === 'stage' ? 'Proposals' : 'Fire SI (Proposed 1)'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as View)}
          aria-label="Chart figure"
        >
          <TabsList>
            <TabsTrigger value="stage">By stage</TabsTrigger>
            <TabsTrigger value="product">By product</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
