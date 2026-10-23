import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { PageGate } from './page-gate';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

function renderGate(pathname: string, roles: readonly Role[] | undefined) {
  navigation.pathname = pathname;
  render(
    // A user holding these migrated system roles, with the permissions /auth/me gives them.
    <PageGate permissions={roles ? legacyPermissionsOf(roles) : undefined}>
      <h1>Page content</h1>
    </PageGate>,
  );
}

const pageShown = () => screen.queryByRole('heading', { name: 'Page content' });

describe('PageGate', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard';
  });

  it('shows a page to roles that hold its permission', () => {
    renderGate('/masters/import', ['ACCOUNT_MANAGER']);
    expect(pageShown()).toBeInTheDocument();
  });

  it('shows "You do not have access" instead of the page to other roles', () => {
    renderGate('/masters/import', ['READ_ONLY']);
    expect(pageShown()).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have access');
  });

  it.each<[string, Role]>([
    ['/users', 'MANAGER'],
    ['/audit', 'ACCOUNT_MANAGER'],
    ['/settings', 'PLACEMENT_EXEC'],
    ['/proposals/new', 'MANAGER'],
  ])('keeps %s from %s', (pathname, role) => {
    renderGate(pathname, [role]);
    expect(pageShown()).not.toBeInTheDocument();
  });

  it('lets a Relationship Manager open the new proposal page', () => {
    renderGate('/proposals/new', ['ACCOUNT_MANAGER']);
    expect(pageShown()).toBeInTheDocument();
  });

  it('waits for the user before showing a restricted page', () => {
    renderGate('/users', undefined);
    expect(pageShown()).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your access…');
  });

  it('waits for the user before any page that needs a permission, and shows pages that need nothing', () => {
    renderGate('/dashboard', undefined);
    expect(pageShown()).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your access…');
  });

  it('follows the permissions, not the role: a custom role with only the permission opens the page', () => {
    navigation.pathname = '/masters/products';
    render(
      <PageGate permissions={['catalog.view']}>
        <h1>Page content</h1>
      </PageGate>,
    );
    expect(pageShown()).toBeInTheDocument();
  });

  it('needs no permission for the profile page', () => {
    renderGate('/profile', ['READ_ONLY']);
    expect(pageShown()).toBeInTheDocument();
  });
});
