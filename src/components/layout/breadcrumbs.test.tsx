import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientQuery } from '@/lib/client-query';
import { queryKeys } from '@/lib/query-keys';
import { Breadcrumbs, breadcrumbTrail } from './breadcrumbs';

const navigation = vi.hoisted(() => ({ pathname: '/masters/occupancy' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

function withQuery(ui: ReactNode, queryClient = new QueryClient()) {
  queryClient.setDefaultOptions({ queries: { retry: false } });
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
    expect(trail('/audit')).toEqual(['Admin', 'Audit log']);
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
    expect(trail('/proposals/deleted')).toEqual([
      'Proposals -> /proposals?type=new',
      'Deleted bin',
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

  it('links a detail page back to its list and names the record', () => {
    const path = '/masters/clients/0123456789abcdef01234567';
    expect(breadcrumbTrail(path, new URLSearchParams(), 'Fictional Fabrics')).toEqual([
      { label: 'Masters' },
      { label: 'Clients', href: '/masters/clients' },
      { label: 'Fictional Fabrics' },
    ]);
    expect(breadcrumbTrail(path, new URLSearchParams()).at(-1)).toEqual({ label: 'Details' });
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

  describe('on a client page', () => {
    const ID = '0123456789abcdef01234567';
    const CLIENT = {
      id: ID,
      name: 'Fictional Fabrics Pvt Ltd',
      gstin: null,
      address: { line1: 'a', line2: null, city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      contacts: [],
      natureOfBusiness: 'Weaving',
      occupancy: { tacCode: '2001', description: 'Abrasive Manufacturing' },
      locationCount: 0,
      createdAt: '2026-10-05T09:00:00.000Z',
      updatedAt: '2026-10-05T09:00:00.000Z',
    };

    afterEach(() => {
      navigation.pathname = '/masters/occupancy';
    });

    /** Stands in for the client page, which owns the fetch. */
    function ClientPage() {
      useQuery(clientQuery(ID));
      return null;
    }

    it("names the client and lets the page refetch it without the crumb's options in the way", async () => {
      navigation.pathname = `/masters/clients/${ID}`;
      const fetchMock = vi.fn((_url: string) =>
        Promise.resolve(
          new Response(JSON.stringify(CLIENT), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      const consoleError = vi.spyOn(console, 'error');
      const queryClient = new QueryClient();
      render(
        withQuery(
          <>
            <ClientPage />
            <Breadcrumbs />
          </>,
          queryClient,
        ),
      );

      const nav = await screen.findByRole('navigation', { name: 'Breadcrumb' });
      expect(await within(nav).findByText('Fictional Fabrics Pvt Ltd')).toHaveAttribute(
        'aria-current',
        'page',
      );
      // Saving a client invalidates it; the refetch must still find the page's query function.
      await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(consoleError).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.every(([url]) => url === `/api/proxy/clients/${ID}`)).toBe(true);
    });
  });
});
