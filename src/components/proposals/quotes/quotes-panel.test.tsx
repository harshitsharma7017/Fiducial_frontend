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
import type { OcrField, ProposalQuotes, QuoteExtraction, QuoteVersion } from '@/shared';
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

  it('Q1: fills the form from a PDF, shows where each value came from, and needs it checked before saving', async () => {
    const found = (raw: string, value: string, state: OcrField['state'] = 'HIGH'): OcrField => ({
      raw,
      value,
      state,
    });
    const none: OcrField = { raw: null, value: null, state: 'MISSING' };
    const extraction: QuoteExtraction = {
      source: 'PDF_TEXT',
      reader: 'BUILT_IN',
      attachmentId: ATTACHMENT.id,
      insurerName: none,
      insuredName: none,
      quoteReference: none,
      option: { value: null, state: 'MISSING' },
      sections: [
        {
          code: 'FIRE',
          premium: found('Fire and Special Perils 6,00,00,000 1,00,000.50', '100000.50', 'LOW'),
          premiumWithoutTerrorism: found('Fire (without terrorism) 90,000.00', '90000.00'),
        },
      ],
      netPremium: found('Net Premium 1,02,500.50', '102500.50'),
      gstRatePercent: found('GST @ 18%', '18'),
      gstAmount: none,
      totalPremium: found('Total Premium 1,20,950.59', '120950.59'),
      validUntil: found('valid till 31/12/2026', '2026-12-31'),
      discrepancies: ['Net (₹102500.50) + GST (₹0) does not match the stated total (₹120950.59).'],
      manualEntryRequired: false,
    };
    let sent: Record<string, unknown> | undefined;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith(`/quote-attachments/${ATTACHMENT.id}/read`)) {
        return Promise.resolve(json(extraction));
      }
      if (url.includes('/quote-attachments')) return Promise.resolve(json(ATTACHMENT, 201));
      if (init?.method === 'POST' && url.endsWith(`/insurers/${INSURER_A}/quotes`)) {
        sent = JSON.parse(init.body as string) as Record<string, unknown>;
        return Promise.resolve(json(quotes([version()]), 201));
      }
      if (url.endsWith(`/proposals/${CASE_ID}/quotes`)) return Promise.resolve(json(quotes()));
      return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
    });
    const user = renderPanel();
    await user.click(
      await screen.findByRole('button', {
        name: 'Enter quote for Kavach General, Pune, Proposed – Option 1',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    await user.upload(
      within(sheet).getByLabelText('Insurer’s mail or PDF'),
      new File(['%PDF-1.4'], 'Kavach quote.pdf', { type: 'application/pdf' }),
    );
    await user.click(
      await within(sheet).findByRole('button', { name: 'Fill the form from this PDF' }),
    );
    // Filled where the PDF gave a value, with its source line and how sure the reader was.
    expect(await within(sheet).findByText(/Filled from Kavach quote.pdf/)).toBeInTheDocument();
    expect(
      within(sheet).getByText(/from “Fire and Special Perils 6,00,00,000 1,00,000.50”/),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('Low confidence — please check')).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/^Fire premium with terrorism$/i)).toHaveValue(
      '1,00,000.50',
    );
    expect(within(sheet).getByLabelText(/^Fire premium without terrorism$/i)).toHaveValue(
      '90,000.00',
    );
    // Money was not in the PDF: left for the person.
    expect(
      within(sheet).getByText(/Not found in the PDF, enter by hand: Money/),
    ).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Money premium')).toHaveValue('');
    expect(within(sheet).getByText(/does not match the stated total/)).toBeInTheDocument();

    // Not saved until the values are checked.
    await user.click(within(sheet).getByRole('button', { name: 'Save quote' }));
    expect(await within(sheet).findByText(/Tick this once you have checked/)).toBeInTheDocument();
    expect(sent).toBeUndefined();
    await user.click(
      within(sheet).getByRole('checkbox', {
        name: /I have checked the values filled from the PDF/,
      }),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Save quote' }));
    await waitFor(() =>
      expect(sent).toMatchObject({
        attachmentIds: [ATTACHMENT.id],
        validUntil: '2026-12-31',
        sections: expect.arrayContaining([
          expect.objectContaining({
            code: 'FIRE',
            premium: '100000.50',
            premiumWithoutTerrorism: '90000.00',
          }),
        ]),
      }),
    );
  });

  it('Q1: says when nothing can be read and does not hold the save back', async () => {
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.endsWith(`/quote-attachments/${ATTACHMENT.id}/read`)) {
        const none = { raw: null, value: null, state: 'MISSING' };
        return Promise.resolve(
          json({
            source: 'NONE',
            attachmentId: ATTACHMENT.id,
            insurerName: none,
            insuredName: none,
            quoteReference: none,
            option: { value: null, state: 'MISSING' },
            sections: [],
            netPremium: none,
            gstRatePercent: none,
            gstAmount: none,
            totalPremium: none,
            validUntil: none,
            discrepancies: [
              'This PDF has no text to read (it looks scanned). Enter the figures by hand.',
            ],
            manualEntryRequired: true,
          }),
        );
      }
      if (url.includes('/quote-attachments')) return Promise.resolve(json(ATTACHMENT, 201));
      if (url.endsWith(`/proposals/${CASE_ID}/quotes`)) return Promise.resolve(json(quotes()));
      return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
    });
    const user = renderPanel();
    await user.click(
      await screen.findByRole('button', {
        name: 'Enter quote for Kavach General, Pune, Proposed – Option 1',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    await user.upload(
      within(sheet).getByLabelText('Insurer’s mail or PDF'),
      new File(['%PDF-1.4'], 'Kavach quote.pdf', { type: 'application/pdf' }),
    );
    await user.click(
      await within(sheet).findByRole('button', { name: 'Fill the form from this PDF' }),
    );
    expect(
      await within(sheet).findByText('Nothing could be read from Kavach quote.pdf'),
    ).toBeInTheDocument();
    expect(within(sheet).getByText(/looks scanned/)).toBeInTheDocument();
    expect(
      within(sheet).queryByRole('checkbox', { name: /I have checked/ }),
    ).not.toBeInTheDocument();
  });
  it('Q1 with Gemini: reads a picture, says it went to Gemini and whose quote it is, and still needs the check', async () => {
    const PICTURE = { ...ATTACHMENT, fileName: 'Kavach quote.jpg', contentType: 'image/jpeg' };
    const low = (raw: string, value: string): OcrField => ({ raw, value, state: 'LOW' });
    const none: OcrField = { raw: null, value: null, state: 'MISSING' };
    const extraction: QuoteExtraction = {
      source: 'OCR_IMAGE',
      reader: 'GEMINI',
      attachmentId: PICTURE.id,
      insurerName: low('Page 1: Kavach General Insurance Ltd.', 'Kavach General Insurance Ltd.'),
      insuredName: none,
      quoteReference: low('Page 1: Quote Ref KGI/77/2026', 'KGI/77/2026'),
      option: { value: null, state: 'MISSING' },
      sections: [
        {
          code: 'FIRE',
          premium: low('Page 1: Fire (incl. terrorism) 1,00,000.50', '100000.50'),
          premiumWithoutTerrorism: low('Page 1: Fire (excl. terrorism) 90,000', '90000'),
        },
      ],
      netPremium: none,
      gstRatePercent: none,
      gstAmount: none,
      totalPremium: none,
      validUntil: none,
      discrepancies: [],
      manualEntryRequired: false,
    };
    let sent: Record<string, unknown> | undefined;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith(`/quote-attachments/${PICTURE.id}/read`)) {
        return Promise.resolve(json(extraction));
      }
      if (url.includes('/quote-attachments')) return Promise.resolve(json(PICTURE, 201));
      if (init?.method === 'POST' && url.endsWith(`/insurers/${INSURER_A}/quotes`)) {
        sent = JSON.parse(init.body as string) as Record<string, unknown>;
        return Promise.resolve(json(quotes([version()]), 201));
      }
      if (url.endsWith(`/proposals/${CASE_ID}/quotes`)) return Promise.resolve(json(quotes()));
      return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
    });
    const user = renderPanel();
    await user.click(
      await screen.findByRole('button', {
        name: 'Enter quote for Kavach General, Pune, Proposed – Option 1',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    await user.upload(
      within(sheet).getByLabelText('Insurer’s mail or PDF'),
      new File(['jpeg'], 'Kavach quote.jpg', { type: 'image/jpeg' }),
    );
    await user.click(
      await within(sheet).findByRole('button', { name: 'Fill the form from this picture' }),
    );
    expect(
      await within(sheet).findByText(
        /Filled from Kavach quote.jpg: check each value against the file/,
      ),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(/Read by Gemini \(Google’s external AI service\)/),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(
        /names Insurer Kavach General Insurance Ltd., Quotation no. KGI\/77\/2026\. Check it is this insurer’s quote/,
      ),
    ).toBeInTheDocument();
    expect(within(sheet).getAllByText('Low confidence — please check')).toHaveLength(2);
    expect(within(sheet).getByLabelText(/^Fire premium with terrorism$/i)).toHaveValue(
      '1,00,000.50',
    );

    await user.click(within(sheet).getByRole('button', { name: 'Save quote' }));
    expect(await within(sheet).findByText(/Tick this once you have checked/)).toBeInTheDocument();
    expect(sent).toBeUndefined();
    await user.click(
      within(sheet).getByRole('checkbox', {
        name: 'I have checked the values filled from the file against the file',
      }),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Save quote' }));
    await waitFor(() => expect(sent).toMatchObject({ attachmentIds: [PICTURE.id] }));
  });

  it('Q1: shows why a read failed, keeps the form usable, and the read can be retried', async () => {
    let attempts = 0;
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.endsWith(`/quote-attachments/${ATTACHMENT.id}/read`)) {
        attempts += 1;
        return Promise.resolve(
          json(
            {
              code: 'UPSTREAM_UNAVAILABLE',
              message:
                'The reading service (Gemini) is busy. Wait a minute and try again, or enter the figures by hand.',
              details: { reader: 'GEMINI', reason: 'RATE_LIMITED' },
            },
            503,
          ),
        );
      }
      if (url.includes('/quote-attachments')) return Promise.resolve(json(ATTACHMENT, 201));
      if (url.endsWith(`/proposals/${CASE_ID}/quotes`)) return Promise.resolve(json(quotes()));
      return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
    });
    const user = renderPanel();
    await user.click(
      await screen.findByRole('button', {
        name: 'Enter quote for Kavach General, Pune, Proposed – Option 1',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    await user.upload(
      within(sheet).getByLabelText('Insurer’s mail or PDF'),
      new File(['%PDF-1.4'], 'Kavach quote.pdf', { type: 'application/pdf' }),
    );
    const fill = await within(sheet).findByRole('button', { name: 'Fill the form from this PDF' });
    await user.click(fill);
    expect(
      await within(sheet).findByText(/The reading service \(Gemini\) is busy/),
    ).toBeInTheDocument();
    // Nothing was filled and no check is asked for; the file stays attached for the save.
    expect(within(sheet).queryByText(/Filled from/)).not.toBeInTheDocument();
    expect(within(sheet).getByLabelText('Money premium')).toHaveValue('');
    await waitFor(() => expect(fill).toBeEnabled());
    await user.click(fill);
    await waitFor(() => expect(attempts).toBe(2));
  });
});
