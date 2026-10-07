import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIRE_GROUPS,
  OTHER_SECTION_LABELS,
  OTHER_SECTIONS,
  RISK_DETAIL_FIELDS,
  type ProposalRecord,
  type Role,
  type InsurerStatus,
} from '@/shared';
import { ProposalWorkspace } from './proposal-workspace';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { roles: roles.current } }),
}));

const ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const CLIENT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const LOCATION_ID = 'cccccccccccccccccccccccc';
const INSURER_ID = 'dddddddddddddddddddddddd';

function record(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: ID,
    reference: 'PRP-2026-0001',
    type: 'NEW',
    stage: 'DRAFT',
    nextStage: null,
    closedReason: null,
    policyEnd: null,
    existingPolicy: null,
    existingPolicyLookup: null,
    existing: null,
    product: null,
    addonLists: [],
    addons: [],
    client: {
      id: CLIENT_ID,
      name: 'Example Fabrics Pvt Ltd',
      gstin: '27ZZZZZ0001A1Z5',
      city: 'Pune',
      state: 'Maharashtra',
    },
    owner: { id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Asha Rao' },
    dueDate: '2026-10-14',
    policyStart: null,
    locations: [
      {
        locationId: LOCATION_ID,
        location: {
          name: 'Plant 1',
          address: {
            line1: 'Plot 4, MIDC',
            line2: null,
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411019',
          },
          district: 'Pune',
          eqZone: 3,
          occupancy: { tacCode: '1001', description: 'Textile mills' },
        },
        fire: [],
        fireTotal: '0',
        hypothecation: null,
        openStock: null,
        risk: Object.fromEntries(RISK_DETAIL_FIELDS.map((field) => [field.key, null])),
      },
    ],
    fire: {
      groups: FIRE_GROUPS.map((group) => ({
        group,
        existing: null,
        proposed1: '0',
        proposed2: null,
      })),
      existing: null,
      proposed1: '0',
      proposed2: null,
      covers: [],
    },
    sections: OTHER_SECTIONS.map((code) => ({
      code,
      name: OTHER_SECTION_LABELS[code],
      included: false,
      existing: null,
      proposed1: null,
      proposed2: null,
      lines: {},
      lines2: {},
      existingLines: {},
      basis: null,
      basisAmounts: null,
      covers: [],
      annexure: [],
    })),
    suggestedProducts: [],
    gstRatePercent: '18',
    claims: [],
    notes: null,
    missing: ['Enter the Fire sums insured for Plant 1.'],
    locked: false,
    insurers: [],
    activity: [{ at: '2026-10-07T04:00:00.000Z', actor: 'Asha Rao', message: 'Proposal created' }],
    createdAt: '2026-10-07T04:00:00.000Z',
    updatedAt: '2026-10-07T04:00:00.000Z',
    ...overrides,
  };
}

const INSURER = {
  insurerId: INSURER_ID,
  company: 'Example General Insurance',
  branch: 'Fort, Mumbai',
  rfqEmails: ['fire.uw@insurer.example', 'rfq@insurer.example'],
  contacts: [],
  active: true,
  status: 'NOT_SENT' as InsurerStatus,
  sentVia: null as 'APP' | 'OUTSIDE' | null,
  sentAt: null as string | null,
  sentBy: null as string | null,
  dueDate: null as string | null,
  overdue: false,
  reminderCount: 0,
  lastRemindedAt: null,
  response: null,
  lastMail: null,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

/**
 * A small fake of the API: reads return the current proposal; `onWrite` answers PUT and POST with
 * the next proposal, which later reads then return, as the server would.
 */
function serve(initial: ProposalRecord, onWrite?: (url: string, body: unknown) => ProposalRecord) {
  let current = initial;
  fetchMock.mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (init?.method && init.method !== 'GET') {
      if (!onWrite) return Promise.resolve(json({}, 500));
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      current = onWrite(url, body);
      return Promise.resolve(json(current));
    }
    if (url.includes(`/clients/${CLIENT_ID}/locations`)) {
      return Promise.resolve(json({ items: [], nextCursor: null }));
    }
    if (url.endsWith(`/proposals/${ID}`)) return Promise.resolve(json(current));
    return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
  });
}

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ProposalWorkspace id={ID} />
    </QueryClientProvider>,
  );
  // No pause between keystrokes: the Data Sheet has many fields to fill.
  return userEvent.setup({ delay: null });
}

