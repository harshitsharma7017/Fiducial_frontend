'use client';

import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StageBadge, TypeBadge } from '@/components/proposals/badges';
import {
  ActivitySection,
  AddonsSection,
  ClausesExcessSection,
  CoverageTable,
  DocumentsSection,
  InsurerQuotesSection,
  StageStepper,
  SummarySection,
} from '@/components/proposals/sections';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api-client';
import { isRecordId } from '@/lib/api/new-business';
import { useProposal } from '@/lib/api/proposals';
import { ProposalWorkspace } from '@/components/proposals/new-business/proposal-workspace';
import type { Proposal } from '@/types/proposal';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'coverage', label: 'Coverage' },
  { value: 'addons', label: 'Add-ons' },
  { value: 'clauses', label: 'Clauses and Excess' },
  { value: 'insurers', label: 'Insurers and Quotes' },
  { value: 'documents', label: 'Documents' },
  { value: 'activity', label: 'Activity' },
] as const;

/**
 * The full proposal page. A new-business proposal from the API opens its workspace (Data Sheet,
 * insurers and RFQ); a sample proposal keeps the read-only tabs below.
 */
export function ProposalDetailView({ id, tab }: { id: string; tab?: string }) {
  return isRecordId(id) ? (
    <ProposalWorkspace id={id} initialTab={tab} />
  ) : (
    <SampleProposalDetail id={id} />
  );
}

/** Header plus WAI-ARIA tabs reusing the drawer's section components. */
function SampleProposalDetail({ id }: { id: string }) {
  const proposal = useProposal(id);

  if (proposal.isPending) {
    return <LoadingState label="Loading proposal" className="max-w-xl" />;
  }

  if (proposal.isError) {
    if (proposal.error instanceof ApiError && proposal.error.status === 404) {
      return <NotFound />;
    }
    return <ErrorState error={proposal.error} onRetry={() => void proposal.refetch()} />;
  }

  return <Loaded proposal={proposal.data} />;
}

function Loaded({ proposal }: { proposal: Proposal }) {
  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {proposal.client.name}
          </h1>
          <TypeBadge type={proposal.type} />
          <StageBadge stage={proposal.stage} />
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {proposal.reference} · {proposal.client.city}
        </p>
      </div>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList className="flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6">
          <SummarySection proposal={proposal} />
          <StageStepper stage={proposal.stage} />
        </TabsContent>
        <TabsContent value="coverage">
          <CoverageTable proposal={proposal} />
        </TabsContent>
        <TabsContent value="addons">
          <AddonsSection proposal={proposal} />
        </TabsContent>
        <TabsContent value="clauses">
          <ClausesExcessSection proposal={proposal} />
        </TabsContent>
        <TabsContent value="insurers">
          <InsurerQuotesSection proposal={proposal} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsSection proposal={proposal} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivitySection proposal={proposal} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function NotFound() {
  return (
    <EmptyState
      title="Proposal not found"
      description={
        <>
          This proposal does not exist or has been removed. Go back to the{' '}
          <Link href="/proposals?type=new" className="text-accent-strong hover:underline">
            new proposals
          </Link>{' '}
          or{' '}
          <Link href="/proposals?type=existing" className="text-accent-strong hover:underline">
            existing proposals
          </Link>{' '}
          list.
        </>
      }
      className="mx-auto max-w-md"
    />
  );
}
