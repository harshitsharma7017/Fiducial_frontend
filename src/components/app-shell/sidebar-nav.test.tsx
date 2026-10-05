import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarNav } from './sidebar-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/masters/occupancy' }));

describe('SidebarNav', () => {
  it('hides Users from non-admins and marks planned features as disabled', () => {
    render(<SidebarNav roles={['READ_ONLY']} />);

    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Occupancy' })).toHaveAttribute('aria-current', 'page');
    for (const planned of ['Clients', 'Risks', 'RFQ', 'QCR', 'Placement Slips']) {
      expect(screen.queryByRole('link', { name: new RegExp(planned) })).not.toBeInTheDocument();
      expect(screen.getByText(planned).closest('[aria-disabled="true"]')).not.toBeNull();
    }
    expect(screen.getAllByText('Planned')).toHaveLength(5);
  });

  it('shows Users to admins', () => {
    render(<SidebarNav roles={['ADMIN']} />);
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
  });
});
