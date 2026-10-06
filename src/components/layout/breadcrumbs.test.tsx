import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumbs, breadcrumbTrail } from './breadcrumbs';

vi.mock('next/navigation', () => ({
  usePathname: () => '/masters/occupancy',
  useSearchParams: () => new URLSearchParams(),
}));

function withQuery(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

const trail = (path: string, search = '') =>
  breadcrumbTrail(path, new URLSearchParams(search)).map(({ label, href }) =>
    href ? `${label} -> ${href}` : label,
  );

describe('breadcrumbTrail', () => {
  it('follows the route', () => {
    expect(trail('/dashboard')).toEqual(['Dashboard']);
    expect(trail('/masters/occupancy')).toEqual(['Masters', 'Occupancy']);
    expect(trail('/rating/fire')).toEqual(['Workflow', 'Fire rate check']);
    expect(trail('/users')).toEqual(['Admin', 'Users']);
    expect(trail('/settings')).toEqual(['Admin', 'Settings']);
    expect(trail('/profile')).toEqual(['Profile']);
  });

  it('names the proposal list and the placeholder by type', () => {
    expect(trail('/proposals')).toEqual(['Proposals', 'New proposals']);
    expect(trail('/proposals', 'type=existing')).toEqual(['Proposals', 'Existing proposals']);
    expect(trail('/proposals/new', 'type=existing')).toEqual([
      'Proposals -> /proposals?type=existing',
      'Start renewal',
    ]);
  });

  it('uses the proposal client name as the last crumb on a detail route', () => {
    const crumbs = breadcrumbTrail(
      '/proposals/abc',
      new URLSearchParams(),
      'Kesar Valley Spices LLP',
    );
    expect(crumbs.map((c) => c.label)).toEqual(['Proposals', 'Kesar Valley Spices LLP']);
    expect(crumbs[0]?.href).toBe('/proposals?type=new');
  });

  it('falls back to "Proposal" when the detail is not loaded yet', () => {
    expect(trail('/proposals/abc')).toEqual(['Proposals -> /proposals?type=new', 'Proposal']);
  });

  it('is empty for unknown routes', () => {
    expect(trail('/somewhere')).toEqual([]);
  });
});

describe('Breadcrumbs', () => {
  it('renders a Breadcrumb landmark with the current page marked', () => {
    render(withQuery(<Breadcrumbs />));
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Occupancy')).toHaveAttribute('aria-current', 'page');
    // Group names have no page, so they are text, not links.
    expect(within(nav).getByText('Masters').closest('a')).toBeNull();
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2);
  });
});
