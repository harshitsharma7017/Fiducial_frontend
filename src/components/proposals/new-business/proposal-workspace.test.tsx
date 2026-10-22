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
import { approvedRfqState } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
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
    deleted: null,
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
        buildings: [],
        buildingsTotal: '0',
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
    activity: [
      {
        at: '2026-10-07T04:00:00.000Z',
        actor: 'Asha Rao',
        actorRole: 'Relationship Manager',
        message: 'Proposal created',
      },
    ],
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
const CR = 10_000_000;
const item = { updatedAt: '2026-10-07T04:00:00.000Z' };
const PRODUCTS = [
  ['BSUS', 'Bharat Sookshma Udyam Suraksha (BSUS)', null, String(5 * CR)],
  ['BLUS', 'Bharat Laghu Udyam Suraksha (BLUS)', String(5 * CR), String(50 * CR)],
  ['SFSP', 'Standard Fire & Special Perils Policy (SFSP)', String(50 * CR), null],
  ['PAR', 'Property All Risk (PAR)', String(5 * CR), null],
].map(([code, name, aboveSi, upToSi], index) => ({
  ...item,
  id: String(index + 1).padStart(24, '0'),
  code,
  name,
  aboveSi,
  upToSi,
  order: index + 1,
  active: true,
  notes: null,
  addonLists: [],
}));
const ADDONS = [
  ['PAR', 'Debris removal'],
  ['PAR', 'Waiver of recourse'],
  ['SFSP', 'Spontaneous combustion'],
].map(([list, name], index) => ({
  ...item,
  id: String(index + 11).padStart(24, '0'),
  list,
  seq: index + 1,
  name,
  kind: null,
  limit: null,
  active: true,
}));

