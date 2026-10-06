import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { buildSampleProposals } from '@/lib/data/proposals';
import { todayIst } from '@/lib/dates';
import {
  compareSummaries,
  toSummary,
  type DashboardStats,
  type ProposalSummary,
  type SortBy,
} from '@/lib/proposal-metrics';
import { queryKeys } from '@/lib/query-keys';
import type { Proposal, ProposalType, Stage } from '@/types/proposal';
import { computeDashboardStats } from './dashboard-stats';
import { delay } from './latency';

export interface ListParams {
  type?: ProposalType;
  stage?: Stage;
  q?: string;
  sort?: { by: SortBy; dir: 'asc' | 'desc' };
  page?: number;
  pageSize?: number;
}

export interface ProposalListResult {
  items: ProposalSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/** The sample proposals, rebuilt once per IST day (dates are relative to today). */
let cache: { day: string; proposals: Proposal[] } | null = null;
function sampleProposals(): Proposal[] {
  const day = todayIst();
  if (!cache || cache.day !== day) cache = { day, proposals: buildSampleProposals() };
  return cache.proposals;
}

/**
 * A page of proposal summaries matching the filters. Without `type` it covers both types (the
 * command palette uses this). Replace the body with `apiFetch('proposals', …)` when the API exists.
 */
export async function listProposals(params: ListParams = {}): Promise<ProposalListResult> {
  await delay(450);
  const today = todayIst();
  const needle = params.q?.trim().toLowerCase() ?? '';
  const summaries = sampleProposals()
    .filter((proposal) => !params.type || proposal.type === params.type)
    .filter((proposal) => !params.stage || proposal.stage === params.stage)
    .map((proposal) => toSummary(proposal, today))
    .filter(
      (summary) =>
        needle === '' ||
        summary.reference.toLowerCase().includes(needle) ||
        summary.client.name.toLowerCase().includes(needle),
    );

  const sort = params.sort ?? { by: 'date', dir: 'asc' };
  summaries.sort((a, b) => {
    const result = compareSummaries(a, b, sort.by);
    return sort.dir === 'desc' ? -result : result;
  });

  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 5;
  const start = (page - 1) * pageSize;
  return {
    items: summaries.slice(start, start + pageSize),
    total: summaries.length,
    page,
    pageSize,
  };
}

/** One proposal by id, or an ApiError(404) for an unknown id. */
export async function getProposal(id: string): Promise<Proposal> {
  await delay(300);
  const proposal = sampleProposals().find((candidate) => candidate.id === id);
  if (!proposal) throw new ApiError(404, 'NOT_FOUND', 'Proposal not found');
  return proposal;
}

/** Counts, KPI inputs, stage counts and Fire SI by product for one type. */
export async function getDashboardStats(type: ProposalType): Promise<DashboardStats> {
  await delay(450);
  return computeDashboardStats(
    sampleProposals().filter((proposal) => proposal.type === type),
    type,
    todayIst(),
  );
}

export function useProposals(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.proposals.list(params),
    queryFn: () => listProposals(params),
    placeholderData: keepPreviousData,
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: queryKeys.proposals.detail(id),
    queryFn: () => getProposal(id),
    enabled: id !== '',
  });
}

export function useDashboardStats(type: ProposalType) {
  return useQuery({
    queryKey: queryKeys.proposals.stats(type),
    queryFn: () => getDashboardStats(type),
  });
}
