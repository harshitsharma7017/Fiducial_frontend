'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { StageBadge, TypeBadge } from '@/components/proposals/badges';
import { StageStepper } from '@/components/proposals/sections';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { proposalRecordQuery } from '@/lib/api/new-business';
import { formatInr } from '@/lib/money';
import { formatDate, formatDateTime, type ProposalRecord } from '@/shared';
import { DataSheetForm } from './data-sheet-form';
import { InsurersRfqPanel } from './insurers-rfq-panel';

/**
 * A new-business proposal from the API, worked from creation to the RFQ: the Data Sheet, the
 * insurers and the RFQ, and what happened so far.
 */
export function ProposalWorkspace({ id, initialTab }: { id: string; initialTab?: string }) {
  return (
    <DemoModeGate>
      <Workspace id={id} initialTab={initialTab} />
    </DemoModeGate>
  );
}

const TABS = ['data-sheet', 'rfq', 'activity'] as const;

function Workspace({ id, initialTab }: { id: string; initialTab?: string }) {
  const proposal = useQuery(proposalRecordQuery(id));

  if (proposal.isPending) return <LoadingState label="Loading proposal" className="max-w-xl" />;
  if (proposal.isError) {
    if (proposal.error instanceof ApiError && proposal.error.status === 404) {
      return (
        <EmptyState
          title="Proposal not found"
          description={
            <>
              It may have been removed. Go back to the{' '}
              <Link href="/proposals?type=new" className="text-accent-strong hover:underline">
                new proposals
              </Link>
              .
            </>
          }
          className="mx-auto max-w-md"
        />
      );
    }
    return <ErrorState error={proposal.error} onRetry={() => void proposal.refetch()} />;
  }
  return <Loaded record={proposal.data} initialTab={initialTab} />;
}

function Loaded({ record, initialTab }: { record: ProposalRecord; initialTab?: string }) {
  const canEdit = usePermission('proposals.edit');
  // The tab asked for in the link (?tab=rfq from the RFQ page), else where the work is: the
  // Data Sheet until it is complete, then the RFQ.
  const [tab, setTab] = useState<string>(
    () =>
      TABS.find((value) => value === initialTab) ??
      (record.missing.length === 0 ? 'rfq' : 'data-sheet'),
  );
  const sent = record.insurers.filter((insurer) => insurer.status === 'SENT').length;

  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {record.client.name}
          </h1>
          <TypeBadge type="NEW" />
          <StageBadge stage={record.stage} />
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {record.reference} · {record.client.city || record.client.state} ·{' '}
          {record.client.gstin ?? 'No GSTIN'} · Owner {record.owner.name}
        </p>
        {record.suggestedProducts.length > 0 ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Suggested product: </span>
            {record.suggestedProducts.map((product, index) => (
              <span key={product.code}>
                {index > 0 ? ' or ' : null}
                <abbr
                  title={`${product.name} (${product.range})`}
                  className="font-medium no-underline"
                >
                  {product.code}
                </abbr>
              </span>
            ))}
            <span className="text-muted-foreground"> — chosen at the QCR</span>
          </p>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 *:min-w-0 lg:grid-cols-[1fr_auto]">
        <StageStepper stage={record.stage} />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
          <Fact label="Quotes needed by">{formatDate(record.dueDate)}</Fact>
          <Fact label="Fire sum insured">{formatInr(record.fire.proposed1)}</Fact>
          <Fact label="Locations">{record.locations.length}</Fact>
          <Fact label="RFQ sent to">
            {sent} of {record.insurers.length} insurers
          </Fact>
        </dl>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="data-sheet">
            Data Sheet
            {record.locked ? null : record.missing.length > 0 ? (
              <Badge variant="warning" className="ml-1 tabular">
                {record.missing.length}
                <span className="sr-only"> items needed</span>
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="rfq">Insurers and RFQ</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        {/* Mounted while hidden, so unsaved Data Sheet entries survive a look at another tab. */}
        <TabsContent value="data-sheet" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <DataSheetForm record={record} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="rfq" className="min-w-0">
          <InsurersRfqPanel record={record} />
        </TabsContent>
        <TabsContent value="activity">
          <Activity record={record} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular">{children}</dd>
    </div>
  );
}

function Activity({ record }: { record: ProposalRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {record.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="grid gap-3">
            {record.activity.map((event, index) => (
              <li
                key={`${event.at}-${index}`}
                className="grid gap-0.5 border-l-2 border-border pl-3"
              >
                <p className="text-sm">{event.message}</p>
                <p className="text-xs text-muted-foreground tabular">
                  {formatDateTime(event.at)} · {event.actor}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
