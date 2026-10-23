import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { caseRecord } from './rfq/rfq-fixtures.test-utils';
import { DeleteCaseButton } from './delete-case';

const roles = vi.hoisted(() => ({ current: ['ADMIN'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: { roles: roles.current, roleNames: [], permissions: legacyPermissionsOf(roles.current) },
  }),
}));

const ID = 'a'.repeat(24);

function renderButton(onRowClick = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      {/* The lists open the case when the row is clicked. */}
      <div onClick={onRowClick}>
        <DeleteCaseButton id={ID} reference="PRP-2026-0007" clientName="Sahyadri Textiles" />
      </div>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onRowClick };
}

describe('DeleteCaseButton', () => {
  beforeEach(() => {
    roles.current = ['ADMIN'];
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              caseRecord({ id: ID, deleted: { at: '2026-10-09T10:00:00.000Z', by: 'Admin' } }),
            ),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
  });

  it('asks first, then moves the case to the Deleted bin, without opening the row', async () => {
    const { user, onRowClick } = renderButton();
    await user.click(screen.getByRole('button', { name: 'Delete PRP-2026-0007' }));
    expect(screen.getByRole('dialog', { name: 'Delete PRP-2026-0007?' })).toHaveTextContent(
      'Sahyadri Textiles’s case',
    );
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete case' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toEqual(expect.stringContaining(`/api/proxy/proposals/${ID}`));
    expect(init?.method).toBe('DELETE');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('is not shown to those who may not delete', () => {
    roles.current = ['ACCOUNT_MANAGER', 'MANAGER'];
    renderButton();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
