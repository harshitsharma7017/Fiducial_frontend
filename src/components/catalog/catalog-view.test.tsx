import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogImportResult } from '@/components/imports/catalog-import-result';
import type { CatalogImportReport, Role } from '@/shared';
import { CatalogTable } from './catalog-view';

const roles = vi.hoisted(() => ({ current: ['ADMIN'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { roles: roles.current } }),
}));

const AT = '2026-10-07T04:00:00.000Z';
const PRODUCTS = [
  {
    id: 'a'.repeat(24),
    code: 'BSUS',
    name: 'Bharat Sookshma',
    aboveSi: null,
    upToSi: '50000000',
    order: 1,
    active: true,
    notes: null,
    addonLists: [],
    updatedAt: AT,
  },
  {
    id: 'b'.repeat(24),
    code: 'BLUS',
    name: 'Bharat Laghu',
    aboveSi: '50000000',
    upToSi: '500000000',
    order: 2,
    active: true,
    notes: null,
    addonLists: [],
    updatedAt: AT,
  },
];
const section = (n: string, code: string, name: string, order: number) => ({
  id: n.repeat(24),
  code,
  name,
  order,
  active: true,
  fields: [],
  addons: [],
  updatedAt: AT,
});
const SECTIONS = [
  section('1', 'FIRE', 'Fire', 1),
  section('2', 'BURGLARY', 'Burglary', 2),
  section('3', 'MONEY', 'Money', 3),
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const urlOf = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();

function renderTable(master: 'products' | 'sections') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CatalogTable master={master} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('CatalogTable', () => {
  beforeEach(() => {
    roles.current = ['ADMIN'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows ranges in words and checks an edit before sending it', async () => {
    let sent: unknown;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'PUT') {
        sent = JSON.parse(init.body as string);
        return Promise.resolve(json({ ...PRODUCTS[0], ...(sent as object) }));
      }
      return Promise.resolve(json({ items: PRODUCTS }));
    });
    const user = renderTable('products');
    expect(await screen.findByText('Up to ₹5 Cr')).toBeInTheDocument();
    expect(screen.getByText('Above ₹5 Cr and up to ₹50 Cr')).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /BSUS/ });
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const upTo = within(dialog).getByLabelText('Sum insured up to (Rs) (optional)');
    await user.clear(upTo);
    await user.type(upTo, '100');
    const above = within(dialog).getByLabelText('Sum insured above (Rs) (optional)');
    await user.type(above, '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText('The upper limit must be above the lower limit'),
    ).toBeInTheDocument();
    expect(sent).toBeUndefined();

    await user.clear(above);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(sent).toEqual({
        code: 'BSUS',
        name: 'Bharat Sookshma',
        aboveSi: null,
        upToSi: '100',
        order: 1,
        active: true,
        notes: null,
        addonLists: [],
      }),
    );
    expect(urlOf(fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')![0])).toBe(
      `/api/proxy/catalog/products/${'a'.repeat(24)}`,
    );
  });

  it('keeps Fire first and moves the other sections', async () => {
    let order: unknown;
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'PUT') {
        order = JSON.parse(init.body as string);
        return Promise.resolve(json({ items: SECTIONS }));
      }
      return Promise.resolve(json({ items: SECTIONS }));
    });
    const user = renderTable('sections');
    const fire = await screen.findByRole('row', { name: /^1.*Fire/ });
    expect(within(fire).getByRole('button', { name: 'Move down' })).toBeDisabled();
    const burglary = screen.getByRole('row', { name: /Burglary/ });
    expect(within(burglary).getByRole('button', { name: 'Move up' })).toBeDisabled();
    await user.click(within(burglary).getByRole('button', { name: 'Move down' }));
    await waitFor(() => expect(order).toEqual({ ids: ['1', '3', '2'].map((n) => n.repeat(24)) }));
    // Sections are fixed: there is no Add.
    expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument();
  });

  it('is read-only without masters.manage', async () => {
    roles.current = ['READ_ONLY'];
    fetchMock.mockResolvedValue(json({ items: PRODUCTS }));
    renderTable('products');
    await screen.findByText('Bharat Laghu');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument();
  });
});

describe('CatalogImportResult', () => {
  const sheet = (
    master: string,
    issues: CatalogImportReport['sheets'][number]['issues'],
    present = true,
  ) => ({
    master: master as CatalogImportReport['sheets'][number]['master'],
    label: master,
    sheetName: master,
    present,
    rows: present ? 3 : 0,
    currentRows: 1,
    issues,
  });

  it('lists the problems and replaces only when every sheet passes', async () => {
    const onSave = vi.fn();
    const report: CatalogImportReport = {
      dryRun: true,
      imported: false,
      fileErrors: [],
      sheets: [
        sheet('sections', [{ row: 4, column: 'Active', message: 'Fire cannot be switched off' }]),
        sheet('notes', [], false),
      ],
    };
    const { rerender } = render(
      <CatalogImportResult report={report} onSave={onSave} saving={false} />,
    );
    expect(screen.getByText('Fire cannot be switched off')).toBeInTheDocument();
    expect(screen.getByText('Not in file: unchanged')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace this master' })).toBeDisabled();

    rerender(
      <CatalogImportResult
        report={{ ...report, sheets: [sheet('sections', []), sheet('notes', [])] }}
        onSave={onSave}
        saving={false}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Replace these 2 masters' }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
