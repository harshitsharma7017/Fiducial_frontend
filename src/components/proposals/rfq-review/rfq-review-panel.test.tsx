import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsurersRfqPanel } from '@/components/proposals/rfq/insurers-rfq-panel';
import {
  CASE_ID,
  approvedRfqState,
  caseRecord,
  insurer,
  json,
  urlOf,
} from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import {
  FIRE_GROUPS,
  NO_RFQ_EDITS,
  OTHER_SECTIONS,
  OTHER_SECTION_LABELS,
  RISK_DETAIL_FIELDS,
  type RfqState,
  type Role,
} from '@/shared';
import { RfqReviewPanel } from './rfq-review-panel';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { name: 'Asha Rao', roles: roles.current } }),
}));

const LOCATION_ID = 'c'.repeat(24);
const record = caseRecord({
  dueDate: '2026-11-20',
  policyStart: '2026-12-01',
  notes: 'Quote with and without terrorism.',
  claims: [],
  locations: [
    {
      locationId: LOCATION_ID,
      location: {
        name: 'Plant 1',
        address: {
          line1: 'Plot 4',
          line2: null,
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411019',
        },
        district: 'Pune',
        eqZone: 3,
        occupancy: { tacCode: '1001', description: 'Textile mills' },
      },
      buildings: [],
      buildingsTotal: '0',
      fire: [],
      fireTotal: '5000000',
      hypothecation: 'Bank of Baroda',
      openStock: null,
      risk: Object.fromEntries(
        RISK_DETAIL_FIELDS.map((field) => [field.key, `${field.label} answer`]),
      ),
    },
  ],
});

