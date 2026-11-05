import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { CompanyDetailsImport } from '@/shared';
import { CompanyDetailsExcel } from './company-details-excel';

const CASE = 'c'.repeat(24);
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const result: CompanyDetailsImport = {
  company: {
    natureOfBusiness: 'Software services',
    locations: null,
    contactName: 'Priya Nair',
    contactEmail: null,
    contactPhone: null,
  },
  employeeCount: 1200,
  provided: ['natureOfBusiness', 'contactName', 'employeeCount'],
  issues: [{ field: 'contactEmail', label: 'HR email', message: 'Enter a valid email address' }],
  file: {
    id: 'f'.repeat(24),
    purpose: 'COMPANY_DETAILS',
    fileName: 'Acme company details.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 7000,
    uploadedAt: '2026-11-04T05:00:00.000Z',
    uploadedBy: 'Asha Rao',
  },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('company details from Excel (alteration 3/11/2026)', () => {
  it('imports the workbook, hands the values to the form and reports those not filled', async () => {
    let uploaded = '';
    fetchMock.mockImplementation((input, init) => {
      if (init?.method !== 'POST') {
        return Promise.resolve(json({ items: uploaded ? [result.file] : [] }));
      }
      uploaded = `${init.method} ${urlOf(input)}`;
      return Promise.resolve(json(result));
    });
    const onImported = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CompanyDetailsExcel caseId={CASE} product="GPA" disabled={false} onImported={onImported} />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Company details template' })).toBeInTheDocument();

    const file = new File(['PK'], 'Acme company details.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(
      await screen.findByText(/Filled 3 field\(s\) from Acme company details.xlsx/),
    ).toBeVisible();
    expect(screen.getByText(/HR email: Enter a valid email address \(not filled\)/)).toBeVisible();
    expect(onImported).toHaveBeenCalledWith(result);
    // The workbook is listed as kept with the case.
    expect(await screen.findByRole('link', { name: 'Acme company details.xlsx' })).toBeVisible();
    expect(uploaded).toMatch(
      new RegExp(
        `^POST .*/eb/gpa/cases/${CASE}/company-details\\?fileName=Acme%20company%20details\\.xlsx$`,
      ),
    );
  });

  it('refuses anything but an .xlsx workbook before uploading', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ items: [] })));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CompanyDetailsExcel caseId={CASE} disabled={false} onImported={vi.fn()} />
      </QueryClientProvider>,
    );
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'details.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose the Excel workbook (.xlsx).',
    );
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});
