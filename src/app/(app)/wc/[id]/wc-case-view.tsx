'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Lock } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ErrorState, LoadingState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataSheetEditor } from '@/components/wc/data-sheet-editor';
import { WcPlacementPanel } from '@/components/wc/placement-panel';
import { WcQcrPanel } from '@/components/wc/qcr-panel';
import { QuotesEditor } from '@/components/wc/quotes-editor';
import { WcRfqPanel } from '@/components/wc/rfq-panel';
import { WcDocumentButtons, WcStageBadge, WcStageStepper } from '@/components/wc/wc-ui';
import { usePermission } from '@/hooks/use-permission';
import { wcCaseQuery } from '@/lib/wc/api';
import {
  WC_STAGES,
  WC_TYPE_LABELS,
  formatDate,
  formatIndianNumber,
  type WcCase,
  type WcStage,
} from '@/shared';

// A workmen compensation case, laid out as the Property (Fire and Burglary) proposal: the title
// with its type and stage, the progress, the facts beside it, and a tab for each step's work.

const TABS = [
  { value: 'data-sheet', label: 'Data Sheet', completes: 'RFQ' },
  { value: 'rfq', label: 'Insurers and RFQ', completes: 'QUOTES' },
  { value: 'quotes', label: 'Quotes', completes: 'QCR' },
  { value: 'qcr', label: 'QCR', completes: 'PLACEMENT_SLIP' },
  { value: 'placement', label: 'Placement slip', completes: 'PLACED' },
] as const satisfies readonly { value: string; label: string; completes: WcStage }[];
type Tab = (typeof TABS)[number]['value'];

/** Where each stage's work is done. */
const STAGE_TAB: Record<WcStage, Tab> = {
  DATA_SHEET: 'data-sheet',
  RFQ: 'rfq',
  QUOTES: 'quotes',
  QCR: 'qcr',
  PLACEMENT_SLIP: 'placement',
  PLACED: 'placement',
};

/** The tab where the case's work goes on next. */
function nextTab(record: WcCase): Tab {
  if (record.stage === 'RFQ' && record.locked) return 'quotes';
  return STAGE_TAB[record.stage];
}

export function WcCaseView({ id }: { id: string }) {
  const record = useQuery(wcCaseQuery(id));
  return (
    <DemoModeGate>
      {record.isPending ? (
        <LoadingState label="Loading the case" />
      ) : record.isError ? (
        <ErrorState error={record.error} onRetry={() => void record.refetch()} />
      ) : (
        <Workspace record={record.data} />
      )}
    </DemoModeGate>
  );
}

function Workspace({ record }: { record: WcCase }) {
  const canEdit = usePermission('wc.edit');
  const [tab, setTab] = useState<string>(() => nextTab(record));
  const reached = WC_STAGES.indexOf(record.stage);
  const done = (completes: WcStage) =>
    record.stage === 'PLACED' || reached >= WC_STAGES.indexOf(completes);
  const next = nextTab(record);
  const sent = record.rfqInsurers.filter((item) => item.sentOn !== null).length;
  // A save elsewhere reloads the tabs with what was saved.
  const key = record.updatedAt;

  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {record.client.name}
          </h1>
          <Badge variant={record.type === 'NEW' ? 'default' : 'accent'}>
            {WC_TYPE_LABELS[record.type]}
          </Badge>
          <WcStageBadge stage={record.stage} />
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {record.reference} · {record.client.gstin ?? 'No GSTIN'} · Assigned to {record.owner.name}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Policy: </span>
          <span className="font-medium">Workmen Compensation</span>
          {record.placement ? (
            <span className="text-muted-foreground">
              {' '}
              — {record.placement.insurerName}, {record.placement.optionLabel}
            </span>
          ) : null}
        </p>
      </div>

      {record.stage === 'PLACED' && record.placement ? (
        <Alert variant="success" className="mb-6">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>Placed: policy {record.placement.policyNumber}</AlertTitle>
          <AlertDescription>
            {record.placement.insurerName}, {record.placement.optionLabel}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-4 *:min-w-0 lg:grid-cols-[1fr_auto]">
        <WcStageStepper
          stage={record.stage}
          onSelect={(stage) => setTab(STAGE_TAB[stage])}
          selected={WC_STAGES.findLast((stage) => STAGE_TAB[stage] === tab)}
        />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
          <Fact label="Policy period">
            {record.placement?.policyStart && record.placement.policyEnd
              ? `${formatDate(record.placement.policyStart)} – ${formatDate(record.placement.policyEnd)}`
              : record.policyPeriod}
          </Fact>
          <Fact label="Persons">{record.totals.persons}</Fact>
          <Fact label="Wages per month">₹{formatIndianNumber(record.totals.monthlyWages, 0)}</Fact>
          <Fact label="Categories">{record.categories.length}</Fact>
          <Fact label="RFQ sent to">
            {sent} of {record.rfqInsurers.length} insurers
          </Fact>
        </dl>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="flex-wrap">
          {TABS.map((item) => {
            const isDone = done(item.completes);
            const isNext = !isDone && item.value === next;
            return (
              <TabsTrigger key={item.value} value={item.value}>
                {isDone ? (
                  <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
                ) : isNext ? (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                ) : null}
                {item.label}
                {isDone ? <span className="sr-only">, done</span> : null}
                {isNext ? <span className="sr-only">, next step</span> : null}
                {item.value === 'data-sheet' && !record.locked && record.missing.length > 0 ? (
                  <Badge variant="warning" className="ml-1 tabular">
                    {record.missing.length}
                    <span className="sr-only"> items needed</span>
                  </Badge>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {/* Mounted while hidden, so unsaved Data Sheet entries survive a look at another tab. */}
        <TabsContent
          value="data-sheet"
          forceMount
          className="grid min-w-0 gap-6 *:min-w-0 data-[state=inactive]:hidden"
        >
          {record.locked ? (
            <Alert variant="info">
              <Lock aria-hidden="true" />
              <AlertTitle>The Data Sheet is locked</AlertTitle>
              <AlertDescription>
                The RFQ has been sent to insurers, so the figures they quoted on stay as they are.
              </AlertDescription>
            </Alert>
          ) : record.missing.length > 0 ? (
            <Alert>
              <AlertTitle>Needed before the RFQ</AlertTitle>
              <AlertDescription>{record.missing.join('; ')}.</AlertDescription>
            </Alert>
          ) : null}
          <WcDocumentButtons record={record} kind="data-sheet" />
          <DataSheetEditor
            key={`sheet-${key}`}
            record={record}
            canEdit={canEdit && !record.locked}
          />
        </TabsContent>
        <TabsContent value="rfq" className="min-w-0">
          <WcRfqPanel key={`rfq-${key}`} record={record} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="quotes" className="min-w-0">
          <QuotesEditor key={`quotes-${key}`} record={record} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="qcr" className="min-w-0">
          <WcQcrPanel key={`qcr-${key}`} record={record} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="placement" className="min-w-0">
          <WcPlacementPanel key={`placement-${key}`} record={record} canEdit={canEdit} />
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
