import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { User } from '@/shared';
import { DashboardView } from './dashboard-view';

const ADMIN: User = {
  id: '6ac3ca56d0f14307ed12b3d6',
  email: 'asha@example.com',
  name: 'Asha Menon',
  roles: ['ADMIN'],
  active: true,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
};

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: ADMIN,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DashboardView serverSearch="" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

/** The BFF's mock-mode answer: new proposals then come from the sample data, as these tests expect. */
function demoModeFetch() {
  return Promise.resolve(
    new Response(JSON.stringify({ code: 'DEMO_MODE', message: 'Not available in demo mode' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('DashboardView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(demoModeFetch));
  });

  afterEach(() => {
    // Reset the URL that useUrlSearchParams reads and writes between tests.
    window.history.replaceState(null, '', '/');
  });

  it('switching to Existing sets ?type=existing and shows the renewal KPIs', async () => {
    const user = renderDashboard();

    // The New view's KPI heading is present first.
    expect(await screen.findByText('Open proposals')).toBeInTheDocument();
    expect(window.location.search).toBe('');

    await user.click(screen.getByRole('tab', { name: /Existing proposals/ }));

    await waitFor(() => expect(window.location.search).toBe('?type=existing'));
    // KPI labels switch to the renewal set.
    expect(await screen.findByText('Renewals due in 30 days')).toBeInTheDocument();
    expect(screen.getByText('Renewals due in 60 days')).toBeInTheDocument();
    expect(screen.queryByText('Open proposals')).not.toBeInTheDocument();
  });

  it('selecting a stage chip filters by ?stage= and selecting it again clears it', async () => {
    const user = renderDashboard();
    await screen.findByText('Open proposals');

    const stageGroup = screen.getByRole('group', { name: 'Filter by stage' });
    const rfqChip = within(stageGroup).getByRole('button', { name: /RFQ Sent/ });

    expect(rfqChip).toHaveAttribute('aria-pressed', 'false');

    await user.click(rfqChip);
    await waitFor(() => expect(window.location.search).toBe('?stage=rfq-sent'));
    expect(rfqChip).toHaveAttribute('aria-pressed', 'true');

    // Selecting the active chip again clears the filter.
    await user.click(rfqChip);
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(rfqChip).toHaveAttribute('aria-pressed', 'false');
  });
});
