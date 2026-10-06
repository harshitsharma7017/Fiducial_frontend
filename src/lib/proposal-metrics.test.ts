import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildSampleProposals } from '@/lib/data/proposals';
import { sumRupees } from '@/lib/money';
import {
  coverageColumns,
  coverageTotal,
  expiryLabel,
  expiryUrgency,
  sectionAmount,
} from './proposal-metrics';
import { NewProposalSchema, type Proposal } from '@/types/proposal';

const PROPOSALS = buildSampleProposals(new Date('2026-10-05T12:00:00+05:30'));
const newProposal = PROPOSALS.find(
  (p): p is Extract<Proposal, { type: 'NEW' }> => p.type === 'NEW',
)!;
const renewal = PROPOSALS.find((p) => p.type === 'EXISTING')!;

describe('coverageColumns', () => {
  // Feature: frontend-shell, Property 6: Option columns follow the proposal type
  it('omits Existing for a new proposal and includes it for a renewal', () => {
    for (const proposal of PROPOSALS) {
      expect(coverageColumns(proposal)).toEqual(
        proposal.type === 'EXISTING'
          ? ['EXISTING', 'PROPOSED_1', 'PROPOSED_2']
          : ['PROPOSED_1', 'PROPOSED_2'],
      );
      // The Existing amount is absent on a new proposal, present on a renewal.
      const existing = sectionAmount(proposal, 'EXISTING', 'FIRE');
      if (proposal.type === 'EXISTING') expect(typeof existing).toBe('string');
      else expect(existing).toBeNull();
    }
  });

  // Feature: frontend-shell, Property 6: Option columns follow the proposal type
  it('rejects an Existing amount added to a new proposal', () => {
    const section = newProposal.sections[0]!;
    const tampered = {
      ...newProposal,
      sections: [
        { ...section, sumInsured: { ...section.sumInsured, existing: '1000' } },
        ...newProposal.sections.slice(1),
      ],
    };
    expect(NewProposalSchema.safeParse(tampered).success).toBe(false);
  });
});

describe('coverageTotal', () => {
  // Feature: frontend-shell, Property 7: Coverage totals add up the included sections
  it('equals the sum of the included sections for each option', () => {
    for (const proposal of PROPOSALS) {
      for (const option of coverageColumns(proposal)) {
        const expected = sumRupees(
          proposal.sections
            .filter((section) => section.included)
            .map((section) => sectionAmount(proposal, option, section.code) ?? '0'),
        );
        expect(coverageTotal(proposal, option)).toBe(expected);
      }
    }
  });

  it('ignores excluded sections', () => {
    const total = coverageTotal(renewal, 'PROPOSED_1');
    const includedOnly = sumRupees(
      renewal.sections
        .filter((section) => section.included)
        .map((section) => sectionAmount(renewal, 'PROPOSED_1', section.code) ?? '0'),
    );
    expect(total).toBe(includedOnly);
  });
});

describe('expiryUrgency and expiryLabel', () => {
  // Feature: frontend-shell, Property 10: Expiry urgency follows the thresholds
  it('maps days to urgency, with placed renewals always neutral', () => {
    fc.assert(
      fc.property(fc.integer({ min: -400, max: 400 }), fc.boolean(), (days, placed) => {
        const urgency = expiryUrgency(days, placed);
        if (placed) expect(urgency).toBe('neutral');
        else if (days <= 30) expect(urgency).toBe('danger');
        else if (days <= 60) expect(urgency).toBe('warning');
        else expect(urgency).toBe('neutral');
      }),
    );
  });

  it('labels days in words', () => {
    expect(expiryLabel(0)).toBe('Today');
    expect(expiryLabel(1)).toBe('1 day');
    expect(expiryLabel(45)).toBe('45 days');
    expect(expiryLabel(-1)).toBe('Expired 1 day ago');
    expect(expiryLabel(-3)).toBe('Expired 3 days ago');
  });
});
