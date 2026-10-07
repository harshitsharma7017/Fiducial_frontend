import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE_ID,
  INSURER_A,
  INSURER_B,
  caseRecord,
  json,
  urlOf,
} from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { Qcr, Role } from '@/shared';
import { QcrPanel } from './qcr-panel';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { name: 'Asha Rao', roles: roles.current } }),
}));

function qcr(overrides: Partial<Qcr> = {}): Qcr {
  return {
    status: 'DRAFT',
    gstRatePercent: '18',
    insurers: [
      { insurerId: INSURER_A, company: 'Kavach General', branch: 'Pune', status: 'QUOTED' },
      { insurerId: INSURER_B, company: 'Suraksha General', branch: 'Fort', status: 'QUOTED' },
    ],
    options: [
      {
        option: 'P1',
        sections: [
          {
            code: 'FIRE',
            name: 'Fire',
            existingSumInsured: null,
            existingPremium: null,
            sumInsured: '60000000',
          },
        ],
        existing: null,
        quotes: [
          {
            insurerId: INSURER_A,
            quoteId: '1'.repeat(24),
            version: 2,
            premiums: [{ code: 'FIRE', premium: '100000' }],
            fireWithTerrorism: false,
            totals: { net: '100000.00', gst: '18000.00', total: '118000.00' },
            terrorismExtra: '20000.00',
            deviations: [],
            lowest: true,
          },
          {
            insurerId: INSURER_B,
            quoteId: '2'.repeat(24),
            version: 1,
            premiums: [{ code: 'FIRE', premium: '110000' }],
            fireWithTerrorism: false,
            totals: { net: '110000.00', gst: '19800.00', total: '129800.00' },
            terrorismExtra: null,
            deviations: ['Capacity 80%: not the whole risk'],
            lowest: false,
          },
        ],
        differences: [
          {
            topic: 'Capacity',
            values: [
              { insurerId: INSURER_A, value: 'Not stated' },
              { insurerId: INSURER_B, value: '80%' },
            ],
          },
        ],
      },
    ],
    recommendedInsurerId: null,
    recommendedOption: null,
    recommendation: null,
    remarks: null,
    paymentInFavourOf: null,
    updatedAt: null,
    updatedBy: null,
    fingerprint: 'f1',
    approval: null,
    missing: [
      'Choose the insurer and the option recommended.',
      'Enter who the cheque / payment is in favour of.',
    ],
    sends: [],
    recipients: [{ name: 'Ravi Mehta', email: 'ravi@mills.example' }],
    ...overrides,
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <QcrPanel record={caseRecord({ stage: 'RFQ_SENT' })} />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

describe('QcrPanel', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('QC-1, QC-2, QC-3: compares, marks the lowest, and saves the recommendation', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    let saved: unknown;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'PUT') {
        saved = JSON.parse(init.body as string);
        return Promise.resolve(
          json(
            qcr({
              recommendedInsurerId: INSURER_A,
              recommendedOption: 'P1',
              paymentInFavourOf: 'Kavach General',
              missing: [],
              fingerprint: 'f2',
            }),
          ),
        );
      }
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/qcr`)) return Promise.resolve(json(qcr()));
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel();
    const [header] = await screen.findAllByRole('columnheader', { name: /Kavach General, Pune/ });
    expect(within(header as HTMLElement).getByText('Lowest')).toBeInTheDocument();
    expect(screen.getByText('₹1,18,000.00')).toBeInTheDocument();
    expect(screen.getByText('Capacity 80%: not the whole risk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to the insured' })).toBeDisabled();
    // Approval is an approver's: not offered to an account manager.
    expect(screen.queryByRole('button', { name: 'Approve QCR' })).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Recommended insurer and option'),
      'Kavach General, Pune — Proposed Option 1 (lowest)',
    );
    await user.click(screen.getByRole('button', { name: 'Use Kavach General' }));
    await user.type(screen.getByLabelText('Recommendation'), 'Lowest premium, full capacity');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(saved).toEqual({
        recommendedInsurerId: INSURER_A,
        recommendedOption: 'P1',
        recommendation: 'Lowest premium, full capacity',
        remarks: null,
        paymentInFavourOf: 'Kavach General',
      }),
    );
  });

  it('QC-6: an approver approves what is shown; then it can be sent to the insured', async () => {
    roles.current = ['ADMIN'];
    const ready = qcr({
      recommendedInsurerId: INSURER_A,
      recommendedOption: 'P1',
      paymentInFavourOf: 'Kavach General',
      missing: [],
    });
    const approved = {
      ...ready,
      status: 'APPROVED' as const,
      approval: { at: '2026-10-08T05:00:00.000Z', by: 'Asha Rao', current: true },
    };
    let approvedWith: unknown;
    let sent: { to: string[]; format: string } | undefined;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/qcr/approve')) {
        approvedWith = JSON.parse(init?.body as string);
        return Promise.resolve(json(approved));
      }
      if (url.endsWith('/qcr/email')) {
        sent = JSON.parse(init?.body as string) as { to: string[]; format: string };
        return Promise.resolve(
          json({ outcome: 'SENT', reason: null, qcr: { ...approved, status: 'SENT' } }),
        );
      }
      if (url.endsWith(`/proposals/${CASE_ID}/qcr`)) return Promise.resolve(json(ready));
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Approve QCR' }));
    await waitFor(() => expect(approvedWith).toEqual({ fingerprint: 'f1' }));
    expect(await screen.findByText(/Approved by Asha Rao/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send to the insured' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Ravi Mehta <ravi@mills.example>')).toBeChecked();
    await user.type(within(dialog).getByLabelText('Other addresses'), 'accounts@mills.example');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(sent).toMatchObject({
        to: ['ravi@mills.example', 'accounts@mills.example'],
        format: 'pdf',
      }),
    );
    expect(
      await screen.findByText('Sent to the insured', { selector: 'span' }),
    ).toBeInTheDocument();
  });
});
