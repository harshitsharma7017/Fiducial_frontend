import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacementSlipsView } from '@/app/(app)/placement-slips/placement-slips-view';
import { QuotesView } from '@/app/(app)/quotes/quotes-view';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import {
  legacyPermissionsOf,
  type PlacementSlipSummary,
  type QcrSummary,
  type LegacyRole as Role,
} from '@/shared';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: { roles: roles.current, roleNames: [], permissions: legacyPermissionsOf(roles.current) },
  }),
}));

function qcr(n: number, overrides: Partial<QcrSummary> = {}): QcrSummary {
  return {
    proposalId: String(n).repeat(24),
    reference: `PRP-2026-000${n}`,
    clientName: `Client ${n}`,
    clientCity: 'Pune',
    type: 'NEW',
    stage: 'RFQ_SENT',
    dueDate: '2099-01-10',
    insurers: { asked: 3, quoted: 0, declined: 0, awaiting: 3, overdue: 0 },
    lowest: null,
    qcr: { status: 'DRAFT', recommended: null, approvedAt: null, sentAt: null },
    ...overrides,
  };
}

function slip(n: number, overrides: Partial<PlacementSlipSummary> = {}): PlacementSlipSummary {
  return {
    proposalId: String(n).repeat(24),
    reference: `PRP-2026-000${n}`,
    clientName: `Client ${n}`,
    clientCity: 'Pune',
    type: 'NEW',
    stage: 'CLIENT_APPROVAL',
    accepted: {
      company: 'Kavach General',
      branch: 'Pune',
      option: 'P1',
      withTerrorism: false,
      total: '119770.00',
      acceptedOn: '2026-10-07',
    },
    slip: { status: 'DRAFT', approvedAt: null, sentAt: null },
    placed: null,
    ...overrides,
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderView(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

describe('cross-case lists', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/');
  });

  it('Quotes and QCR: every case whose RFQ went out, by where its QCR stands', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).endsWith('/qcrs')
          ? json({
              items: [
                qcr(1),
                qcr(2, {
                  insurers: { asked: 3, quoted: 2, declined: 1, awaiting: 0, overdue: 0 },
                  lowest: {
                    company: 'Kavach General',
                    branch: 'Pune',
                    option: 'P1',
                    total: '451822.00',
                  },
                }),
                qcr(3, {
                  lowest: { company: 'Suraksha', branch: 'Fort', option: 'P1', total: '100000.00' },
                  qcr: {
                    status: 'SENT',
                    recommended: 'Suraksha, Fort',
                    approvedAt: null,
                    sentAt: '2026-10-08T05:00:00.000Z',
                  },
                }),
              ],
            })
          : json({}, 404),
      ),
    );
    const user = renderView(<QuotesView serverSearch="" />);
    expect(await screen.findByRole('link', { name: 'PRP-2026-0002' })).toHaveAttribute(
      'href',
      `/proposals/${'2'.repeat(24)}?tab=qcr`,
    );
    expect(screen.getByRole('link', { name: 'PRP-2026-0001' })).toHaveAttribute(
      'href',
      `/proposals/${'1'.repeat(24)}?tab=quotes`,
    );
    expect(screen.getByText('₹4,51,822.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'QCR to approve (1)' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('link')).toHaveLength(1);
    expect(within(table).getByRole('link', { name: 'PRP-2026-0002' })).toBeInTheDocument();
  });

  it('Placement Slips: every accepted quote, from slip to policy', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).endsWith('/placement-slips')
          ? json({
              items: [
                slip(1),
                slip(2, {
                  stage: 'PLACED',
                  slip: { status: 'SENT', approvedAt: null, sentAt: '2026-10-08T05:00:00.000Z' },
                  placed: { documentKind: 'COVER_NOTE', number: 'CN-77', issuedOn: '2026-10-08' },
                }),
              ],
            })
          : json({}, 404),
      ),
    );
    const user = renderView(<PlacementSlipsView serverSearch="" />);
    expect(await screen.findByText('Cover note CN-77')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,19,770.00')).toHaveLength(2);
    await user.type(screen.getByLabelText('Search'), 'CN-77');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Placed (1)' })).toBeInTheDocument();
  });
});
