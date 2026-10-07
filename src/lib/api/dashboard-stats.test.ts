import { describe, expect, it } from 'vitest';
import { buildSampleProposals } from '@/lib/data/proposals';
import type { InsurerStatus } from '@/shared';
import type { Proposal, Stage } from '@/types/proposal';
import { computeDashboardStats } from './dashboard-stats';

const TODAY = '2026-10-15';
const base = buildSampleProposals(new Date(`${TODAY}T06:00:00Z`)).find((p) => p.type === 'NEW');
if (!base) throw new Error('No sample new proposal');

function proposal(
  stage: Stage,
  insurers: { status: InsurerStatus; overdue?: boolean }[],
): Proposal {
  return {
    ...base!,
    stage,
    insurers: insurers.map((insurer, index) => ({
      insurer: `Insurer ${index + 1}`,
      status: insurer.status,
      updatedAt: null,
      dueDate: insurer.status === 'NOT_SENT' ? null : '2026-10-10',
      overdue: insurer.overdue ?? false,
    })),
  };
}

describe('awaiting quotes and overdue responses (rfq-email requirement 9)', () => {
  it('counts insurers Sent or Reminded on open cases, and the overdue ones', () => {
    const stats = computeDashboardStats(
      [
        proposal('RFQ_SENT', [
          { status: 'SENT', overdue: true },
          { status: 'REMINDED' },
          { status: 'QUOTED' },
          { status: 'NOT_SENT' },
        ]),
        proposal('QUOTES_RECEIVED', [
          { status: 'REMINDED', overdue: true },
          { status: 'DECLINED' },
        ]),
        proposal('QCR', [{ status: 'NO_RESPONSE' }, { status: 'QUOTED' }]),
        // Closed and placed cases never count.
        proposal('CLOSED', [{ status: 'SENT', overdue: true }]),
        proposal('PLACED', [{ status: 'REMINDED', overdue: true }]),
      ],
      'NEW',
      TODAY,
    );
    expect(stats.awaitingQuotesInsurers).toBe(3);
    expect(stats.awaitingQuotes).toBe(2);
    expect(stats.overdueInsurers).toBe(2);
    expect(stats.overdueCases).toBe(2);
  });

  it('is zero with nothing sent', () => {
    const stats = computeDashboardStats(
      [proposal('DATA_SHEET', [{ status: 'NOT_SENT' }])],
      'NEW',
      TODAY,
    );
    expect(stats).toMatchObject({
      awaitingQuotes: 0,
      awaitingQuotesInsurers: 0,
      overdueInsurers: 0,
      overdueCases: 0,
    });
  });
});
