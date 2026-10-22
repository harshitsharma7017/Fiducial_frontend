import { daysBetween } from '@/lib/dates';
import { sumRupees } from '@/lib/money';
import { INSURER_STATUSES, isSectionShown, type InsurerStatus } from '@/shared';
import {
  STAGES,
  type Product,
  type Proposal,
  type ProposalType,
  type Rupees,
  type Stage,
  type SumInsuredOption,
} from '@/types/proposal';

/** The sum-insured key for an option on a section. */
const OPTION_KEY = {
  EXISTING: 'existing',
  PROPOSED_1: 'proposed1',
  PROPOSED_2: 'proposed2',
} as const;

/** The option columns a proposal shows: a new proposal has no Existing column. */
export function coverageColumns(proposal: Proposal): SumInsuredOption[] {
  return proposal.type === 'EXISTING'
    ? ['EXISTING', 'PROPOSED_1', 'PROPOSED_2']
    : ['PROPOSED_1', 'PROPOSED_2'];
}

/** A section's amount for an option, or null when the option does not apply (new + Existing). */
export function sectionAmount(
  proposal: Proposal,
  option: SumInsuredOption,
  code: string,
): Rupees | null {
  const line = proposal.sections.find((section) => section.code === code);
  if (!line) return null;
  const sums = line.sumInsured as Record<string, string>;
  const key = OPTION_KEY[option];
  return key in sums ? (sums[key] ?? null) : null;
}

/** The total of the included sections for one option. */
export function coverageTotal(proposal: Proposal, option: SumInsuredOption): Rupees {
  const amounts = proposal.sections
    .filter(isSectionShown)
    .map((section) => sectionAmount(proposal, option, section.code))
    .filter((amount): amount is Rupees => amount !== null);
  return sumRupees(amounts);
}

/** Totals per column, keyed by option. */
export function coverageTotals(proposal: Proposal): Partial<Record<SumInsuredOption, Rupees>> {
  const totals: Partial<Record<SumInsuredOption, Rupees>> = {};
  for (const option of coverageColumns(proposal)) totals[option] = coverageTotal(proposal, option);
  return totals;
}

/** The headline figure: the Fire section's Proposed 1 sum insured (design Q4). */
export function fireSumInsured(proposal: Proposal): Rupees {
  return sectionAmount(proposal, 'PROPOSED_1', 'FIRE') ?? '0';
}

export type ExpiryUrgency = 'neutral' | 'warning' | 'danger';

/**
 * Expiry chip urgency for a renewal (Q3): danger from 0 to 30 days to expiry and when expired,
 * warning from 31 to 60, neutral above 60. A placed renewal is always neutral.
 */
export function expiryUrgency(daysToExpiry: number, placed: boolean): ExpiryUrgency {
  if (placed) return 'neutral';
  if (daysToExpiry <= 30) return 'danger';
  if (daysToExpiry <= 60) return 'warning';
  return 'neutral';
}

/** Human text for a days-to-expiry value: "Today", "1 day", "45 days", "Expired 3 days ago". */
export function expiryLabel(daysToExpiry: number): string {
  if (daysToExpiry === 0) return 'Today';
  if (daysToExpiry < 0) {
    const overdue = -daysToExpiry;
    return `Expired ${overdue} ${overdue === 1 ? 'day' : 'days'} ago`;
  }
  return `${daysToExpiry} ${daysToExpiry === 1 ? 'day' : 'days'}`;
}

/** One row of the proposals table. */
export interface ProposalSummary {
  id: string;
  reference: string;
  client: { name: string; city: string };
  type: ProposalType;
  product: Proposal['product'];
  stage: Stage;
  fireSumInsured: Rupees;
  sectionsIncluded: number;
  insurersResponded: number;
  insurersListed: number;
  /** The insurers per status, in the shared order, for the Insurers column's tooltip. */
  insurerStatusCounts: { status: InsurerStatus; count: number }[];
  owner: string;
  /** Due date (new) or expiry date (renewal), the table's default sort. */
  date: string;
  /** Days to expiry for a renewal; null for a new proposal. */
  daysToExpiry: number | null;
  placed: boolean;
}

