import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import {
  WC_DEFAULT_CLAUSES,
  WC_DEFAULT_CONDITIONS,
  legacyPermissionsOf,
  type LegacyRole as Role,
  type WcCase,
} from '@/shared';
import { DataSheetEditor } from './data-sheet-editor';
import { WcPlacementPanel } from './placement-panel';
import { WcQcrPanel } from './qcr-panel';
import { QuotesEditor } from './quotes-editor';
import { WcRfqPanel } from './rfq-panel';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      id: 'b'.repeat(24),
      name: 'Asha Rao',
      roles: roles.current,
      roleNames: [],
      permissions: legacyPermissionsOf(roles.current),
    },
  }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const ID = 'a'.repeat(24);
const ALPHA = '1'.repeat(24);
const BETA = '2'.repeat(24);

const record = (overrides: Partial<WcCase> = {}): WcCase => ({
  id: ID,
  reference: 'WC-2026-0001',
  type: 'NEW',
  client: { id: 'c'.repeat(24), name: 'Solar Works Pvt Ltd', gstin: null, address: 'Coimbatore' },
  gstRatePercent: '18',
  policyPeriod: 'One year from the payment date',
  natureOfBusiness: 'Solar installation',
  workingHeight: null,
  riskLocation: null,
  categoryDescription: null,
  categories: [{ id: 'c1', designation: 'Skilled Workers', persons: 8, monthlyWage: '20000' }],
  coverageOptions: [
    { id: 'o1', label: 'Without Medical Expenses' },
    { id: 'o2', label: 'With 1 Lakh Medical Expenses' },
  ],
  clauses: [...WC_DEFAULT_CLAUSES],
  conditions: [...WC_DEFAULT_CONDITIONS],
  expiringPolicy: null,
  totals: { persons: 8, monthlyWages: '160000', annualWages: '1920000' },
  quotes: [],
  recommendedInsurerId: null,
  remarks: null,
  stage: 'DATA_SHEET',
  locked: false,
  rfqInsurers: [],
  placement: null,
  missing: [],
  owner: { id: 'b'.repeat(24), name: 'Asha Rao' },
  createdAt: '2026-11-17T05:00:00.000Z',
  updatedAt: '2026-11-17T05:00:00.000Z',
  ...overrides,
});

function renderWithQuery(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  roles.current = ['ACCOUNT_MANAGER'];
});

