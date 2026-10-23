import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPermissionsOf, type Client, type ClientLocation } from '@/shared';
import { NewProposalForm } from './new-proposal-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const ME = 'f'.repeat(24);
const OTHER = 'e'.repeat(24);
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      id: 'f'.repeat(24),
      name: 'Asha Rao',
      roles: ['ACCOUNT_MANAGER'],
      roleNames: ['Relationship Manager'],
      permissions: legacyPermissionsOf(['ACCOUNT_MANAGER']),
    },
  }),
}));
const OWNERS = {
  items: [
    { id: ME, name: 'Asha Rao', email: 'asha@example.com' },
    { id: OTHER, name: 'Vikram Shah', email: 'vikram@example.com' },
  ],
};

const CLIENT: Client = {
  id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  name: 'Example Fabrics Pvt Ltd',
  gstin: '27ZZZZZ0001A1Z5',
  address: {
    line1: 'Plot 4, MIDC',
    line2: null,
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411019',
  },
  contacts: [],
  natureOfBusiness: 'Textile manufacturing',
  occupancy: { tacCode: '1001', description: 'Textile mills' },
  locationCount: 2,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
};

function location(id: string, name: string): ClientLocation {
  return {
    id,
    clientId: CLIENT.id,
    name,
    address: CLIENT.address,
    district: 'Pune',
    eqZone: 3,
    occupancy: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  };
}
const PLANT_1 = location('c1c1c1c1c1c1c1c1c1c1c1c1', 'Plant 1');
const GODOWN = location('c2c2c2c2c2c2c2c2c2c2c2c2', 'Bhiwandi godown');

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

describe('NewProposalForm', () => {
  beforeEach(() => {
    push.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('creates a proposal for the chosen client and the locations left ticked', async () => {
    let created: unknown;
    fetchMock.mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (init?.method === 'POST') {
        created = JSON.parse(init.body as string);
        // Only the request matters here; the workspace tests cover the proposal itself.
        return Promise.resolve(json({ code: 'INTERNAL', message: 'Not needed' }, 500));
      }
      if (url.includes('proposals/owners')) return Promise.resolve(json(OWNERS));
      if (url.includes('/locations')) {
        return Promise.resolve(json({ items: [PLANT_1, GODOWN], nextCursor: null }));
      }
      return Promise.resolve(json({ items: [CLIENT], nextCursor: null }));
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <NewProposalForm />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Example Fabrics Pvt Ltd/ }));
    expect(await screen.findByLabelText(/Plant 1/)).toBeChecked();
    expect(screen.getByLabelText(/Bhiwandi godown/)).toBeChecked();
    await user.click(screen.getByLabelText(/Bhiwandi godown/));
    expect(screen.getByText('1 of 2 chosen')).toBeInTheDocument();

    const due = screen.getByLabelText('Quotes needed by');
    await user.clear(due);
    await user.type(due, '2026-10-20');
    // Assigned to the signed-in user unless someone else is chosen.
    await waitFor(() => expect(screen.getByLabelText('Assigned to')).toHaveValue(ME));
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Vikram Shah');
    await user.click(screen.getByRole('button', { name: 'Create proposal' }));

    await waitFor(() =>
      expect(created).toEqual({
        type: 'NEW',
        clientId: CLIENT.id,
        locationIds: [PLANT_1.id],
        ownerId: OTHER,
        policyStart: null,
        policyEnd: null,
        dueDate: '2026-10-20',
      }),
    );
  });

  it('starts a renewal from last year’s policy, which sets the new policy period', async () => {
    let created: unknown;
    fetchMock.mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (init?.method === 'POST') {
        created = JSON.parse(init.body as string);
        return Promise.resolve(json({ code: 'INTERNAL', message: 'Not needed' }, 500));
      }
      if (url.includes('proposals/owners')) return Promise.resolve(json(OWNERS));
      if (url.includes('proposals/last-policy')) {
        return Promise.resolve(
          json({
            status: 'FOUND',
            message: null,
            checkedAt: '2026-10-07T04:00:00.000Z',
            policy: {
              source: 'PolicyDesk',
              fetchedAt: '2026-10-07T04:00:00.000Z',
              insurer: 'Example General, Fort',
              policyNumber: 'EGI/2025/42',
              product: 'BLUS',
              periodStart: '2025-11-01',
              periodEnd: '2026-10-31',
              sections: [{ code: 'FIRE', sumInsured: '120000000', premium: '96000' }],
              fireLines: [],
              totalSumInsured: '120000000',
              netPremium: '96000',
              gst: '17280',
              totalPremium: '113280',
            },
          }),
        );
      }
      if (url.includes('/locations')) {
        return Promise.resolve(json({ items: [PLANT_1], nextCursor: null }));
      }
      return Promise.resolve(json({ items: [CLIENT], nextCursor: null }));
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <NewProposalForm initialType="EXISTING" />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(screen.getByLabelText(/Renewal/)).toBeChecked();
    await user.click(await screen.findByRole('button', { name: /Example Fabrics Pvt Ltd/ }));
    const last = await screen.findByRole('region', { name: 'Last year’s policy' });
    expect(last).toHaveTextContent('EGI/2025/42');
    expect(last).toHaveTextContent('Example General, Fort');
    expect(last).toHaveTextContent('₹12,00,00,000.00');
    expect(screen.getByLabelText('Policy period from')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Policy period to')).toHaveValue('2027-10-31');
    await waitFor(() => expect(screen.getByLabelText('Assigned to')).toHaveValue(ME));
    await user.click(screen.getByRole('button', { name: 'Create renewal' }));
    await waitFor(() =>
      expect(created).toMatchObject({
        type: 'EXISTING',
        clientId: CLIENT.id,
        policyStart: '2026-11-01',
        policyEnd: '2027-10-31',
      }),
    );
  });

  it('asks for a client before creating', async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextCursor: null }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <NewProposalForm />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(await screen.findByText('No clients yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create proposal' }));
    expect(await screen.findByText('Choose the insured client')).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
  });
});
