import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, ClientLocation } from '@/shared';
import { NewProposalForm } from './new-proposal-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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
    await user.click(screen.getByRole('button', { name: 'Create proposal' }));

    await waitFor(() =>
      expect(created).toEqual({
        clientId: CLIENT.id,
        locationIds: [PLANT_1.id],
        dueDate: '2026-10-20',
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
