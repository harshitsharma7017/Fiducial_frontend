import type { FireRatingResponse } from '@property-erp/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FireBreakdown } from './fire-breakdown';

const VERSION = {
  sourceFileName: 'IIB_Code_Master.xlsx',
  effectiveFrom: '2026-10-04T18:30:00.000Z',
  activatedAt: '2026-10-05T06:00:00.000Z',
};

const workedExample: FireRatingResponse = {
  input: { occupancyCode: '2001', pincode: '400001', sumInsured: '100000000', terrorismRate: null },
  premium: {
    sumInsured: '100000000.00',
    rates: { fire: '0.69', stfi: '0.37', earthquake: '0.1', terrorism: null },
    premiums: { fire: '69000.00', stfi: '37000.00', earthquake: '10000.00', terrorism: null },
    basePremium: '116000.00',
    policyRate: '1.16',
    totalBeforeTax: '116000.00',
    gstRatePercent: '18',
    gst: '20880.00',
    total: '136880.00',
  },
  warnings: [],
  snapshot: {
    occupancyVersion: { id: '0123456789abcdef01234567', type: 'OCCUPANCY', ...VERSION },
    pincodeVersion: { id: '0123456789abcdef01234568', type: 'PINCODE', ...VERSION },
    occupancy: {
      id: '0123456789abcdef01234569',
      versionId: '0123456789abcdef01234567',
      serialNo: 31,
      tacCode: '2001',
      description: 'Abrasive Manufacturing',
      riskGrade: 'RG3',
      iibRate: '0.69',
      iibRateNote: null,
      fireRiskType: 'INDUSTRIAL',
      terrorismRiskType: 'INDUSTRIAL',
      minStfiRate: '0.37',
      minEqRates: { zone1: '0.5', zone2: '0.25', zone3: '0.1', zone4: '0.05' },
    },
    pincode: {
      id: '0123456789abcdef0123456a',
      versionId: '0123456789abcdef01234568',
      pincode: '400001',
      state: 'Mumbai',
      district: 'Mumbai',
      eqZone: 3,
      eqRates: { residential: '0.05', nonIndustrial: '0.1', industrial: '0.1' },
    },
    eqRiskType: 'INDUSTRIAL',
  },
  calculatedAt: '2026-10-05T06:30:00.000Z',
};

describe('FireBreakdown', () => {
  it('shows the worked example with Indian grouping and per-mille rates', () => {
    render(<FireBreakdown result={workedExample} />);

    const fireRow = screen.getByRole('rowheader', { name: 'Fire' }).closest('tr')!;
    expect(within(fireRow).getByText('0.69')).toBeInTheDocument();
    expect(within(fireRow).getByText('69,000.00')).toBeInTheDocument();

    const baseRow = screen.getByRole('rowheader', { name: 'Base premium' }).closest('tr')!;
    expect(within(baseRow).getByText('1.16')).toBeInTheDocument();
    expect(within(baseRow).getByText('1,16,000.00')).toBeInTheDocument();

    expect(screen.getByText('20,880.00')).toBeInTheDocument();
    expect(screen.getByText('₹1,36,880.00')).toBeInTheDocument();
    expect(screen.getByText('₹10,00,00,000.00')).toBeInTheDocument();
    expect(screen.getByText('Not included: no rate entered')).toBeInTheDocument();
  });

  it('shows warnings and the master versions used', () => {
    render(
      <FireBreakdown
        result={{
          ...workedExample,
          warnings: [
            {
              code: 'EQ_RATE_BELOW_OCCUPANCY_MINIMUM',
              message: 'The pincode EQ rate is below the minimum.',
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'The pincode EQ rate is below the minimum.',
    );
    expect(screen.getAllByText(/IIB_Code_Master\.xlsx, effective 05 Oct 2026/)).toHaveLength(2);
  });
});
