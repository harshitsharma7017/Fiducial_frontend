import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportReport, Role } from '@/shared';
import { ImportView } from './import-view';

const PREVIEW: ImportReport = {
  entity: 'clients',
  dryRun: true,
  rowsRead: 3,
  validRows: 2,
  invalidRows: 1,
  imported: false,
  createdCount: 0,
  fileErrors: [],
  rows: [
    {
      row: 2,
      valid: true,
      label: 'Sahyadri Textiles Pvt Ltd',
      values: {
        name: 'Sahyadri Textiles Pvt Ltd',
        gstin: '27ZZZZZ0001Z1ZP',
        city: 'Bhiwandi',
        state: 'Maharashtra',
        occupancyCode: '2189',
      },
      issues: [],
    },
    {
      row: 3,
      valid: false,
      label: null,
      values: {
        name: 'Sharma Textile Mills Pvt Ltd',
        gstin: '07AABCS1234A1Z5',
        city: 'New Delhi',
        state: 'Delhi',
        occupancyCode: '2189',
      },
      issues: [
        {
          column: 'GSTIN',
          message: 'This GSTIN fails its check digit. Check it for a typing mistake.',
        },
      ],
    },
    {
      row: 4,
      valid: true,
      label: 'Nilgiri Pharma Labs Ltd',
      values: {
        name: 'Nilgiri Pharma Labs Ltd',
        gstin: '33ZZZZZ0002Z1ZV',
        city: 'Chennai',
        state: 'Tamil Nadu',
        occupancyCode: '2044',
      },
      issues: [],
    },
  ],
};

