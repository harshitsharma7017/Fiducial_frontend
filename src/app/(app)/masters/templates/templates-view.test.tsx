import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { TemplatesView } from './templates-view';

const roles = vi.hoisted(() => ({ current: ['ADMIN'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: { roles: roles.current, roleNames: [], permissions: legacyPermissionsOf(roles.current) },
  }),
}));

const CHECK = {
  ok: true,
  problems: [],
  sheets: ['premium details', 'schedule'],
  letterhead: { logo: true, address: 'Fiducial Insurance Brokers India Pvt Ltd.,\nCoimbatore' },
};
const LIST = {
  items: [
    {
      kind: 'RFQ',
      label: 'RFQ',
      filled: true,
      template: {
        kind: 'RFQ',
        fileName: 'Fiducial_RFQ format.xlsx',
        size: 55384,
        sha256: 'a'.repeat(64),
        uploadedAt: '2026-10-07T04:00:00.000Z',
        uploadedBy: 'Administrator',
        check: CHECK,
      },
    },
    { kind: 'QCR', label: 'QCR', filled: false, template: null },
    { kind: 'PLACEMENT_SLIP', label: 'Placement Slip', filled: false, template: null },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TemplatesView />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('TemplatesView', () => {
  beforeEach(() => {
    roles.current = ['ADMIN'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows each template, what the engine found, and refuses a file it cannot fill', async () => {
    let uploaded: string | undefined;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST') {
        uploaded = input instanceof Request ? input.url : input.toString();
        return Promise.resolve(
          json({
            saved: false,
            template: null,
            check: { ...CHECK, ok: false, problems: ['The "schedule" sheet is missing.'] },
          }),
        );
      }
      return Promise.resolve(json(LIST));
    });
    const user = renderView();
    const rfq = (await screen.findByRole('heading', { name: /RFQ/ })).closest<HTMLElement>(
      '[data-slot=card]',
    )!;
    expect(within(rfq).getByText('Fiducial_RFQ format.xlsx')).toBeInTheDocument();
    expect(within(rfq).getByText('Logo found')).toBeInTheDocument();
    expect(within(rfq).getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/proxy/templates/RFQ/file',
    );
    const qcr = screen
      .getByRole('heading', { name: /QCR/ })
      .closest<HTMLElement>('[data-slot=card]')!;
    expect(within(qcr).getByText('Planned')).toBeInTheDocument();
    expect(within(qcr).getByText('No template yet.')).toBeInTheDocument();

    const file = new File(['x'], 'other.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(within(rfq).getByLabelText('RFQ template file'), file);
    expect(await within(rfq).findByText('The "schedule" sheet is missing.')).toBeInTheDocument();
    expect(uploaded).toBe('/api/proxy/templates/RFQ?fileName=other.xlsx');
  });

  it('is read-only without masters.manage', async () => {
    roles.current = ['READ_ONLY'];
    fetchMock.mockResolvedValue(json(LIST));
    renderView();
    await screen.findByText('Fiducial_RFQ format.xlsx');
    expect(screen.queryByRole('button', { name: /template/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Download' })).toHaveLength(1));
  });
});
