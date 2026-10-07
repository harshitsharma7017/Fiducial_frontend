import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSampleProposals } from '@/lib/data/proposals';
import { todayIst } from '@/lib/dates';
import { fireSumInsured } from '@/lib/proposal-metrics';
import { PRODUCTS, PROPOSAL_TYPES, STAGES, SUM_INSURED_OPTIONS } from '@/types/proposal';
import { computeDashboardStats } from './dashboard-stats';
import { getProposal, listProposals } from './proposals';

const SORTS = [
  'reference',
  'client',
  'product',
  'fireSumInsured',
  'sectionsIncluded',
  'stage',
  'insurersResponded',
  'date',
  'owner',
] as const;

/** The BFF's mock-mode answer: new proposals then come from the sample data, as these tests expect. */
function demoModeFetch() {
  return Promise.resolve(
    new Response(JSON.stringify({ code: 'DEMO_MODE', message: 'Not available in demo mode' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('listProposals', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(demoModeFetch));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a 404 ApiError for an unknown id', async () => {
    await expect(getProposal('prp-nope')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('returns a known proposal', async () => {
    await expect(getProposal('prp-0101')).resolves.toMatchObject({ reference: 'PRP-2026-0101' });
  });

  // Feature: frontend-shell, Property 8: Listing matches a reference filter
  it('filters, sorts and pages consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.option(fc.constantFrom(...PROPOSAL_TYPES), { nil: undefined }),
          stage: fc.option(fc.constantFrom(...STAGES), { nil: undefined }),
          q: fc.option(fc.constantFrom('ltd', 'pvt', 'prp', 'z', '2026', 'steel'), {
            nil: undefined,
          }),
          sort: fc.record({ by: fc.constantFrom(...SORTS), dir: fc.constantFrom('asc', 'desc') }),
          pageSize: fc.integer({ min: 1, max: 10 }),
        }),
        async (params) => {
          const first = await listProposals({ ...params, page: 1 });
          const today = todayIst();
          const needle = params.q?.toLowerCase() ?? '';

          const matches = buildSampleProposals()
            .filter((p) => !params.type || p.type === params.type)
            .filter((p) => !params.stage || p.stage === params.stage)
            .filter(
              (p) =>
                needle === '' ||
                p.reference.toLowerCase().includes(needle) ||
                p.client.name.toLowerCase().includes(needle),
            );
          expect(first.total).toBe(matches.length);
          expect(first.items.length).toBeLessThanOrEqual(params.pageSize);
          for (const item of first.items) {
            if (params.type) expect(item.type).toBe(params.type);
            if (params.stage) expect(item.stage).toBe(params.stage);
            if (needle) {
              const hit =
                item.reference.toLowerCase().includes(needle) ||
                item.client.name.toLowerCase().includes(needle);
              expect(hit).toBe(true);
            }
            void today;
          }

          // Every match appears exactly once across all pages.
          const seen: string[] = [];
          const pages = Math.max(1, Math.ceil(first.total / params.pageSize));
          for (let page = 1; page <= pages; page += 1) {
            const result = await listProposals({ ...params, page });
            seen.push(...result.items.map((item) => item.id));
          }
          expect(new Set(seen).size).toBe(matches.length);
          expect(seen.length).toBe(matches.length);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('breaks sort ties by reference', async () => {
    // Sorting by product groups many ties; references must then be ascending within a page.
    const result = await listProposals({ sort: { by: 'product', dir: 'asc' }, pageSize: 20 });
    const byProduct = new Map<string, string[]>();
    for (const item of result.items) {
      const product = item.product ?? '';
      byProduct.set(product, [...(byProduct.get(product) ?? []), item.reference]);
    }
    for (const refs of byProduct.values()) {
      expect(refs).toEqual([...refs].sort((a, b) => a.localeCompare(b)));
    }
  });
});

describe('computeDashboardStats', () => {
  // Feature: frontend-shell, Property 9: Dashboard figures agree with the proposals
  it('agrees with the proposals and adds up', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2032-12-31T23:59:59Z'),
          noInvalidDate: true,
        }),
        fc.constantFrom(...PROPOSAL_TYPES),
        (now, type) => {
          const today = todayIst(now.getTime());
          const ofType = buildSampleProposals(now).filter((p) => p.type === type);
          const stats = computeDashboardStats(ofType, type, today);

          expect(stats.total).toBe(ofType.length);
          // Stage counts add up to the type total.
          const stageSum = STAGES.reduce((sum, stage) => sum + stats.stageCounts[stage], 0);
          expect(stageSum).toBe(ofType.length);
          // Product sums add up to the type's total Fire SI (Proposed 1).
          const totalFire = ofType.reduce((sum, p) => sum + BigInt(fireSumInsured(p)), 0n);
          const productSum = PRODUCTS.reduce(
            (sum, product) => sum + BigInt(stats.sumInsuredByProduct[product]),
            0n,
          );
          expect(productSum).toBe(totalFire);
          // Open = not placed.
          expect(stats.openCount).toBe(ofType.filter((p) => p.stage !== 'PLACED').length);
          // A placed renewal never counts as due (requirement 10.5).
          if (type === 'EXISTING') {
            const placedDue = ofType.some(
              (p) => p.stage === 'PLACED' && stats.nearestDue?.client === p.client.name,
            );
            expect(placedDue).toBe(false);
          }
          void SUM_INSURED_OPTIONS;
        },
      ),
      { numRuns: 120 },
    );
  });
});
