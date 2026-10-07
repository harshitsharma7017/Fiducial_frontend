import { daysBetween, isSameIstMonth } from '@/lib/dates';
import { sumRupees } from '@/lib/money';
import { fireSumInsured, type DashboardStats } from '@/lib/proposal-metrics';
import {
  PRODUCTS,
  STAGES,
  type Product,
  type Proposal,
  type ProposalType,
  type Stage,
} from '@/types/proposal';

/**
 * The dashboard figures for one proposal type, computed from the proposals so the KPI cards,
 * pipeline strip and chart always agree. Definitions follow design.md (KPI definitions, Q3):
 * "open" is any stage except Placed; "due" windows use IST calendar days; placed renewals never
 * count as due. The headline amount everywhere is the Fire SI (Proposed 1) (Q4).
 */
export function computeDashboardStats(
  proposals: Proposal[],
  type: ProposalType,
  today: string,
): DashboardStats {
  const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<
    Stage,
    number
  >;
  const productSums = Object.fromEntries(PRODUCTS.map((product) => [product, [] as string[]]));
  const openFire: string[] = [];
  const pendingFire: string[] = [];
  const placedFire: string[] = [];
  const dueIn30Fire: string[] = [];
  const dueIn60Fire: string[] = [];

  let awaitingQuotes = 0;
  let awaitingQuotesInsurers = 0;
  let pendingApproval = 0;
  let placedThisMonth = 0;
  let dueIn30 = 0;
  let dueIn60 = 0;
  let nearestDue: { client: string; days: number } | null = null;

  for (const proposal of proposals) {
    const fire = fireSumInsured(proposal);
    stageCounts[proposal.stage] += 1;
    if (proposal.product) productSums[proposal.product]?.push(fire);
    const open = proposal.stage !== 'PLACED';
    if (open) openFire.push(fire);

    if (proposal.stage === 'RFQ_SENT') {
      awaitingQuotes += 1;
      awaitingQuotesInsurers += proposal.insurers.filter((i) => i.status === 'SENT').length;
    }
    if (proposal.stage === 'QCR') {
      pendingApproval += 1;
      pendingFire.push(fire);
    }
    if (
      proposal.stage === 'PLACED' &&
      proposal.placedOn &&
      isSameIstMonth(proposal.placedOn, today)
    ) {
      placedThisMonth += 1;
      placedFire.push(fire);
    }

    if (type === 'EXISTING' && proposal.type === 'EXISTING' && open) {
      const days = daysBetween(today, proposal.existingPolicy.expiresOn);
      if (days <= 30) {
        dueIn30 += 1;
        dueIn30Fire.push(fire);
        if (!nearestDue || days < nearestDue.days) {
          nearestDue = { client: proposal.client.name, days };
        }
      } else if (days <= 60) {
        dueIn60 += 1;
        dueIn60Fire.push(fire);
      }
    }
  }

  const sumInsuredByProduct = Object.fromEntries(
    PRODUCTS.map((product) => [product, sumRupees(productSums[product] ?? [])]),
  ) as Record<Product, string>;

  return {
    type,
    total: proposals.length,
    stageCounts,
    sumInsuredByProduct,
    openCount: openFire.length,
    awaitingQuotes,
    awaitingQuotesInsurers,
    pendingApproval,
    placedThisMonth,
    placedThisMonthSum: sumRupees(placedFire),
    openSum: sumRupees(openFire),
    pendingApprovalSum: sumRupees(pendingFire),
    dueIn30,
    dueIn60,
    dueIn30Sum: sumRupees(dueIn30Fire),
    dueIn60Sum: sumRupees(dueIn60Fire),
    nearestDue,
  };
}