function draftState(overrides: Partial<RfqState> = {}): RfqState {
  return approvedRfqState({
    current: { version: 1, status: 'DRAFT', stale: false },
    sendable: false,
    blocked: 'RFQ v1 is draft: it must be approved before it is sent.',
    versions: [
      {
        ...approvedRfqState().versions[0]!,
        status: 'DRAFT',
        events: approvedRfqState().versions[0]!.events.slice(0, 1),
      },
    ],
    ...overrides,
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderPanel(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

describe('RfqReviewPanel', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('R-1, R-2: previews the RFQ from the case and saves the edits made in place', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    let saved: unknown;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/rfq/edits')) {
        saved = JSON.parse(init?.body as string);
        return Promise.resolve(
          json(
            draftState({
              edits: saved as RfqState['edits'],
              current: { version: 1, status: 'DRAFT', stale: true },
            }),
          ),
        );
      }
      if (url.endsWith(`/proposals/${CASE_ID}/rfq/versions`))
        return Promise.resolve(json(draftState()));
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel(<RfqReviewPanel record={record} />);
    const heading = await screen.findByLabelText('RFQ heading');
    expect(heading).toHaveValue('RFQ FOR NEW BUSINESS 2026-27');
    // From the Data Sheet, nothing retyped: hypothecation, notes, risk details.
    expect(screen.getByText('Hypothecation (Plant 1): Bank of Baroda')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes for the insurers')).toHaveValue(
      'Quote with and without terrorism.',
    );
    const cell = screen.getByLabelText('Fire fighting arrangement, Plant 1');
    expect(cell).toHaveValue('Fire fighting arrangement answer');

    await user.clear(cell);
    await user.type(cell, 'Hydrants and sprinklers');
    expect(
      screen.getByRole('button', {
        name: 'Use the Data Sheet’s Fire fighting arrangement, Plant 1',
      }),
    ).toBeInTheDocument();
    // A new version waits for the edits to be saved.
    expect(screen.getByRole('button', { name: 'Generate v2' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save edits' }));
    await waitFor(() =>
      expect(saved).toEqual({
        ...NO_RFQ_EDITS,
        risk: [{ locationId: LOCATION_ID, key: 'fireFighting', value: 'Hydrants and sprinklers' }],
      }),
    );
    expect(await screen.findByText('Out of date')).toBeInTheDocument();
  });

  it('R-5: an approver approves or returns the submitted version with comments', async () => {
    roles.current = ['MANAGER'];
    let returned: unknown;
    const submitted = draftState({ current: { version: 1, status: 'SUBMITTED', stale: false } });
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/rfq/versions/1/return')) {
        returned = JSON.parse(init?.body as string);
        return Promise.resolve(
          json(
            draftState({
              current: { version: 1, status: 'RETURNED', stale: false },
              blocked: 'RFQ v1 is returned: it must be approved before it is sent.',
              versions: [
                {
                  ...submitted.versions[0]!,
                  status: 'RETURNED',
                  events: [
                    ...submitted.versions[0]!.events,
                    {
                      action: 'RETURNED',
                      at: '2026-10-08T05:00:00.000Z',
                      by: 'Ravi Kumar',
                      comment: 'Add hydrant details',
                    },
                  ],
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith(`/proposals/${CASE_ID}/rfq/versions`))
        return Promise.resolve(json(submitted));
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel(<RfqReviewPanel record={record} />);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    // An approver does not edit the RFQ.
    expect(screen.queryByLabelText('RFQ heading')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Return' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Return' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Comments'), 'Add hydrant details');
    await user.click(confirm);
    await waitFor(() => expect(returned).toEqual({ comment: 'Add hydrant details' }));
    expect(await screen.findByText('“Add hydrant details”')).toBeInTheDocument();
  });

  it('B1, B5: the RFQ preview shows Option 2 and omits Not-required sections with no aggregate line', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    const withSections = caseRecord({
      ...record,
      fire: {
        ...caseRecord().fire,
        proposed1: '5000000',
        // B1: a Fire Option 2 total is shown in the preview.
        proposed2: '6000000',
        groups: FIRE_GROUPS.map((group) => ({
          group,
          existing: null,
          proposed1: group === 'STOCKS' ? '5000000' : '0',
          proposed2: group === 'STOCKS' ? '6000000' : null,
        })),
      },
      sections: OTHER_SECTIONS.map((code) => ({
        code,
        name: OTHER_SECTION_LABELS[code],
        // B5: Money is required and appears; every other section is not required and is omitted.
        included: code === 'MONEY',
        existing: null,
        proposed1: code === 'MONEY' ? '500000' : null,
        proposed2: code === 'MONEY' ? '800000' : null,
        lines: {},
        lines2: {},
        existingLines: {},
        basis: null,
        basisAmounts: null,
        covers: [],
        annexure: [],
      })),
    });
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/rfq/versions`))
        return Promise.resolve(json(draftState()));
      return Promise.resolve(json({}, 404));
    });
    renderPanel(<RfqReviewPanel record={withSections} />);
    await screen.findByLabelText('RFQ heading');
    // B4: the premium-details table uses the standard option labels.
    expect(
      screen.getAllByRole('columnheader', { name: 'Proposed – Option 1' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('columnheader', { name: 'Proposed – Option 2' }).length,
    ).toBeGreaterThan(0);
    // B5: the required Money section appears; a Not-required section (Burglary) does not.
    expect(screen.getAllByText('Money').length).toBeGreaterThan(0);
    expect(screen.queryByText('Burglary')).not.toBeInTheDocument();
    // B5: no "Not required:" aggregate line anywhere in the preview.
    expect(screen.queryByText(/Not required:/)).not.toBeInTheDocument();
    // B1: Money's Option 2 (₹8,00,000) and the Fire Option 2 total (₹60,00,000) are shown.
    expect(screen.getAllByText(/₹8,00,000(\.00)?$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹60,00,000(\.00)?$/).length).toBeGreaterThan(0);
  });

  it('R-5: the insurers tab does not send an unapproved RFQ', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/rfq/versions`)) {
        return Promise.resolve(json(draftState()));
      }
      return Promise.resolve(json({}, 404));
    });
    renderPanel(<InsurersRfqPanel record={caseRecord({ insurers: [insurer()] })} />);
    expect(
      await screen.findByText(
        'RFQ v1 is draft: it must be approved before it is sent. Use the RFQ review tab.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Email the RFQ/ })).not.toBeInTheDocument();
  });
});
