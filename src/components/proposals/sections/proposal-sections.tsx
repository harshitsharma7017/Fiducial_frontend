import { Separator } from '@/components/ui/separator';
import type { Proposal } from '@/types/proposal';
import {
  ActivitySection,
  AddonsSection,
  ClausesExcessSection,
  CoverageTable,
  DocumentsSection,
  InsurerQuotesSection,
  StageStepper,
  SummarySection,
} from './index';

/** Every section stacked in the brief's order, used by the drawer. */
export function ProposalSections({ proposal }: { proposal: Proposal }) {
  return (
    <div className="grid gap-6">
      <SummarySection proposal={proposal} />
      <Separator />
      <StageStepper stage={proposal.stage} />
      <Separator />
      <CoverageTable proposal={proposal} />
      <Separator />
      <AddonsSection proposal={proposal} />
      <Separator />
      <ClausesExcessSection proposal={proposal} />
      <Separator />
      <InsurerQuotesSection proposal={proposal} />
      <Separator />
      <DocumentsSection proposal={proposal} />
      <Separator />
      <ActivitySection proposal={proposal} />
    </div>
  );
}