function user(roles: Role[]) {
  return {
    id: '0123456789abcdef01234567',
    email: 'asha@example.com',
    name: 'Asha',
    roles,
    active: true,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function renderView(roles: Role[] = ['ADMIN'], serverSearch = '?type=clients') {
  // The record type lives in the URL; start each test from its own.
  window.history.replaceState(null, '', `/masters/import${serverSearch}`);
  fetchMock.mockImplementation((input) => {
    const url = input;
    if (url.endsWith('/auth/me')) return Promise.resolve(json(user(roles)));
    if (url.includes('dryRun=true')) return Promise.resolve(json(PREVIEW));
    return Promise.resolve(json({ ...PREVIEW, dryRun: false, imported: true, createdCount: 1 }));
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ImportView serverSearch={serverSearch} />
    </QueryClientProvider>,
  );
  const fileInput = () => view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  return { user: userEvent.setup(), fileInput };
}

const workbook = (name = 'clients-filled.xlsx') => new File(['PK fake'], name);
const importCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes('/imports/'));

describe('ImportView', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('offers each record type the user may import, with its template', async () => {
    const { user: actor } = renderView(['ACCOUNT_MANAGER']);
    const type = await screen.findByLabelText('Record type');
    // Insurers are master data: Admin only.
    expect(
      within(type)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Clients', 'Risk locations']);
    expect(screen.getByRole('link', { name: 'Clients template' })).toHaveAttribute(
      'href',
      '/api/proxy/imports/clients/template',
    );
    await actor.selectOptions(type, 'client-locations');
    expect(screen.getByRole('link', { name: 'Risk locations template' })).toHaveAttribute(
      'href',
      '/api/proxy/imports/client-locations/template',
    );
  });

  it('opens the file picker from anywhere in the drop zone, by mouse or keyboard', async () => {
    const { user: actor } = renderView();
    await screen.findByLabelText('Record type');
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const zone = screen.getByRole('button', { name: 'Choose an Excel workbook (.xlsx) to import' });
    await actor.click(within(zone).getByText('Excel workbook, up to 5 MB.'));
    expect(pick).toHaveBeenCalledTimes(1);
    zone.focus();
    await actor.keyboard('{Enter}');
    await actor.keyboard(' ');
    expect(pick).toHaveBeenCalledTimes(3);
  });

  it('says why nothing can be imported when no row is valid', async () => {
    const { user: actor, fileInput } = renderView();
    fetchMock.mockImplementation((input) => {
      if (input.endsWith('/auth/me')) return Promise.resolve(json(user(['ADMIN'])));
      return Promise.resolve(
        json({
          ...PREVIEW,
          validRows: 0,
          invalidRows: 1,
          rowsRead: 1,
          rows: [PREVIEW.rows[1]],
        }),
      );
    });
    await screen.findByLabelText('Record type');
    await actor.upload(fileInput(), workbook());
    await actor.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByText(
        'No row can be imported yet. Fix the problems in the file and preview it again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 clients' })).toBeDisabled();
  });

  it('refuses a file that is not .xlsx before sending it', async () => {
    const { fileInput } = renderView();
    await screen.findByLabelText('Record type');
    // A dropped file skips the picker's .xlsx filter, so the check must not rely on it.
    const actor = userEvent.setup({ applyAccept: false });
    await actor.upload(fileInput(), workbook('clients.csv'));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an Excel workbook (.xlsx)');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  });

  it('previews every row and imports only the ticked valid ones', async () => {
    const { user: actor, fileInput } = renderView();
    await screen.findByLabelText('Record type');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    await actor.upload(fileInput(), workbook());
    expect(screen.getByText('clients-filled.xlsx')).toBeInTheDocument();
    expect(importCalls()).toHaveLength(0);

    await actor.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByText('Preview — 2 valid, 1 with errors (3 rows)'),
    ).toBeInTheDocument();
    const invalid = screen.getByRole('checkbox', { name: 'Row 3 has problems' });
    expect(invalid).toBeDisabled();
    expect(screen.getByText(/fails its check digit/)).toBeInTheDocument();
    // Valid rows start ticked; leave row 4 out.
    expect(screen.getByRole('checkbox', { name: 'Import row 2' })).toBeChecked();
    await actor.click(screen.getByRole('checkbox', { name: 'Import row 4' }));

    await actor.click(screen.getByRole('button', { name: 'Import 1 clients' }));
    expect(await screen.findByText('1 client imported')).toBeInTheDocument();
    // Row 3 had problems and row 4 was unticked.
    expect(screen.getByText(/2 rows were left out/)).toBeInTheDocument();
    const [url] = importCalls().at(-1)!;
    expect(url).toBe('/api/proxy/imports/clients?dryRun=false&rows=2');
    expect(screen.getByRole('link', { name: 'View clients' })).toHaveAttribute(
      'href',
      '/masters/clients',
    );

    await actor.click(screen.getByRole('button', { name: 'Import another file' }));
    await waitFor(() => expect(screen.queryByText('1 client imported')).not.toBeInTheDocument());
    expect(screen.getByText(/Drop the filled-in/)).toBeInTheDocument();
  });

  it('uploads the IIB master as a draft version and activates it', async () => {
    const stats = (rows: number) => ({
      rowsRead: rows,
      recordsImported: rows,
      rowsSkipped: 0,
      warningCount: 2,
      errorCount: 0,
    });
    const version = (id: string, type: 'OCCUPANCY' | 'PINCODE', status: 'DRAFT' | 'ACTIVE') => ({
      id,
      type,
      status,
      sourceFileName: 'IIB_Code_Master.xlsx',
      sourceSha256: 'abc',
      importedBy: null,
      importedAt: '2026-10-06T10:00:00.000Z',
      effectiveFrom: status === 'ACTIVE' ? '2026-10-06T10:00:00.000Z' : null,
      effectiveTo: null,
      activatedBy: null,
      activatedAt: null,
      stats: stats(type === 'OCCUPANCY' ? 299 : 20606),
    });
    const result = {
      dryRun: true,
      sourceFileName: 'IIB_Code_Master.xlsx',
      fileError: null,
      occupancy: stats(299),
      pincode: stats(20606),
      reportText: 'Occupancy sheet "IIB Code"\n  Rows read: 299',
      alreadyImported: false,
      versions: [] as unknown[],
    };
    const { user: actor, fileInput } = renderView(['ADMIN'], '?type=masters');
    fetchMock.mockImplementation((input) => {
      if (input.endsWith('/auth/me')) return Promise.resolve(json(user(['ADMIN'])));
      if (input.includes('masters/import?dryRun=true')) return Promise.resolve(json(result));
      if (input.includes('masters/import?dryRun=false')) {
        return Promise.resolve(
          json({
            ...result,
            dryRun: false,
            versions: [
              version('a'.repeat(24), 'OCCUPANCY', 'DRAFT'),
              version('b'.repeat(24), 'PINCODE', 'DRAFT'),
            ],
          }),
        );
      }
      const id = /versions\/([a-f0-9]{24})\/activate/.exec(input)?.[1] ?? '';
      return Promise.resolve(
        json(version(id, id.startsWith('a') ? 'OCCUPANCY' : 'PINCODE', 'ACTIVE')),
      );
    });

    expect(await screen.findByRole('link', { name: 'IIB master template' })).toHaveAttribute(
      'href',
      '/api/proxy/masters/workbook?template=true',
    );
    expect(screen.getByRole('link', { name: 'download the current master' })).toHaveAttribute(
      'href',
      '/api/proxy/masters/workbook',
    );
    await actor.upload(fileInput(), workbook('IIB_Code_Master.xlsx'));
    await actor.click(screen.getByRole('button', { name: 'Preview' }));
    const sheets = await screen.findByRole('table');
    expect(
      within(sheets).getByRole('rowheader', { name: 'Pincodes' }).closest('tr'),
    ).toHaveTextContent('20,606');

    await actor.click(screen.getByRole('button', { name: 'Save as new version' }));
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Activate' }));
    expect(await screen.findByText('This version is active')).toBeInTheDocument();
    const activations = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes('/activate'));
    expect(activations).toEqual([
      `/api/proxy/masters/versions/${'a'.repeat(24)}/activate`,
      `/api/proxy/masters/versions/${'b'.repeat(24)}/activate`,
    ]);
    const [importUrl] = fetchMock.mock.calls.find(([url]) => url.includes('dryRun=false'))!;
    expect(importUrl).toBe('/api/proxy/masters/import?dryRun=false&fileName=IIB_Code_Master.xlsx');
  });
});
