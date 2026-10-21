import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE_ID,
  INSURER_A,
  SURAKSHA,
  caseRecord,
  insurer,
  json,
  urlOf,
} from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { ProposalQuotes, QuoteVersion } from '@/shared';
import { QuotesPanel } from './quotes-panel';

const ATTACHMENT = {
  id: 'f'.repeat(24),
  insurerId: INSURER_A,
  fileName: 'Kavach quote.pdf',
  contentType: 'application/pdf',
  size: 1200,
  uploadedAt: '2026-10-08T05:00:00.000Z',
  uploadedBy: 'Asha Rao',
};

const record = caseRecord({
  stage: 'RFQ_SENT',
  policyStart: '2026-12-01',
  insurers: [insurer({ status: 'SENT' }), SURAKSHA({ status: 'DECLINED' })],
  sections: caseRecord().sections.map((section) =>
    section.code === 'MONEY' ? { ...section, included: true, proposed1: '500000' } : section,
  ),
  fire: { ...caseRecord().fire, covers: [{ name: 'Earthquake', required: true }] },
});

function version(overrides: Partial<QuoteVersion> = {}): QuoteVersion {
  return {
    id: '1'.repeat(24),
    insurerId: INSURER_A,
    option: 'P1',
    version: 1,
    reason: null,
    sections: [
      { code: 'FIRE', sumInsured: null, premium: '100000.50', premiumWithoutTerrorism: '90000' },
      { code: 'MONEY', sumInsured: null, premium: '2500', premiumWithoutTerrorism: null },
    ],
    terms: [{ name: 'Fire: Earthquake', accepted: true }],
    deductibles: null,
    capacityPercent: null,
    conditions: null,
    validUntil: null,
    attachments: [ATTACHMENT],
    gstRatePercent: '18',
    totals: {
      withTerrorism: { net: '102500.50', gst: '18450.09', total: '120950.59' },
      withoutTerrorism: { net: '92500.00', gst: '16650.00', total: '109150.00' },
    },
    deviations: [],
    createdAt: '2026-10-08T05:00:00.000Z',
    createdBy: 'Asha Rao',
    ...overrides,
  };
}

function quotes(versions: QuoteVersion[] = []): ProposalQuotes {
  const suraksha = SURAKSHA();
  return {
    gstRatePercent: '18',
    options: ['P1'],
    insurers: [
      {
        insurerId: INSURER_A,
        company: 'Kavach General',
        branch: 'Pune',
        status: versions.length > 0 ? 'QUOTED' : 'SENT',
        declined: null,
        quotes: [{ option: 'P1', versions }],
      },
      {
        insurerId: suraksha.insurerId,
        company: suraksha.company,
        branch: suraksha.branch,
        status: 'DECLINED',
        declined: { reason: 'Outside appetite', at: '2026-10-08T05:00:00.000Z', by: 'Asha Rao' },
        quotes: [{ option: 'P1', versions: [] }],
      },
    ],
    attachments: versions.length > 0 ? [ATTACHMENT] : [],
    qcr: versions[0]
      ? [
          {
            insurerId: INSURER_A,
            company: 'Kavach General',
            branch: 'Pune',
            option: 'P1',
            quoteId: versions[0].id,
            version: versions[0].version,
          },
        ]
      : [],
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <QuotesPanel record={record} canEdit />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

describe('QuotesPanel', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('Q-1, Q-3: enters a quote with live totals, and needs the insurer’s mail or PDF', async () => {
    let sent: Record<string, unknown> | undefined;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.includes('/quote-attachments')) return Promise.resolve(json(ATTACHMENT, 201));
      if (init?.method === 'POST' && url.endsWith(`/insurers/${INSURER_A}/quotes`)) {
        sent = JSON.parse(init.body as string) as Record<string, unknown>;
        return Promise.resolve(json(quotes([version()]), 201));
      }
      if (url.endsWith(`/proposals/${CASE_ID}/quotes`)) return Promise.resolve(json(quotes()));
      return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
    });
    const user = renderPanel();
    // Q-5: the declined insurer shows its reason and is left out of the QCR.
    expect(await screen.findByText(/Declined: Outside appetite/)).toBeInTheDocument();
    expect(screen.getByText(/Left out: Suraksha/)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Enter quote for Kavach General, Pune, Proposed – Option 1',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    await user.type(within(sheet).getByLabelText(/^Fire premium with terrorism$/i), '100000.50');
    await user.type(within(sheet).getByLabelText(/^Fire premium without terrorism$/i), '90000');
    // Money left blank: flagged as not quoted.
    expect(within(sheet).getByText('Money: not quoted')).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText('Money premium'), '2500');
    expect(within(sheet).getByText('₹1,20,950.59')).toBeInTheDocument();
    expect(within(sheet).getByText('without terrorism ₹1,09,150.00')).toBeInTheDocument();
    const earthquake = within(sheet).getByRole('group', { name: 'Fire: Earthquake' });
    await user.click(within(earthquake).getByRole('button', { name: 'Accepted' }));

    await user.click(within(sheet).getByRole('button', { name: 'Save quote' }));
    expect(await within(sheet).findByText('Attach the insurer’s email or PDF')).toBeInTheDocument();
    expect(sent).toBeUndefined();

    await user.upload(
      within(sheet).getByLabelText('Insurer’s mail or PDF'),
      new File(['%PDF-1.4'], 'Kavach quote.pdf', { type: 'application/pdf' }),
    );
    expect(await within(sheet).findByLabelText('Kavach quote.pdf')).toBeChecked();
    await user.click(within(sheet).getByRole('button', { name: 'Save quote' }));
    await waitFor(() =>
      expect(sent).toMatchObject({
        option: 'P1',
        attachmentIds: [ATTACHMENT.id],
        terms: [{ name: 'Fire: Earthquake', accepted: true }],
        sections: [
          { code: 'FIRE', premium: '100000.50', premiumWithoutTerrorism: '90000' },
          { code: 'MONEY', premium: '2500' },
        ],
      }),
    );
    expect(await screen.findByText('₹1,20,950.59')).toBeInTheDocument();
    expect(
      screen.getByText(/Kavach General, Pune — Proposed – Option 1, version 1/),
    ).toBeInTheDocument();
  });

  it('Q-4: a revision asks for its reason and keeps the earlier versions', async () => {
    const revised = version({
      id: '2'.repeat(24),
      version: 2,
      reason: 'Discount on renewal',
      deviations: ['Capacity 60%: not the whole risk'],
    });
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/quotes`)) {
        return Promise.resolve(json(quotes([revised, version()])));
      }
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel();
    expect(await screen.findByText(/Revised: Discount on renewal/)).toBeInTheDocument();
    expect(screen.getByText('Capacity 60%: not the whole risk')).toBeInTheDocument();
    expect(screen.getByText('Earlier versions (1)')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Revise quote for Kavach General, Pune, Proposed – Option 1',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    // The form starts from the latest version.
    expect(within(sheet).getByLabelText('Money premium')).toHaveValue('2,500');
    await user.click(within(sheet).getByRole('button', { name: 'Save version 3' }));
    expect(await within(sheet).findByText('Say why the quote was revised')).toBeInTheDocument();
  });
});