// Filling the Data Sheet takes a while when every test file runs at once.
describe('ProposalWorkspace', { timeout: 20_000 }, () => {
  beforeEach(() => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('lists what the Data Sheet still needs and prices a building as area × rate as you type', async () => {
    serve(record());
    const user = renderWorkspace();
    expect(await screen.findByText('Needed before the RFQ')).toBeInTheDocument();
    expect(screen.getByText('Enter the Fire sums insured for Plant 1.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Item 1a sq ft'), '1000.5');
    await user.type(screen.getByLabelText('Item 1a rate per sq ft'), '2000');
    // Sq ft × rate shows in the item's sum insured, and in the heading's and the running total.
    expect(screen.getByLabelText('Item 1a sum insured')).toHaveAttribute(
      'placeholder',
      '20,01,000',
    );
    const heading = screen.getByRole('row', { name: /^1 All Building/ });

    expect(within(heading).getByText('₹20,01,000.00')).toBeInTheDocument();
    const fireAndBurglary = screen.getByRole('region', { name: 'Fire & Burglary for Plant 1' });
    const total = within(fireAndBurglary).getByRole('row', { name: /Total sum insured/ });
    expect(within(total).getByText('₹20,01,000.00')).toBeInTheDocument();

    // A paise amount stays exact: two buildings of 10.5 sq ft at ₹3 total ₹63, as in Excel.
    await user.clear(screen.getByLabelText('Item 1a sq ft'));
    await user.type(screen.getByLabelText('Item 1a sq ft'), '10.5');
    await user.clear(screen.getByLabelText('Item 1a rate per sq ft'));
    await user.type(screen.getByLabelText('Item 1a rate per sq ft'), '3');
    await user.type(screen.getByLabelText('Item 1b sq ft'), '10.5');
    await user.type(screen.getByLabelText('Item 1b rate per sq ft'), '3');
    expect(screen.getByLabelText('Item 1b sum insured')).toHaveAttribute('placeholder', '32');
    expect(within(total).getByText('₹63.00')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('offers the contents total (all but buildings) as the Burglary sum insured', async () => {
    serve(record());
    const user = renderWorkspace();
    await user.type(await screen.findByLabelText('Item 1a sum insured'), '5000000');
    await user.type(screen.getByLabelText('Item 2 sum insured'), '200000');
    await user.type(screen.getByLabelText('Item 6 sum insured'), '300000');
    await user.click(screen.getByRole('checkbox', { name: 'Burglary' }));
    await user.click(screen.getByRole('button', { name: 'Use contents total ₹5,00,000.00' }));
    expect(screen.getByLabelText('Burglary Proposed 1')).toHaveValue('5,00,000');
  });

  it('opens a renewal with last year’s policy and an Existing column', async () => {
    serve(
      record({
        type: 'EXISTING',
        policyStart: '2026-11-01',
        policyEnd: '2027-10-31',
        existingPolicy: {
          source: 'PolicyDesk',
          fetchedAt: '2026-10-07T04:00:00.000Z',
          insurer: 'Example General, Fort',
          policyNumber: 'EGI/2025/42',
          product: 'BLUS',
          periodStart: '2025-11-01',
          periodEnd: '2026-10-31',
          sections: [
            { code: 'FIRE', sumInsured: '120000000', premium: '96000' },
            { code: 'BURGLARY', sumInsured: '15000000', premium: '4500' },
          ],
          fireLines: [{ group: 'STOCKS', sumInsured: '50000000' }],
          totalSumInsured: '135000000',
          netPremium: '100500',
          gst: '18090',
          totalPremium: '118590',
        },
        existingPolicyLookup: {
          status: 'FOUND',
          message: null,
          checkedAt: '2026-10-07T04:00:00.000Z',
        },
      }),
    );
    renderWorkspace();
    const card = await screen.findByRole('heading', { name: 'Existing policy' });
    expect(card).toBeInTheDocument();
    expect(screen.getByText(/EGI\/2025\/42 with Example General, Fort/)).toBeInTheDocument();
    expect(screen.getByText('Renewal')).toBeInTheDocument();
    const stocks = screen.getByRole('row', { name: /^All types of stock pertaining/ });
    expect(within(stocks).getByText('₹5,00,00,000.00')).toBeInTheDocument();
    const otherSections = screen
      .getByText('Other sections')
      .closest<HTMLElement>('[data-slot=card]')!;
    expect(
      within(otherSections).getByRole('columnheader', { name: 'Existing' }),
    ).toBeInTheDocument();
    const burglary = within(otherSections).getByRole('row', { name: /^Burglary ₹/ });
    expect(within(burglary).getByText('₹1,50,00,000.00')).toBeInTheDocument();
  });

  it('moves a case to its next stage and closes one with a reason', async () => {
    const posted: unknown[] = [];
    serve(record({ stage: 'RFQ_SENT', nextStage: 'QUOTES_RECEIVED', missing: [] }), (url, body) => {
      posted.push(body);
      expect(url).toContain(`/proposals/${ID}/stage`);
      const stage = (body as { stage: 'QUOTES_RECEIVED' | 'CLOSED' }).stage;
      return record({
        stage,
        nextStage: stage === 'CLOSED' ? null : 'QCR',
        closedReason: stage === 'CLOSED' ? 'Lost to another broker' : null,
        locked: stage === 'CLOSED',
        missing: [],
      });
    });
    const user = renderWorkspace();
    await user.click(await screen.findByRole('button', { name: 'Move to Quotes Received' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Move' }));
    expect(await screen.findByRole('button', { name: 'Move to QCR' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close case' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Close case' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Reason'), 'Lost to another broker');
    await user.click(within(dialog).getByRole('button', { name: 'Close case' }));
    expect(await screen.findByText('This case is closed')).toBeInTheDocument();
    expect(posted).toEqual([
      { stage: 'QUOTES_RECEIVED', reason: '' },
      { stage: 'CLOSED', reason: 'Lost to another broker' },
    ]);
  });

  it('D-5: annexure rows add up to the section sum insured, which is saved with them', async () => {
    let sent: unknown;
    serve(record(), (_url, body) => {
      sent = body;
      return record();
    });
    const user = renderWorkspace();
    await user.click(await screen.findByRole('checkbox', { name: 'Plate Glass' }));
    const details = screen.getByRole('region', { name: 'Plate Glass details' });
    expect(within(details).getByText(/No items yet/)).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: 'Add row to Plate Glass' }));
    await user.click(within(details).getByRole('button', { name: 'Add row to Plate Glass' }));
    await user.type(
      within(details).getByLabelText('Plate Glass item 1 Description'),
      'Showroom front',
    );
    await user.type(within(details).getByLabelText('Plate Glass item 1 No of Plate Glass'), '4');
    await user.type(within(details).getByLabelText('Plate Glass item 1 sum insured'), '150000');
    await user.type(within(details).getByLabelText('Plate Glass item 2 Description'), 'Partition');
    await user.type(within(details).getByLabelText('Plate Glass item 2 sum insured'), '50000');
    const total = within(details).getByRole('row', { name: /Total — Plate Glass sum insured/ });
    expect(within(total).getByText('₹2,00,000.00')).toBeInTheDocument();
    // The total flows into the section's Proposed 1.
    expect(screen.getByLabelText('Plate Glass Proposed 1')).toHaveTextContent('₹2,00,000.00');

    // FLOP: the annual gross profit is its sum insured.
    await user.click(screen.getByRole('checkbox', { name: 'Fire Loss of Profit' }));
    await user.type(screen.getByLabelText('1. Annual Gross Profit'), '8000000');
    expect(screen.getByLabelText('Fire Loss of Profit Proposed 1')).toHaveTextContent(
      '₹80,00,000.00',
    );

    // Removing a row updates the total.
    await user.click(within(details).getByRole('button', { name: 'Remove Plate Glass item 2' }));
    expect(screen.getByLabelText('Plate Glass Proposed 1')).toHaveTextContent('₹1,50,000.00');

    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));
    await waitFor(() => expect(sent).toBeDefined());
    const sections = (sent as { sections: Array<Record<string, unknown>> }).sections;
    expect(sections.find((s) => s.code === 'PLATE_GLASS')).toMatchObject({
      included: true,
      proposed1: '150000',
      annexure: [
        {
          description: 'Showroom front',
          quantity: '4',
          dimensions: null,
          makeModel: null,
          serialNo: null,
          year: null,
          sumInsured: '150000',
        },
      ],
    });
    expect(sections.find((s) => s.code === 'FIRE_LOSS_OF_PROFIT')).toMatchObject({
      proposed1: '8000000',
      lines: { annualGrossProfit: '8000000' },
    });
  });

  it('D-4: each section shows the Data Sheet’s lines and can be marked not required', async () => {
    serve(record());
    const user = renderWorkspace();
    await user.click(await screen.findByRole('checkbox', { name: 'Money' }));
    const money = screen.getByRole('region', { name: 'Money details' });
    for (const label of [
      '1. Cash in safe / counter',
      '2. Cash in transit - Single carrying limit',
      '3. Cash in transit - Annual carrying limit',
    ]) {
      expect(within(money).getByLabelText(label)).toBeInTheDocument();
    }
    // Money's sum insured stays as typed.
    expect(screen.getByLabelText('Money Proposed 1')).toHaveValue('');
    await user.click(screen.getByRole('checkbox', { name: 'Money' }));
    expect(screen.queryByRole('region', { name: 'Money details' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /^Money/ })).getByText('Not required'),
    ).toBeInTheDocument();
  });

  it('saves only the Fire items that were filled and shows the saved figures', async () => {
    let sent: unknown;
    serve(record(), (url, body) => {
      sent = body;
      expect(url).toContain(`/proposals/${ID}/data-sheet`);
      return record({
        missing: [],
        stage: 'DATA_SHEET',
        updatedAt: '2026-10-07T05:00:00.000Z',
        fire: {
          groups: FIRE_GROUPS.map((group) => ({
            group,
            existing: null,
            proposed1: group === 'STOCKS' ? '5000000' : '0',
            proposed2: null,
          })),
          existing: null,
          proposed1: '5000000',
          proposed2: null,
          covers: [],
        },
      });
    });
    const user = renderWorkspace();
    await user.type(await screen.findByLabelText('Item 6 sum insured'), '50,00,000');
    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));

    await waitFor(() => expect(sent).toBeDefined());
    const body = sent as { locations: { fire: { key: string; amount: string | null }[] }[] };
    expect(body.locations[0]?.fire).toEqual([
      { key: 'STOCKS', sqFt: null, ratePerSqFt: null, amount: '5000000' },
    ]);
    expect(await screen.findByText('Ready for the RFQ')).toBeInTheDocument();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('keeps the RFQ download and send closed until the Data Sheet is complete', async () => {
    serve(record({ insurers: [INSURER] }));
    const user = renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: 'Insurers and RFQ' }));
    expect(screen.getByRole('button', { name: 'Download RFQ (Excel)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Email the RFQ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sent outside the app' })).toBeDisabled();
    expect(screen.getByText(/Complete the Data Sheet first: 1 item is still needed/)).toBeVisible();
  });

  it('marks the RFQ as sent to the chosen insurers after confirming', async () => {
    let sent: unknown;
    const complete = record({ missing: [], stage: 'DATA_SHEET', insurers: [INSURER] });
    serve(complete, (url, body) => {
      sent = body;
      expect(url).toContain(`/proposals/${ID}/rfq/sent`);
      return {
        ...complete,
        stage: 'RFQ_SENT',
        locked: true,
        insurers: [
          { ...INSURER, status: 'SENT', sentAt: '2026-10-07T06:00:00.000Z', sentBy: 'Asha Rao' },
        ],
      };
    });
    const user = renderWorkspace();
    // A complete Data Sheet opens on the RFQ tab.
    expect(
      await screen.findByText('fire.uw@insurer.example, rfq@insurer.example', { selector: 'span' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sent outside the app' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sent outside the app?' });
    expect(within(dialog).getByText('The Data Sheet will lock')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Quotes due by')).not.toHaveValue('');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as sent' }));

    await waitFor(() =>
      expect(sent).toEqual({
        insurerIds: [INSURER_ID],
        dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as unknown,
      }),
    );
    expect(await screen.findByText('Sent')).toBeInTheDocument();
    expect(screen.getByText(/Asha Rao$/, { selector: 'dd' })).toBeInTheDocument();
  });

  it('shows a sent proposal’s Data Sheet locked', async () => {
    serve(
      record({
        missing: [],
        stage: 'RFQ_SENT',
        locked: true,
        insurers: [
          { ...INSURER, status: 'SENT', sentAt: '2026-10-07T06:00:00.000Z', sentBy: 'Asha Rao' },
        ],
      }),
    );
    const user = renderWorkspace();
    await user.click(await screen.findByRole('tab', { name: 'Data Sheet' }));
    expect(screen.getByText('The Data Sheet is locked')).toBeInTheDocument();
    expect(screen.getByLabelText('Item 1a sq ft')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).not.toBeInTheDocument();
  });

  it('is read-only for a role that cannot edit proposals', async () => {
    roles.current = ['READ_ONLY'];
    serve(record());
    renderWorkspace();
    expect(await screen.findByLabelText('Item 1a sq ft')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add locations' })).not.toBeInTheDocument();
  });
});
