import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleProposals } from '@/lib/data/proposals';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { DocumentsSection } from './documents-section';

const session = vi.hoisted(() => ({ roles: ['ADMIN'] as Role[] }));

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: { roles: session.roles, roleNames: [], permissions: legacyPermissionsOf(session.roles) },
  }),
}));

const proposal = buildSampleProposals(new Date('2026-10-05T06:30:00.000Z'))[0];

describe('DocumentsSection', () => {
  it('shows exporters a disabled download for each document', () => {
    session.roles = ['MANAGER'];
    if (!proposal) throw new Error('no sample proposal');
    render(<DocumentsSection proposal={proposal} />);
    const downloads = screen.getAllByRole('button', { name: /^Download .* \(coming soon\)$/ });
    expect(downloads).toHaveLength(4);
    for (const button of downloads) expect(button).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Download Data Sheet (coming soon)' }),
    ).toBeDisabled();
  });

  it('shows Read-only users the statuses without downloads', () => {
    session.roles = ['READ_ONLY'];
    if (!proposal) throw new Error('no sample proposal');
    render(<DocumentsSection proposal={proposal} />);
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
    expect(screen.getByText('Data Sheet')).toBeInTheDocument();
    expect(screen.getByText('Placement Slip')).toBeInTheDocument();
  });
});
