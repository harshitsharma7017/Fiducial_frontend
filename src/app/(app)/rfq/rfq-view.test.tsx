import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIRE_GROUPS,
  OTHER_SECTION_LABELS,
  OTHER_SECTIONS,
  type ProposalInsurer,
  type ProposalRecord,
  type LegacyRole as Role,
  legacyPermissionsOf,
} from '@/shared';
import { RfqView } from './rfq-view';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: { roles: roles.current, roleNames: [], permissions: legacyPermissionsOf(roles.current) },
  }),
}));

function insurer(n: number, sentAt: string | null): ProposalInsurer {
  return {
    insurerId: String(n).repeat(24),
    company: `Insurer ${n}`,
    branch: 'Pune',
    rfqEmails: [`rfq${n}@insurer.example`],
    contacts: [],
    active: true,
    status: sentAt ? 'SENT' : 'NOT_SENT',
    sentVia: sentAt ? 'APP' : null,
    sentAt,
    sentBy: sentAt ? 'Asha Rao' : null,
    dueDate: sentAt ? '2099-01-10' : null,
    overdue: false,
    reminderCount: 0,
    lastRemindedAt: null,
    response: null,
    lastMail: null,
  };
}

function proposal(
  n: number,
  name: string,
  missing: string[],
  insurers: ProposalInsurer[],
): ProposalRecord {
  return {
    id: String(n).repeat(24).slice(0, 24).padEnd(24, 'a'),
    reference: `PRP-2026-000${n}`,
    type: 'NEW',
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
    stage: insurers.some((i) => i.status === 'SENT')
      ? 'RFQ_SENT'
      : missing.length
        ? 'DRAFT'
        : 'DATA_SHEET',
    client: { id: 'b'.repeat(24), name, gstin: null, city: 'Pune', state: 'Maharashtra' },
    owner: { id: 'e'.repeat(24), name: 'Asha Rao' },
    dueDate: '2099-01-10',
    policyStart: null,
    locations: [],
    fire: {
      groups: FIRE_GROUPS.map((group) => ({
        group,
        existing: null,
        proposed1: '0',
        proposed2: null,
        proposed3: null,
      })),
      existing: null,
      proposed1: '25000000',
      proposed2: null,
      proposed3: null,
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
    missing,
    locked: insurers.some((i) => i.status === 'SENT'),
    insurers,
    activity: [],
    createdAt: '2026-10-07T04:00:00.000Z',
    updatedAt: '2026-10-07T04:00:00.000Z',
  };
}

const SENT_AT = '2026-10-07T06:00:00.000Z';
const ITEMS = [
  proposal(1, 'Draft Textiles', ['Add at least one risk location.'], []),
  proposal(2, 'Ready Castings', [], [insurer(1, null)]),
  proposal(3, 'Partly Spices', [], [insurer(1, SENT_AT), insurer(2, null)]),
  proposal(4, 'Sent Steel', [], [insurer(3, SENT_AT)]),
];

describe('RfqView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: ITEMS, nextCursor: null }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  function renderView() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <RfqView serverSearch="" />
      </QueryClientProvider>,
    );
    return userEvent.setup();
  }

  it('lists every RFQ, ready to send first, with counts per status', async () => {
    renderView();
    await screen.findByText('Ready Castings');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
      'Ready CastingsPune',
      'Partly SpicesPune',
      'Draft TextilesPune',
      'Sent SteelPune',
    ]);
    const group = screen.getByRole('group', { name: 'RFQ status' });
    expect(within(group).getByRole('button', { name: 'All (4)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Ready to send (1)' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Partly sent (1)' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2 sent')).toBeInTheDocument();
  });

  it('opens a proposal on the tab that needs work', async () => {
    renderView();
    expect(await screen.findByRole('link', { name: 'PRP-2026-0002' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\?tab=rfq$/),
    );
    expect(screen.getByRole('link', { name: 'PRP-2026-0001' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\?tab=data-sheet$/),
    );
  });

  it('filters by status and search through the URL', async () => {
    const user = renderView();
    await screen.findByText('Ready Castings');
    await user.click(screen.getByRole('button', { name: 'Sent (1)' }));
    expect(window.location.search).toBe('?status=sent');
    expect(screen.getByText('Sent Steel')).toBeInTheDocument();
    expect(screen.queryByText('Ready Castings')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All (4)' }));
    await user.type(screen.getByLabelText('Search'), 'spices');
    expect(screen.getByText('Partly Spices')).toBeInTheDocument();
    expect(screen.queryByText('Sent Steel')).not.toBeInTheDocument();
  });

  it('counts every insurer with the RFQ as sent and filters overdue responses (?filter=overdue)', async () => {
    const answered = { ...insurer(1, SENT_AT), status: 'DECLINED' as const };
    const reminded = { ...insurer(2, SENT_AT), status: 'REMINDED' as const };
    const late = { ...insurer(3, SENT_AT), status: 'SENT' as const, overdue: true };
    const items = [
      ...ITEMS,
      proposal(5, 'Answered Mills', [], [answered, reminded]),
      proposal(6, 'Late Foods', [], [late]),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items, nextCursor: null }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
    window.history.replaceState(null, '', '/rfq?filter=overdue');
    const user = renderOverdue();
    expect(await screen.findByText('Late Foods')).toBeInTheDocument();
    expect(screen.queryByText('Answered Mills')).not.toBeInTheDocument();
    const overdue = screen.getByRole('button', { name: 'Overdue responses (1)' });
    expect(overdue).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sent, overdue')).toBeInTheDocument();

    await user.click(overdue);
    expect(window.location.search).toBe('');
    // Declined and Reminded both have the RFQ: the case is sent to both insurers.
    const row = screen.getByText('Answered Mills').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('2 of 2 sent')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Declined')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Reminded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sent (3)' })).toBeInTheDocument();
  });

  function renderOverdue() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <RfqView serverSearch="filter=overdue" />
      </QueryClientProvider>,
    );
    return userEvent.setup();
  }
});
