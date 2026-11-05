import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { qcr } from './ghi-fixtures.test-utils';
import { QcrTable } from './qcr-table';

const premium = (option: number, base: string, gst: string, total: string, lowest: boolean) => ({
  option,
  label: `Option ${option}`,
  sumInsured: option === 1 ? null : '700000',
  basePremium: base,
  gst,
  totalPremium: total,
  lowest,
});

describe('the QCR with Options 1–2 (alteration 3/11/2026)', () => {
  it('shows each option’s premium per insurer, the lowest per option and the recommended one', () => {
    const base = qcr();
    const options = qcr({
      options: [
        { option: 1, label: 'Option 1', sumInsured: null },
        { option: 2, label: 'Option 2', sumInsured: '700000' },
      ],
      recommendedOption: 2,
      columns: [
        {
          ...base.columns[0]!,
          options: [
            premium(1, '100000.00', '18000.00', '118000.00', true),
            { ...premium(2, '', '', '', false), basePremium: null, gst: null, totalPremium: null },
          ],
        },
        {
          ...base.columns[1]!,
          options: [
            premium(1, '110000.00', '19800.00', '129800.00', false),
            premium(2, '150000.00', '27000.00', '177000.00', true),
          ],
        },
      ],
    });
    render(<QcrTable qcr={options} />);
    const row = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name}`) });
    expect(within(row('Option 2: Base premium')).getByText('Sum insured ₹7,00,000')).toBeVisible();
    const option2 = row('Option 2: Total premium');
    // The first insurer did not quote Option 2; the second has its lowest, recommended total.
    expect(within(option2).getByText('Not quoted')).toBeVisible();
    expect(within(option2).getByText('(lowest)')).toBeVisible();
    expect(within(option2).getByText('(recommended)')).toBeVisible();
    expect(within(row('Option 1: Total premium')).getByText('(lowest)')).toBeVisible();
  });

  it('keeps the single set of premium rows for a case with Option 1 only', () => {
    render(<QcrTable qcr={qcr()} />);
    expect(screen.getByRole('row', { name: /^Total premium/ })).toBeVisible();
    expect(screen.queryByText(/^Option 1:/)).toBeNull();
  });
});
