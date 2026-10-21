'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { StageBadge, TypeBadge } from '@/components/proposals/badges';
import { InsurersRfqPanel } from '@/components/proposals/rfq/insurers-rfq-panel';
import { MailLog } from '@/components/proposals/rfq/mail-log';
import { StageStepper } from '@/components/proposals/sections';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientApprovalPanel } from '@/components/proposals/client-approval/client-approval-panel';
import { CoverageConfirmationPanel } from '@/components/proposals/coverage-confirmation/coverage-confirmation-panel';
import { PlacementSlipPanel } from '@/components/proposals/placement-slip/placement-slip-panel';
import { QcrPanel } from '@/components/proposals/qcr/qcr-panel';
import { QuotesPanel } from '@/components/proposals/quotes/quotes-panel';
import { RfqReviewPanel } from '@/components/proposals/rfq-review/rfq-review-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { proposalRecordQuery } from '@/lib/api/new-business';
import { formatInr } from '@/lib/money';
import {
  PROPOSAL_STAGES,
  formatDate,
  formatDateTime,
  hasRfq,
  wholeRupees,
  type ProposalRecord,
} from '@/shared';
import { ExistingPolicyCard, StageControls } from './case-controls';
import {
  CASE_TABS,
  CASE_TAB_LABELS,
  NEXT_WORK_TAB,
  STAGE_TAB,
  TAB_COMPLETES,
  type CaseTab,
} from './case-tabs';
import { DataSheetForm } from './data-sheet-form';

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
  // The tab asked for in the link (?tab=rfq from the RFQ page), else where the case's work goes
  // on next, by its stage.
  const [tab, setTab] = useState<string>(
    () => CASE_TABS.find((value) => value === initialTab) ?? NEXT_WORK_TAB[record.stage],
  );
  const reached = PROPOSAL_STAGES.indexOf(record.stage);
  const done = (value: CaseTab) => {
    const stage = TAB_COMPLETES[value];
    return (
      record.stage !== 'CLOSED' && stage !== undefined && reached >= PROPOSAL_STAGES.indexOf(stage)
    );
  };
  const sent = record.insurers.filter((insurer) => hasRfq(insurer.status)).length;

  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {record.client.name}
          </h1>
          <TypeBadge type={record.type} />
          <StageBadge stage={record.stage} />
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {record.reference} · {record.client.city || record.client.state} ·{' '}
          {record.client.gstin ?? 'No GSTIN'} · Assigned to {record.owner.name}
        </p>
        {record.product ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Policy: </span>
            <span className="font-medium">{record.product.name}</span>
            <span className="text-muted-foreground">
              {record.product.source === 'SUGGESTED'
                ? ' — suggested by the Fire sum insured'
                : record.product.source === 'CHOSEN'
                  ? ' — chosen'
                  : ` — chosen over ${record.suggestedProducts.map((p) => p.code).join(' or ')}${record.product.reason ? `: ${record.product.reason}` : ''}`}
            </span>
          </p>
        ) : null}
      </div>

      {record.stage === 'CLOSED' ? (
        <Alert variant="info" className="mb-6">
          <XCircle aria-hidden="true" />
          <AlertTitle>This case is closed</AlertTitle>
          <AlertDescription>{record.closedReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-4 *:min-w-0 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <StageStepper
            stage={record.stage}
            onSelect={(stage) => setTab(STAGE_TAB[stage])}
            selected={PROPOSAL_STAGES.findLast((stage) => STAGE_TAB[stage] === tab)}
          />
          {canEdit ? <StageControls record={record} onOpenTab={setTab} /> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
          <Fact label="Policy period">
            {record.policyStart
              ? `${formatDate(record.policyStart)} – ${record.policyEnd ? formatDate(record.policyEnd) : '1 year'}`
              : '1 year from payment'}
          </Fact>
          <Fact label="Quotes needed by">{formatDate(record.dueDate)}</Fact>
          <Fact label="Fire sum insured">{formatInr(wholeRupees(record.fire.proposed1))}</Fact>
          <Fact label="Locations">{record.locations.length}</Fact>
          <Fact label="RFQ sent to">
            {sent} of {record.insurers.length} insurers
          </Fact>
        </dl>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="data-sheet">
            {done('data-sheet') ? (
              <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
            ) : null}
            Data Sheet
            {done('data-sheet') ? <span className="sr-only">, done</span> : null}
            {record.locked ? null : record.missing.length > 0 ? (
              <Badge variant="warning" className="ml-1 tabular">
                {record.missing.length}
                <span className="sr-only"> items needed</span>
              </Badge>
            ) : null}
          </TabsTrigger>
          {CASE_TABS.filter((value) => value !== 'data-sheet').map((value) => (
            <TabsTrigger key={value} value={value}>
              {done(value) ? (
                <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
              ) : value === NEXT_WORK_TAB[record.stage] && record.stage !== 'CLOSED' ? (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              ) : null}
              {CASE_TAB_LABELS[value]}
              {done(value) ? <span className="sr-only">, done</span> : null}
              {!done(value) &&
              value === NEXT_WORK_TAB[record.stage] &&
              record.stage !== 'CLOSED' ? (
                <span className="sr-only">, next step</span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Mounted while hidden, so unsaved Data Sheet entries survive a look at another tab. */}
        <TabsContent
          value="data-sheet"
          forceMount
          className="grid min-w-0 gap-6 *:min-w-0 data-[state=inactive]:hidden"
        >
          {record.type === 'EXISTING' ? (
            <ExistingPolicyCard record={record} canEdit={canEdit} />
          ) : null}
          <DataSheetForm record={record} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="review" className="min-w-0">
          <RfqReviewPanel record={record} />
        </TabsContent>
        <TabsContent value="rfq" className="min-w-0">
          <InsurersRfqPanel record={record} />
        </TabsContent>
        <TabsContent value="quotes" className="min-w-0">
          <QuotesPanel record={record} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="qcr" className="min-w-0">
          <QcrPanel record={record} />
        </TabsContent>
        <TabsContent value="client-approval" className="min-w-0">
          <ClientApprovalPanel record={record} />
        </TabsContent>
        <TabsContent value="placement-slip" className="min-w-0">
          <PlacementSlipPanel record={record} />
        </TabsContent>
        <TabsContent value="coverage-confirmation" className="min-w-0">
          <CoverageConfirmationPanel record={record} />
        </TabsContent>
        <TabsContent value="activity" className="grid gap-6">
          <MailLog proposalId={record.id} />
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
                  {event.actorRole ? `, ${event.actorRole}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
