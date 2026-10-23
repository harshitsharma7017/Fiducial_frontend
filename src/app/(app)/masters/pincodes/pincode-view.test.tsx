import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPermissionsOf, type PincodeRecord, type LegacyRole as Role } from '@/shared';
import { PincodeView } from './pincode-view';

const RECORDS: PincodeRecord[] = [
  {
    id: 'a00000000000000000000001',
    versionId: 'b00000000000000000000001',
    pincode: '400001',
    state: 'Mumbai',
    district: 'Mumbai',
    eqZone: 3,
    eqRates: { residential: '0.05', nonIndustrial: '0.1', industrial: '0.1' },
  },
  {
    id: 'a00000000000000000000002',
    versionId: 'b00000000000000000000001',
    pincode: '411001',
    state: 'Maharashtra',
    district: 'Pune',
    eqZone: null,
    eqRates: { residential: '0.075', nonIndustrial: null, industrial: '0.1' },
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function renderView(roles: Role[]) {
  fetchMock.mockImplementation((input, init) => {
    if (input.endsWith('/auth/me')) {
      return Promise.resolve(
        json({
          id: '0123456789abcdef01234567',
          email: 'a@example.com',
          name: 'Asha',
          roles,
          roleNames: [],
          permissions: legacyPermissionsOf(roles),
          active: true,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        }),
      );
    }
    if (init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string) as Omit<
        PincodeRecord,
        'id' | 'versionId' | 'pincode'
      >;
      return Promise.resolve(json({ ...RECORDS[0], ...body }));
    }
    const q = new URL(input, 'http://x').searchParams.get('q') ?? '';
    return Promise.resolve(
      json({
        items: RECORDS.filter(
          (r) => r.pincode.startsWith(q) || r.district.toLowerCase().includes(q.toLowerCase()),
        ),
        nextCursor: null,
      }),
    );
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PincodeView />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('PincodeView', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('lists every pincode with its zone and rates, kept exactly', async () => {
    renderView(['READ_ONLY']);
    const row = (await screen.findByRole('cell', { name: '411001' })).closest('tr')!;
    expect(within(row).getByText('Pune')).toBeInTheDocument();
    expect(within(row).getByText('Not set')).toBeInTheDocument();
    expect(within(row).getByText('0.075')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 pincodes')).toBeInTheDocument();
    // Read-only users can download but not change.
    expect(screen.queryByRole('button', { name: /Edit pincode/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add pincode' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download as Excel' })).toBeInTheDocument();
  });

  it('searches by district', async () => {
    const user = renderView(['READ_ONLY']);
    await screen.findByRole('cell', { name: '400001' });
    await user.type(screen.getByLabelText('Search by pincode, district or state'), 'pune');
    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: '400001' })).not.toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls.some(([url]) => url.includes('q=pune'))).toBe(true);
  });

  it('lets an Admin correct a pincode', async () => {
    const user = renderView(['ADMIN']);
    await user.click(await screen.findByRole('button', { name: 'Edit pincode 400001' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Pincode')).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('AIFT earthquake zone'), '2');
    await user.clear(within(dialog).getByLabelText('Industrial'));
    await user.type(within(dialog).getByLabelText('Industrial'), '0.25');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(patch[0]).toBe('/api/proxy/masters/pincodes/400001');
    expect(JSON.parse(patch[1]!.body as string)).toEqual({
      state: 'Mumbai',
      district: 'Mumbai',
      eqZone: 2,
      eqRates: { residential: '0.05', nonIndustrial: '0.1', industrial: '0.25' },
    });
  });
});
