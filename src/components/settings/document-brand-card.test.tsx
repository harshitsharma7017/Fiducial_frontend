import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import { DEFAULT_DOCUMENT_BRAND, legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { DocumentBrandCard } from './document-brand-card';

const roles = vi.hoisted(() => ({ current: ['ADMIN'] as Role[] }));
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
const saved = { ...DEFAULT_DOCUMENT_BRAND, isDefault: true, updatedAt: null, updatedBy: null };

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentBrandCard />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  roles.current = ['ADMIN'];
});

describe('DocumentBrandCard', { timeout: 20_000 }, () => {
  it('previews the header and footer as typed and saves them', async () => {
    let body: unknown = null;
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'PUT') {
        body = JSON.parse(init.body as string);
        return Promise.resolve(
          json({
            ...(body as object),
            isDefault: false,
            updatedAt: '2026-11-16T10:00:00.000Z',
            updatedBy: 'Asha Rao',
          }),
        );
      }
      return Promise.resolve(json(saved));
    });
    const user = renderCard();
    const name = await screen.findByLabelText('Company name');
    expect(name).toHaveValue(DEFAULT_DOCUMENT_BRAND.companyName);
    await user.clear(name);
    await user.type(name, 'Example Brokers Pvt Ltd');
    await user.clear(screen.getByLabelText('E-mail'));
    await user.type(screen.getByLabelText('Footer note'), 'Licence 123');
    const preview = screen.getByRole('figure', { name: 'Preview' });
    expect(within(preview).getByText('Example Brokers Pvt Ltd')).toBeInTheDocument();
    expect(within(preview).getByText('Licence 123')).toBeInTheDocument();
    expect(within(preview).queryByText(/E-mail/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save header and footer' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({
      ...DEFAULT_DOCUMENT_BRAND,
      companyName: 'Example Brokers Pvt Ltd',
      email: '',
      footerNote: 'Licence 123',
    });
  });

  it('will not save without a company name', async () => {
    fetchMock.mockResolvedValue(json(saved));
    const user = renderCard();
    await user.clear(await screen.findByLabelText('Company name'));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the company name');
    expect(screen.getByRole('button', { name: 'Save header and footer' })).toBeDisabled();
  });

  it('is read-only without the Manage document templates permission', async () => {
    roles.current = ['READ_ONLY'];
    fetchMock.mockResolvedValue(json(saved));
    renderCard();
    expect(await screen.findByLabelText('Company name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save header and footer' })).toBeNull();
  });
});
