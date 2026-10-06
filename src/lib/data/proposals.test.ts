import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { daysBetween, todayIst } from '@/lib/dates';
import {
  PROPOSAL_TYPES,
  PRODUCTS,
  ProposalSchema,
  STAGES,
  SUM_INSURED_OPTIONS,
  type Proposal,
  type SumInsuredOption,
} from '@/types/proposal';
import { PRODUCT_BANDS, SAMPLE_PROPOSAL_COUNT, buildSampleProposals } from './proposals';

const KEY: Record<SumInsuredOption, 'existing' | 'proposed1' | 'proposed2'> = {
  EXISTING: 'existing',
  PROPOSED_1: 'proposed1',
  PROPOSED_2: 'proposed2',
};

function optionValue(proposal: Proposal, option: SumInsuredOption, code: string): number | null {
  const line = proposal.sections.find((section) => section.code === code);
  if (!line) return null;
  const sums = line.sumInsured as Record<string, string>;
  const key = KEY[option];
  return key in sums ? Number(sums[key]) : null;
}

/** Every rule in Requirement 18, checked for one build. */
function checkRules(proposals: Proposal[], now: Date) {
  const today = todayIst(now.getTime());

  expect(proposals).toHaveLength(SAMPLE_PROPOSAL_COUNT);
  for (const proposal of proposals) {
    expect(ProposalSchema.safeParse(proposal).success).toBe(true);
  }

  for (const type of PROPOSAL_TYPES) {
    const ofType = proposals.filter((p) => p.type === type);
    expect(ofType).toHaveLength(7);
    expect(new Set(ofType.map((p) => p.stage))).toEqual(new Set(STAGES));
    expect(new Set(ofType.map((p) => p.product))).toEqual(new Set(PRODUCTS));
    // At least one of each type placed this IST month.
    expect(
      ofType.some((p) => p.placedOn !== null && p.placedOn.slice(0, 7) === today.slice(0, 7)),
    ).toBe(true);
  }

  for (const proposal of proposals) {
    const included = proposal.sections.filter((section) => section.included);
    expect(included.length).toBeGreaterThanOrEqual(4);
    expect(included.length).toBeLessThanOrEqual(14);
    expect(proposal.insurers.length).toBeLessThanOrEqual(5);

    const band = PRODUCT_BANDS[proposal.product];
    for (const option of SUM_INSURED_OPTIONS) {
      if (proposal.type === 'NEW' && option === 'EXISTING') {
        expect(optionValue(proposal, option, 'FIRE')).toBeNull();
        continue;
      }
      const fire = optionValue(proposal, option, 'FIRE') ?? 0;
      const total = included.reduce(
        (sum, s) => sum + (optionValue(proposal, option, s.code) ?? 0),
        0,
      );
      for (const amount of [fire, total]) {
        expect(amount).toBeGreaterThanOrEqual(band.min);
        expect(amount).toBeLessThanOrEqual(band.max);
      }
    }

    // No timestamp is in the future.
    const future = (iso: string | null) => iso !== null && new Date(iso).getTime() > now.getTime();
    expect(proposal.activity.some((event) => future(event.at))).toBe(false);
    expect(proposal.documents.some((doc) => future(doc.updatedAt))).toBe(false);
    expect(proposal.insurers.some((insurer) => future(insurer.updatedAt))).toBe(false);
    if (proposal.placedOn) expect(proposal.placedOn <= today).toBe(true);
  }

  // Fire SI (Proposed 1) spans roughly ₹40 lakh to ₹120 Cr (requirement 18.5).
  const fireProposed1 = proposals.map((p) => optionValue(p, 'PROPOSED_1', 'FIRE') ?? 0);
  expect(Math.min(...fireProposed1)).toBeLessThanOrEqual(40_00_000);
  expect(Math.max(...fireProposed1)).toBeGreaterThanOrEqual(100_00_00_000);

  // Unplaced renewals fall in each due window.
  const windows = { d30: 0, d60: 0, d90: 0 };
  for (const proposal of proposals) {
    if (proposal.type !== 'EXISTING' || proposal.stage === 'PLACED') continue;
    const days = daysBetween(today, proposal.existingPolicy.expiresOn);
    if (days >= 0 && days <= 30) windows.d30 += 1;
    else if (days <= 60) windows.d60 += 1;
    else if (days <= 90) windows.d90 += 1;
  }
  expect(windows.d30).toBeGreaterThan(0);
  expect(windows.d60).toBeGreaterThan(0);
  expect(windows.d90).toBeGreaterThan(0);
}

describe('sample proposals', () => {
  it.each([
    ['mid-month', '2026-10-05T12:00:00.000+05:30'],
    ['first day of month', '2026-02-01T00:05:00.000+05:30'],
    ['last day of month', '2026-01-31T23:55:00.000+05:30'],
    ['leap day', '2028-02-29T10:00:00.000+05:30'],
  ])('holds every rule on %s', (_label, iso) => {
    const now = new Date(iso);
    checkRules(buildSampleProposals(now), now);
  });

  // Feature: frontend-shell, Property 5: Sample data rules hold at any moment
  it('holds every rule at any instant from 2024 to 2032', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2032-12-31T23:59:59Z'),
          noInvalidDate: true,
        }),
        (now) => {
          checkRules(buildSampleProposals(now), now);
        },
      ),
      { numRuns: 150 },
    );
  });
});
