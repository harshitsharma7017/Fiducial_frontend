import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIRE_GROUPS,
  OTHER_SECTIONS,
  RISK_DETAIL_FIELDS,
  type ProposalRecord,
  type Role,
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
      groups: FIRE_GROUPS.map((group) => ({ group, proposed1: '0', proposed2: null })),
      proposed1: '0',
      proposed2: null,
    },
    sections: OTHER_SECTIONS.map((code) => ({
      code,
      included: false,
      proposed1: null,
      proposed2: null,
    })),
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
  active: true,
  status: 'NOT_SENT' as const,
  sentAt: null,
  sentBy: null,
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
  return userEvent.setup();
}

describe('ProposalWorkspace', () => {
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

    await user.type(screen.getByLabelText('Building 1 area in sq ft'), '1000.5');
    await user.type(screen.getByLabelText('Building 1 rate per sq ft'), '2000');
    const row = screen.getByRole('row', { name: /^Building 1/ });
    expect(within(row).getByText('₹20,01,000.00')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
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
            proposed1: group === 'STOCKS' ? '5000000' : '0',
            proposed2: null,
          })),
          proposed1: '5000000',
          proposed2: null,
        },
      });
    });
    const user = renderWorkspace();
    await user.type(
      await screen.findByLabelText('Stocks of the insured business amount'),
      '50,00,000',
    );
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
    expect(screen.getByRole('button', { name: 'Mark as sent to 1 insurer' })).toBeDisabled();
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
      await screen.findByText('fire.uw@insurer.example, rfq@insurer.example', { selector: 'p' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mark as sent to 1 insurer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark the RFQ as sent?' });
    expect(within(dialog).getByText('The Data Sheet will lock')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Mark as sent' }));

    await waitFor(() => expect(sent).toEqual({ insurerIds: [INSURER_ID] }));
    expect(await screen.findByText('Sent')).toBeInTheDocument();
    expect(screen.getByText(/Asha Rao$/, { selector: 'span' })).toBeInTheDocument();
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
    expect(screen.getByLabelText('Building 1 area in sq ft')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).not.toBeInTheDocument();
  });

  it('is read-only for a role that cannot edit proposals', async () => {
    roles.current = ['READ_ONLY'];
    serve(record());
    renderWorkspace();
    expect(await screen.findByLabelText('Building 1 area in sq ft')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add locations' })).not.toBeInTheDocument();
  });
});