/** "Responded" means the insurer quoted or declined. */
function respondedCount(proposal: Proposal): number {
  return proposal.insurers.filter(
    (insurer) => insurer.status === 'QUOTED' || insurer.status === 'DECLINED',
  ).length;
}

function statusCounts(proposal: Proposal): ProposalSummary['insurerStatusCounts'] {
  return INSURER_STATUSES.flatMap((status) => {
    const count = proposal.insurers.filter((insurer) => insurer.status === status).length;
    return count > 0 ? [{ status, count }] : [];
  });
}

export function toSummary(proposal: Proposal, today: string): ProposalSummary {
  const placed = proposal.stage === 'PLACED';
  const date = proposal.type === 'EXISTING' ? proposal.existingPolicy.expiresOn : proposal.dueDate;
  return {
    id: proposal.id,
    reference: proposal.reference,
    client: proposal.client,
    type: proposal.type,
    product: proposal.product,
    stage: proposal.stage,
    fireSumInsured: fireSumInsured(proposal),
    sectionsIncluded: proposal.sections.filter(isSectionShown).length,
    insurersResponded: respondedCount(proposal),
    insurersListed: proposal.insurers.length,
    insurerStatusCounts: statusCounts(proposal),
    owner: proposal.owner,
    date,
    daysToExpiry:
      proposal.type === 'EXISTING' ? daysBetween(today, proposal.existingPolicy.expiresOn) : null,
    placed,
  };
}

const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage, index]));

export type SortBy =
  | 'reference'
  | 'client'
  | 'product'
  | 'fireSumInsured'
  | 'sectionsIncluded'
  | 'stage'
  | 'insurersResponded'
  | 'date'
  | 'owner';

/** Comparator for one column; ties are broken by reference so the order is stable. */
export function compareSummaries(a: ProposalSummary, b: ProposalSummary, by: SortBy): number {
  const result = rawCompare(a, b, by);
  return result !== 0 ? result : a.reference.localeCompare(b.reference);
}

function rawCompare(a: ProposalSummary, b: ProposalSummary, by: SortBy): number {
  switch (by) {
    case 'client':
      return a.client.name.localeCompare(b.client.name);
    case 'product':
      return (a.product ?? '').localeCompare(b.product ?? '');
    case 'fireSumInsured': {
      const diff = BigInt(a.fireSumInsured) - BigInt(b.fireSumInsured);
      return diff < 0n ? -1 : diff > 0n ? 1 : 0;
    }
    case 'sectionsIncluded':
      return a.sectionsIncluded - b.sectionsIncluded;
    case 'stage':
      return (STAGE_INDEX.get(a.stage) ?? 0) - (STAGE_INDEX.get(b.stage) ?? 0);
    case 'insurersResponded':
      return a.insurersResponded - b.insurersResponded;
    case 'date':
      return a.date.localeCompare(b.date);
    case 'owner':
      return a.owner.localeCompare(b.owner);
    case 'reference':
      return a.reference.localeCompare(b.reference);
  }
}

/** KPI inputs for one proposal type. Placed renewals never count as due (Q3, requirement 10.5). */
export interface DashboardStats {
  type: ProposalType;
  total: number;
  stageCounts: Record<Stage, number>;
  sumInsuredByProduct: Record<Product, Rupees>;
  openCount: number;
  awaitingQuotes: number;
  /** Insurers Sent or Reminded on open cases; awaitingQuotes is the cases they are on. */
  awaitingQuotesInsurers: number;
  /** Insurers on open cases still waiting after their quote due date, and their cases. */
  overdueInsurers: number;
  overdueCases: number;
  pendingApproval: number;
  placedThisMonth: number;
  placedThisMonthSum: Rupees;
  openSum: Rupees;
  pendingApprovalSum: Rupees;
  dueIn30: number;
  dueIn60: number;
  dueIn30Sum: Rupees;
  dueIn60Sum: Rupees;
  nearestDue: { client: string; days: number } | null;
}
