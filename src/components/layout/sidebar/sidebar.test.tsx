import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { SidebarNav } from './sidebar-nav';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

function renderNav(roles: readonly Role[] | undefined, collapsed = false) {
  render(
    <TooltipProvider>
      <SidebarNav
        permissions={roles ? legacyPermissionsOf(roles) : undefined}
        collapsed={collapsed}
      />
    </TooltipProvider>,
  );
  return screen.getByRole('navigation', { name: 'Main' });
}

/** The items that were placeholders before their screens were built. */
const ONCE_PLANNED = [
  ['Quotes and QCR', '/quotes'],
  ['Placement Slips', '/placement-slips'],
  ['Clauses', '/masters/clauses'],
] as const;

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

  it('gives admins Users, the audit log and Settings', () => {
    const nav = renderNav(['ADMIN']);
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    expect(within(nav).getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/audit');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('hides Import data from those who do not manage clients', () => {
    expect(
      within(renderNav(['READ_ONLY'])).queryByRole('link', { name: 'Import data' }),
    ).not.toBeInTheDocument();
    cleanup();
    expect(
      within(renderNav(['ACCOUNT_MANAGER'])).getByRole('link', { name: 'Import data' }),
    ).toHaveAttribute('href', '/masters/import');
  });

  it('links every item: nothing is left as planned', () => {
    const nav = renderNav(['ADMIN']);
    for (const [label, href] of ONCE_PLANNED) {
      const item = within(nav).getByRole('link', { name: label });
      expect(item).toHaveAttribute('href', href);
      expect(item).not.toHaveAttribute('aria-disabled');
    }
    expect(within(nav).queryByText('Planned')).not.toBeInTheDocument();
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

  it('has one Proposals item, current on the list whatever its type, and on each proposal', () => {
    for (const [pathname, search] of [
      ['/proposals', ''],
      ['/proposals', 'type=existing'],
      ['/proposals/new', 'type=new'],
      ['/proposals/prp-0101', ''],
    ] as const) {
      navigation.pathname = pathname;
      navigation.search = search;
      const nav = renderNav(['READ_ONLY']);
      expect(within(nav).getAllByRole('link', { name: /proposals/i })).toHaveLength(1);
      expect(within(nav).getByRole('link', { name: 'Proposals' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      cleanup();
    }
  });

  it('shows no item while the user loads: roles are configurable, so nothing is open to all', () => {
    const nav = renderNav(undefined);
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
  });

  it('gives admins the Roles page', () => {
    const nav = renderNav(['ADMIN']);
    expect(within(nav).getByRole('link', { name: 'Roles' })).toHaveAttribute('href', '/roles');
    cleanup();
    expect(within(renderNav(['MANAGER'])).queryByRole('link', { name: 'Roles' })).toBeNull();
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