function serve(initial: ProposalRecord, onWrite?: (url: string, body: unknown) => ProposalRecord) {
  let current = initial;
  let favourites: unknown[] = [];
  fetchMock.mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes('/addon-favourites')) {
      if (init?.method === 'PUT' && typeof init.body === 'string') {
        favourites = (JSON.parse(init.body) as { items: unknown[] }).items;
      }
      return Promise.resolve(json({ items: favourites, updatedAt: null }));
    }
    if (url.endsWith('/catalog/products')) return Promise.resolve(json({ items: PRODUCTS }));
    if (url.endsWith('/catalog/addons')) return Promise.resolve(json({ items: ADDONS }));
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
    if (url.endsWith(`/proposals/${ID}/rfq/versions`)) {
      return Promise.resolve(json(approvedRfqState()));
    }
    return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
  });
}

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The RFQ's latest version is approved (R-5), so it can be sent.
  queryClient.setQueryData(['proposals', 'rfq', ID], approvedRfqState());
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

  it('C-3 / D3 (Option A): Burglary is the Fire contents = Total Fire − buildings', async () => {
    serve(record());
    const user = renderWorkspace();
    // Item 1a is the Compound wall — a Building-line civil-structure item, NOT a building. Under
    // D3 Option A it stays in the Burglary base (only dynamic buildings are deducted, and there are
    // none here). Contents = compound wall 5,000,000 + FFF 200,000 + stocks 300,000 = 5,500,000.
    await user.type(await screen.findByLabelText('Item 1a sum insured'), '5000000');
    await user.type(screen.getByLabelText('Item 2 sum insured'), '200000');
    await user.type(screen.getByLabelText('Item 6 sum insured'), '300000');
    await user.click(screen.getByRole('checkbox', { name: 'Burglary' }));
    // A new Burglary starts on 100%: its sum insured is the contents, kept up to date.
    expect(screen.getByLabelText('Burglary Proposed – Option 1')).toHaveTextContent(
      '₹55,00,000.00',
    );
    await user.selectOptions(
      screen.getByLabelText('Burglary basis'),
      '1st loss basis 25% of sum insured',
    );
    // 5,500,000 × 25% = 1,375,000.
    expect(
      screen.getByText(/On this basis: Proposed – Option 1 ₹13,75,000\.00/),
    ).toBeInTheDocument();
    // Typing "0" appends to Item 6 (stocks): 300000 → 3000000. Contents = 5,000,000 + 200,000 +
    // 3,000,000 = 8,200,000.
    await user.type(screen.getByLabelText('Item 6 sum insured'), '0');
    expect(screen.getByLabelText('Burglary Proposed – Option 1')).toHaveTextContent(
      '₹82,00,000.00',
    );
    // 8,200,000 × 25% = 2,050,000.
    expect(
      screen.getByText(/On this basis: Proposed – Option 1 ₹20,50,000\.00/),
    ).toBeInTheDocument();
  });

  it('C-1, C-4: follows the suggested product, asks why on an override, and picks its add-ons', async () => {
    let sent: { product: unknown; addons: unknown } | undefined;
    serve(record(), (_url, body) => {
      sent = body as typeof sent;
      return record();
    });
    const user = renderWorkspace();
    await user.type(await screen.findByLabelText('Item 6 sum insured'), String(20 * CR));
    const product = screen.getByLabelText('Policy');
    expect(
      await within(product).findByRole('option', { name: 'Follow the suggestion (BLUS)' }),
    ).toBeInTheDocument();

    // PAR is offered above 5 Cr: its own add-ons only, favourites kept for the client.
    await user.selectOptions(product, 'PAR');
    const list = await screen.findByRole('list', { name: 'PAR add-on covers' });
    expect(within(list).queryByText('Spontaneous combustion')).not.toBeInTheDocument();
    await user.click(within(list).getByLabelText('Debris removal'));
    await user.click(
      within(list).getByRole('button', { name: 'Favourite for this client: Debris removal' }),
    );
    await waitFor(() =>
      expect(
        within(list).getByRole('button', { name: 'Favourite for this client: Debris removal' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Debris removal');
    await user.type(screen.getByLabelText('Search add-on covers'), 'waiver');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);

    // BSUS at 20 Cr is outside its range: the reason is asked for, and PAR's add-ons go.
    await user.selectOptions(product, 'BSUS');
    expect(screen.getByText(/so left out when you save: Debris removal/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));
    expect(
      await screen.findByText('Say why this policy is chosen over BLUS or PAR'),
    ).toBeInTheDocument();
    expect(sent).toBeUndefined();
    await user.type(screen.getByLabelText('Reason for this policy'), 'Board decision');
    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));
    await waitFor(() =>
      expect(sent).toMatchObject({
        product: { code: 'BSUS', reason: 'Board decision' },
        addons: [],
      }),
    );
  });

  it('C-6: asks for each add-on cover of a section, or not', async () => {
    let sent: { fireCovers: unknown } | undefined;
    serve(
      record({
        fire: {
          ...record().fire,
          covers: [
            { name: 'Earthquake', required: null },
            { name: 'Terrorism', required: null },
          ],
        },
      }),
      (_url, body) => {
        sent = body as typeof sent;
        return record();
      },
    );
    const user = renderWorkspace();
    const earthquake = await screen.findByRole('group', { name: 'Fire: Earthquake' });
    await user.click(within(earthquake).getByRole('button', { name: 'Required' }));
    expect(within(earthquake).getByRole('button', { name: 'Required' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const terrorism = screen.getByRole('group', { name: 'Fire: Terrorism' });
    await user.click(within(terrorism).getByRole('button', { name: 'Not required' }));
    await user.type(screen.getByLabelText('Item 6 sum insured'), '5000000');
    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));
    await waitFor(() =>
      expect(sent?.fireCovers).toEqual([
        { name: 'Earthquake', required: true },
        { name: 'Terrorism', required: false },
      ]),
    );
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
        existing: {
          insurer: 'Example General, Fort',
          policyNumber: 'EGI/2025/42',
          source: 'POLICY_SOFTWARE',
        },
        fire: {
          groups: FIRE_GROUPS.map((group) => ({
            group,
            existing: group === 'STOCKS' ? '50000000' : null,
            proposed1: '0',
            proposed2: null,
          })),
          existing: '120000000',
          proposed1: '0',
          proposed2: null,
          covers: [],
        },
        sections: OTHER_SECTIONS.map((code) => ({
          ...record().sections.find((section) => section.code === code)!,
          existing: code === 'BURGLARY' ? '15000000' : null,
        })),
      }),
    );
    renderWorkspace();
    const card = await screen.findByRole('heading', { name: 'Existing policy' });
    expect(card).toBeInTheDocument();
    expect(screen.getByText(/EGI\/2025\/42 with Example General, Fort/)).toBeInTheDocument();
    expect(screen.getByText('Renewal')).toBeInTheDocument();
    // C-2: the Existing column starts as the copy and can be changed.
    expect(screen.getByLabelText('Insurer')).toHaveValue('Example General, Fort');
    expect(
      screen.getByLabelText('Existing for All types of stock pertaining to insured business'),
    ).toHaveValue('5,00,00,000');
    const otherSections = screen
      .getByText('Other sections')
      .closest<HTMLElement>('[data-slot=card]')!;
    expect(
      within(otherSections).getByRole('columnheader', { name: 'Existing' }),
    ).toBeInTheDocument();
    expect(within(otherSections).getByLabelText('Burglary Existing')).toHaveValue('1,50,00,000');
  });

  it('keeps the stepper, the tabs and the next step in step with the stage; closes a case', async () => {
    const posted: unknown[] = [];
    serve(record({ stage: 'QUOTES_RECEIVED', nextStage: 'QCR', missing: [] }), (url, body) => {
      posted.push(body);
      expect(url).toContain(`/proposals/${ID}/stage`);
      return record({
        stage: 'CLOSED',
        nextStage: null,
        closedReason: 'Lost to another broker',
        locked: true,
        missing: [],
      });
    });
    const user = renderWorkspace();
    // The case opens where its work goes on: the QCR, after the quotes.
    expect(await screen.findByRole('tab', { name: 'QCR, next step' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Quotes, done' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Insurers and RFQ, done' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Client approval' })).toBeInTheDocument();
    // No stage is set by hand: the next step says where it is done.
    expect(screen.queryByRole('button', { name: /^Move to/ })).not.toBeInTheDocument();
    expect(screen.getByText('Next: prepare the QCR and get it approved.')).toBeInTheDocument();
    // A step of the stepper opens its tab.
    await user.click(screen.getByRole('button', { name: /Quotes Received/ }));
    expect(screen.getByRole('tab', { name: 'Quotes, done' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Open QCR' }));
    expect(screen.getByRole('tab', { name: 'QCR, next step' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Close case' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Close case' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Reason'), 'Lost to another broker');
    await user.click(within(dialog).getByRole('button', { name: 'Close case' }));
    expect(await screen.findByText('This case is closed')).toBeInTheDocument();
    expect(posted).toEqual([{ stage: 'CLOSED', reason: 'Lost to another broker' }]);
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
    expect(screen.getByLabelText('Plate Glass Proposed – Option 1')).toHaveTextContent(
      '₹2,00,000.00',
    );

    // FLOP: the annual gross profit is its sum insured.
    await user.click(screen.getByRole('checkbox', { name: 'Fire Loss of Profit' }));
    await user.type(screen.getByLabelText('1. Annual Gross Profit'), '8000000');
    expect(screen.getByLabelText('Fire Loss of Profit Proposed – Option 1')).toHaveTextContent(
      '₹80,00,000.00',
    );

    // Removing a row updates the total.
    await user.click(within(details).getByRole('button', { name: 'Remove Plate Glass item 2' }));
    expect(screen.getByLabelText('Plate Glass Proposed – Option 1')).toHaveTextContent(
      '₹1,50,000.00',
    );

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
    expect(screen.getByLabelText('Money Proposed – Option 1')).toHaveValue('');
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
    await user.click(await screen.findByRole('tab', { name: 'Data Sheet, done' }));
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
