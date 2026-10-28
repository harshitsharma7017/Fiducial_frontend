import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE_ID, json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import { legacyPermissionsOf, type CloudDocument, type LegacyRole as Role } from '@/shared';
import { CloudDocumentsCard, SaveToCloud } from './cloud-documents';

// Cloud storage only for the documents users save (client review, 27 Oct 2026).

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      name: 'Asha Rao',
      roles: roles.current,
      roleNames: [],
      permissions: legacyPermissionsOf(roles.current),
    },
  }),
}));

const SAVED: CloudDocument = {
  id: 'c'.repeat(24),
  document: 'QCR',
  format: 'pdf',
  fileName: 'QCR-PRP-2026-0001.pdf',
  size: 64_090,
  detail: 'approved',
  savedAt: '2026-10-28T05:00:00.000Z',
  savedBy: 'Asha Rao',
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderWith(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

describe('cloud documents', () => {
  beforeEach(() => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('offers "Save to cloud" and saves the document as chosen', async () => {
    let saved: unknown;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST') {
        saved = JSON.parse(init.body as string);
        return Promise.resolve(json(SAVED, 201));
      }
      return Promise.resolve(json({ enabled: true, items: [] }));
    });
    const user = renderWith(<SaveToCloud proposalId={CASE_ID} document="QCR" />);
    await user.click(await screen.findByRole('button', { name: 'Save to cloud' }));
    await user.click(await screen.findByRole('menuitem', { name: 'QCR as PDF' }));
    await waitFor(() => expect(saved).toEqual({ document: 'QCR', format: 'pdf' }));
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          init?.method === 'POST' &&
          urlOf(input).endsWith(`/api/proxy/proposals/${CASE_ID}/cloud-documents`),
      ),
    ).toBe(true);
  });

  it('shows nothing to save when the server has no cloud storage, or to roles that cannot export', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false, items: [] }));
    renderWith(<SaveToCloud proposalId={CASE_ID} document="RFQ" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Save to cloud' })).not.toBeInTheDocument();

    roles.current = ['READ_ONLY'];
    fetchMock.mockResolvedValue(json({ enabled: true, items: [] }));
    renderWith(<SaveToCloud proposalId={CASE_ID} document="RFQ" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Save to cloud' })).not.toBeInTheDocument();
  });

  it('lists the saved documents and removes one after confirming', async () => {
    let removed = false;
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'DELETE') {
        removed = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(json({ enabled: true, items: removed ? [] : [SAVED] }));
    });
    const user = renderWith(<CloudDocumentsCard proposalId={CASE_ID} />);
    const row = (await screen.findByRole('cell', { name: 'QCR-PRP-2026-0001.pdf' })).closest('tr')!;
    expect(within(row).getByText('63 KB')).toBeInTheDocument();
    expect(within(row).getByText('by Asha Rao')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: /Remove/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove from cloud storage?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Nothing saved to the cloud yet')).toBeInTheDocument();
    expect(removed).toBe(true);
  });

  it('says when cloud storage is not set up', async () => {
    fetchMock.mockResolvedValue(json({ enabled: false, items: [] }));
    renderWith(<CloudDocumentsCard proposalId={CASE_ID} />);
    expect(await screen.findByText('Cloud storage is not set up')).toBeInTheDocument();
  });
});