describe('WC Data Sheet', { timeout: 20_000 }, () => {
  it('adds and removes categories, coverage options and clauses, and saves them', async () => {
    let sent: Record<string, unknown> | null = null;
    fetchMock.mockImplementation((_input, init) => {
      sent = JSON.parse(init?.body as string) as Record<string, unknown>;
      return Promise.resolve(json(record()));
    });
    const user = renderWithQuery(<DataSheetEditor record={record()} canEdit />);
    // Annual wages are worked out: 8 × 20,000 × 12.
    expect(screen.getAllByText('₹19,20,000').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.type(screen.getByLabelText('Category 2'), 'Contract Workers');
    await user.type(screen.getByLabelText('Persons in category 2'), '10');
    await user.type(screen.getByLabelText('Monthly wage per person in category 2'), '15000');
    await user.click(screen.getByRole('button', { name: 'Remove coverage option 2' }));
    await user.click(screen.getByRole('button', { name: 'Remove clause 1' }));
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.type(
      screen.getByLabelText(`Condition ${WC_DEFAULT_CONDITIONS.length + 1}`),
      'Night shifts covered',
    );
    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));
    await waitFor(() => expect(sent).not.toBeNull());
    const body = sent as unknown as {
      categories: { designation: string; persons: number; monthlyWage: string }[];
      coverageOptions: { label: string }[];
      clauses: string[];
      conditions: string[];
    };
    expect(
      body.categories.map(({ designation, persons, monthlyWage }) => [
        designation,
        persons,
        monthlyWage,
      ]),
    ).toEqual([
      ['Skilled Workers', 8, '20000'],
      ['Contract Workers', 10, '15000'],
    ]);
    expect(body.coverageOptions.map((option) => option.label)).toEqual([
      'Without Medical Expenses',
    ]);
    expect(body.clauses).toEqual(WC_DEFAULT_CLAUSES.slice(1));
    expect(body.conditions.at(-1)).toBe('Night shifts covered');
  });

  it('will not save a category without its name, nor with no coverage option', async () => {
    const user = renderWithQuery(<DataSheetEditor record={record()} canEdit />);
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.click(screen.getByRole('button', { name: 'Remove coverage option 2' }));
    await user.click(screen.getByRole('button', { name: 'Remove coverage option 1' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter the category of workers');
    expect(alert).toHaveTextContent('Keep at least one coverage option');
    expect(screen.getByRole('button', { name: 'Save Data Sheet' })).toBeDisabled();
  });

  it('asks a renewal for its expiring policy', () => {
    renderWithQuery(
      <DataSheetEditor
        record={record({
          type: 'RENEWAL',
          expiringPolicy: {
            policyYear: '2024-25',
            policyNumber: null,
            insurer: 'Iffco Tokio',
            persons: 10,
            sumInsured: '2520000',
            premiumInclGst: null,
            coverageOption: null,
            claimAmount: null,
            changes: null,
          },
        })}
        canEdit
      />,
    );
    expect(screen.getByText('Expiring policy')).toBeInTheDocument();
    expect(screen.getByLabelText('Insurer')).toHaveValue('Iffco Tokio');
  });

  it('is read-only without wc.edit', () => {
    renderWithQuery(<DataSheetEditor record={record()} canEdit={false} />);
    expect(screen.getByLabelText('Category 1')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
  });
});

describe('WC quotes', { timeout: 20_000 }, () => {
  it('records each insurer’s premium per coverage option and marks the lowest', async () => {
    let sent: Record<string, unknown> | null = null;
    fetchMock.mockImplementation((_input, init) => {
      sent = JSON.parse(init?.body as string) as Record<string, unknown>;
      return Promise.resolve(json(record()));
    });
    // The insurers added on the Insurers and RFQ tab, sent the RFQ or not.
    const onRfq = record({
      rfqInsurers: [
        { insurerId: ALPHA, insurerName: 'Alpha General, Coimbatore', sentOn: null },
        { insurerId: BETA, insurerName: 'Beta General, Chennai', sentOn: null },
      ],
    });
    const user = renderWithQuery(<QuotesEditor record={onRfq} canEdit />);
    // Each RFQ insurer has its column straight away; no insurer to add.
    expect(screen.queryByRole('button', { name: 'Add insurer' })).toBeNull();
    expect(screen.getByLabelText('Alpha General, Coimbatore: payment in favour of')).toHaveValue(
      'M/s Alpha General',
    );
    await user.type(
      screen.getByLabelText('Alpha General, Coimbatore: Without Medical Expenses premium'),
      '14891.60',
    );
    await user.type(
      screen.getByLabelText('Beta General, Chennai: Without Medical Expenses premium'),
      '13500',
    );
    expect(screen.getByText('Lowest')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save quotes' }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({
      quotes: [
        {
          insurerId: ALPHA,
          paymentInFavourOf: 'M/s Alpha General',
          premiums: [
            { optionId: 'o1', premium: '14891.60' },
            { optionId: 'o2', premium: null },
          ],
        },
        {
          insurerId: BETA,
          premiums: [
            { optionId: 'o1', premium: '13500' },
            { optionId: 'o2', premium: null },
          ],
        },
      ],
      recommendedInsurerId: null,
    });
  });
});

const quoted = (overrides: Partial<WcCase> = {}) =>
  record({
    stage: 'QUOTES',
    quotes: [
      {
        insurerId: ALPHA,
        insurerName: 'Alpha General, Coimbatore',
        paymentInFavourOf: 'M/s Alpha General',
        premiums: [
          { optionId: 'o1', premium: '14891.60' },
          { optionId: 'o2', premium: null },
        ],
      },
      {
        insurerId: BETA,
        insurerName: 'Beta General, Chennai',
        paymentInFavourOf: null,
        premiums: [
          { optionId: 'o1', premium: '13500' },
          { optionId: 'o2', premium: '18000' },
        ],
      },
    ],
    ...overrides,
  });

describe('WC workflow tabs', { timeout: 20_000 }, () => {
  it('records the insurers the RFQ was sent to', async () => {
    let sent: unknown = null;
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'PUT') {
        sent = JSON.parse(init.body as string);
        return Promise.resolve(json(record()));
      }
      return Promise.resolve(json({ items: [], nextCursor: null }));
    });
    const user = renderWithQuery(
      <WcRfqPanel
        record={record({
          rfqInsurers: [
            { insurerId: ALPHA, insurerName: 'Alpha General, Coimbatore', sentOn: null },
          ],
        })}
        canEdit
      />,
    );
    expect(screen.getByText('Not sent yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sent today' }));
    await user.click(screen.getByRole('button', { name: 'Save RFQ insurers' }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toEqual({
      insurers: [{ insurerId: ALPHA, sentOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }],
    });
  });

  it('compares the premiums, marks the lowest and saves the recommendation', async () => {
    let sent: { recommendedInsurerId: string | null; quotes: unknown[] } | null = null;
    fetchMock.mockImplementation((_input, init) => {
      sent = JSON.parse(init?.body as string) as typeof sent;
      return Promise.resolve(json(quoted()));
    });
    const user = renderWithQuery(<WcQcrPanel record={quoted()} canEdit />);
    expect(screen.getByText('₹14,891.60')).toBeInTheDocument();
    expect(screen.getAllByText('Lowest')).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Our recommendation'), BETA);
    await user.click(screen.getByRole('button', { name: 'Save recommendation' }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent!.recommendedInsurerId).toBe(BETA);
    expect(sent!.quotes).toHaveLength(2);
  });

  it('records the quote accepted and the policy, which places the case', async () => {
    let sent: unknown = null;
    fetchMock.mockImplementation((_input, init) => {
      sent = JSON.parse(init?.body as string);
      return Promise.resolve(json(quoted({ stage: 'PLACED' })));
    });
    const user = renderWithQuery(<WcPlacementPanel record={quoted()} canEdit />);
    // Only quoted options can be accepted: Alpha did not quote option 2.
    const choice = screen.getByLabelText('Insurer and coverage accepted');
    expect(within(choice).getAllByRole('option')).toHaveLength(4);
    await user.selectOptions(choice, `${BETA}|o1`);
    await user.type(screen.getByLabelText('Policy number'), 'WC/2026/001');
    await user.click(screen.getByRole('button', { name: 'Save and mark placed' }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toEqual({
      insurerId: BETA,
      optionId: 'o1',
      policyNumber: 'WC/2026/001',
      policyStart: null,
      policyEnd: null,
    });
  });
});

describe('WC quotes without RFQ insurers', () => {
  it('asks for the insurers on the Insurers and RFQ tab', () => {
    renderWithQuery(<QuotesEditor record={record()} canEdit />);
    expect(screen.getByText(/Add the insurers on the Insurers and RFQ tab/)).toBeInTheDocument();
  });
});
