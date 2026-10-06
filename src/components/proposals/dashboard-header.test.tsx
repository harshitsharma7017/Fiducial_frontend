import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role, User } from '@/shared';
import { DashboardHeader } from './dashboard-header';

const session = vi.hoisted(() => ({ roles: ['ADMIN'] as Role[] }));

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      id: '6ac3ca56d0f14307ed12b3d6',
      email: 'asha@example.com',
      name: 'Asha Menon',
      roles: session.roles,
      active: true,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:00:00.000Z',
    } satisfies User,
  }),
}));

describe('DashboardHeader', () => {
  beforeEach(() => {
    session.roles = ['ADMIN'];
  });

  it.each<Role>(['ADMIN', 'ACCOUNT_MANAGER'])('offers %s the new proposal action', (role) => {
    session.roles = [role];
    render(<DashboardHeader type="NEW" />);
    expect(screen.getByRole('link', { name: 'New proposal' })).toHaveAttribute(
      'href',
      '/proposals/new?type=new',
    );
  });

  it('offers Start renewal on the renewals view', () => {
    session.roles = ['ACCOUNT_MANAGER'];
    render(<DashboardHeader type="EXISTING" />);
    expect(screen.getByRole('link', { name: 'Start renewal' })).toHaveAttribute(
      'href',
      '/proposals/new?type=existing',
    );
  });

  it.each<Role>(['MANAGER', 'PLACEMENT_EXEC', 'READ_ONLY'])(
    'hides the create action from %s',
    (role) => {
      session.roles = [role];
      render(<DashboardHeader type="NEW" />);
      expect(screen.queryByRole('link', { name: 'New proposal' })).not.toBeInTheDocument();
      // The greeting still shows.
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    },
  );
});
