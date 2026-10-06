import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Role } from '@/shared';
import { SidebarNav } from './sidebar-nav';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

function renderNav(roles: readonly Role[] | undefined, collapsed = false) {
  render(
    <TooltipProvider>
      <SidebarNav roles={roles} collapsed={collapsed} />
    </TooltipProvider>,
  );
  return screen.getByRole('navigation', { name: 'Main' });
}

const PLANNED = [
  'RFQ',
  'Quotes and QCR',
  'Placement Slips',
  'Add-on Covers',
  'Clauses',
  'Insurers',
];

describe('SidebarNav', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard';
    navigation.search = '';
  });

  it('shows the Admin group only to admins', () => {
    const nav = renderNav(['ACCOUNT_MANAGER']);
    expect(within(nav).queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('gives admins Users and Settings', () => {
    const nav = renderNav(['ADMIN']);
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('shows planned items as disabled links that go nowhere', () => {
    const nav = renderNav(['ADMIN']);
    for (const label of PLANNED) {
      const item = within(nav).getByRole('link', { name: `${label} Planned` });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).not.toHaveAttribute('href');
    }
    expect(within(nav).getAllByText('Planned')).toHaveLength(PLANNED.length);
  });

  it('marks the current page with aria-current', () => {
    navigation.pathname = '/masters/occupancy';
    const nav = renderNav(['READ_ONLY']);
    expect(within(nav).getByRole('link', { name: 'Occupancy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Pincodes' })).not.toHaveAttribute('aria-current');
  });

  it('matches the proposal lists on their type, with new as the default', () => {
    navigation.pathname = '/proposals';
    navigation.search = 'type=existing';
    const { unmount } = render(
      <TooltipProvider>
        <SidebarNav roles={['READ_ONLY']} />
      </TooltipProvider>,
    );
    expect(screen.getByRole('link', { name: 'Existing Proposals' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'New Proposals' })).not.toHaveAttribute('aria-current');
    unmount();

    navigation.search = 'type=unknown';
    renderNav(['READ_ONLY']);
    expect(screen.getByRole('link', { name: 'New Proposals' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks no item on a proposal page', () => {
    navigation.pathname = '/proposals/prp-0101';
    const nav = renderNav(['READ_ONLY']);
    expect(within(nav).queryAllByRole('link', { current: 'page' })).toHaveLength(0);
  });

  it('hides the role-restricted groups while the user loads', () => {
    const nav = renderNav(undefined);
    expect(within(nav).queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows each label in a tooltip on keyboard focus in the rail', async () => {
    const user = userEvent.setup();
    const nav = renderNav(['READ_ONLY'], true);
    // Labels stay in the accessible name while visually hidden.
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    await user.tab();
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Dashboard');
  });
});
