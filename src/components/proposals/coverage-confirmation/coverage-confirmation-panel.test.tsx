import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE_ID,
  caseRecord,
  json,
  urlOf,
} from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { CoverageConfirmation, Role } from '@/shared';
import { CoverageConfirmationPanel } from './coverage-confirmation-panel';

// Q4: the Coverage confirmation tab. Records the insurer's confirmation, shows the policy details
// read from the placement slip, and emails the insured with the recipients auto-filled from the
// client master (Q3). Nothing is sent by recording.

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { name: 'Asha Rao', roles: roles.current } }),
}));

function coverage(overrides: Partial<CoverageConfirmation> = {}): CoverageConfirmation {
  return {
    confirmation: null,
    policy: {
      insuredName: 'Sundarvan Agro Foods',
      insurerName: 'Kavach General',
      insurerBranch: 'Pune',
      documentKind: 'POLICY',
      policyNumber: 'KG/FIRE/2026/1',
      issuedOn: '2026-10-08',
      policyStart: '2026-12-01',
      policyEnd: '2027-11-30',
      option: 'P1',
      sections: [{ code: 'FIRE', name: 'Fire', sumInsured: '60000000', premium: '100000.00' }],
      premium: { net: '100000.00', gst: '18000.00', total: '118000.00' },
      gstRatePercent: '18',
      reference: 'PRP-2026-0042',
    },
    files: [
      {
        id: 'f'.repeat(24),
        fileName: 'Policy.pdf',
        uploadedAt: '2026-10-08T05:00:00.000Z',
        uploadedBy: 'Asha Rao',
      },
    ],
    recipients: [
      { name: 'Ravi Mehta', email: 'ravi@mills.example' },
      { name: 'Priya Shah', email: 'priya@mills.example' },
    ],
    sends: [],
    missing: [],
    blocked: null,
    presentationPending: true,
    ...overrides,
  };
}

const recorded: CoverageConfirmation['confirmation'] = {
  confirmedOn: '2026-10-09',
  insurerReference: 'CONF/88',
  channel: 'BOTH',
  notes: null,
  signatoryName: null,
  signatoryTitle: null,
  recordedAt: '2026-10-09T05:00:00.000Z',
  recordedBy: 'Asha Rao',
  updatedAt: '2026-10-09T05:00:00.000Z',
  updatedBy: 'Asha Rao',
  attachmentIds: [],
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CoverageConfirmationPanel record={caseRecord({ stage: 'PLACED' })} />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

describe('CoverageConfirmationPanel', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    roles.current = ['ACCOUNT_MANAGER'];
  });

  it('shows the policy details from the placement slip and the awaiting-confirmation note', async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/coverage-confirmation`)) {
        return Promise.resolve(json(coverage()));
      }
      return Promise.resolve(json({}, 404));
    });
    renderPanel();
    expect(await screen.findByText('Policy details')).toBeInTheDocument();
    expect(screen.getByText('KG/FIRE/2026/1')).toBeInTheDocument();
    expect(screen.getByText('₹1,18,000.00')).toBeInTheDocument();
    expect(screen.getByText('Awaiting client confirmation')).toBeInTheDocument();
    // Send is disabled until a confirmation is recorded.
    expect(screen.getByRole('button', { name: 'Send to the insured' })).toBeDisabled();
  });

  it('surfaces the configured delivery channel once a confirmation is recorded', async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/coverage-confirmation`)) {
        return Promise.resolve(
          json(coverage({ confirmation: { ...recorded, channel: 'LETTER' } })),
        );
      }
      return Promise.resolve(json({}, 404));
    });
    renderPanel();
    // The channel is shown clearly in the interface (Q4-D): a status badge and the description.
    await screen.findByText((content) => content.includes('set to a letter (PDF)'));
    const badge = screen
      .getAllByText('Letter (PDF) only')
      .find((element) => element.getAttribute('data-slot') === 'badge');
    expect(badge).toBeInTheDocument();
    // Both actions remain available (channel not hard-locked), the letter is emphasised.
    expect(screen.getByRole('button', { name: /Download letter/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send to the insured' })).toBeEnabled();
  });

  it('records the confirmation (no email sent) via PUT', async () => {
    let saved: unknown;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'PUT') {
        saved = JSON.parse(init.body as string);
        return Promise.resolve(json(coverage({ confirmation: recorded })));
      }
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/coverage-confirmation`)) {
        return Promise.resolve(json(coverage()));
      }
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel();
    await user.type(await screen.findByLabelText('Insurer reference'), 'CONF/88');
    await user.click(screen.getByRole('button', { name: 'Record confirmation' }));
    await waitFor(() => expect(saved).toMatchObject({ insurerReference: 'CONF/88' }));
  });

  it('emails the insured with every client contact auto-filled (Q3)', async () => {
    let sent: { to: string[]; attachLetter: boolean } | undefined;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/coverage-confirmation/email')) {
        sent = JSON.parse(init?.body as string) as { to: string[]; attachLetter: boolean };
        return Promise.resolve(
          json({ outcome: 'SENT', reason: null, coverage: coverage({ confirmation: recorded }) }),
        );
      }
      if (url.endsWith(`/proposals/${CASE_ID}/coverage-confirmation`)) {
        return Promise.resolve(json(coverage({ confirmation: recorded })));
      }
      return Promise.resolve(json({}, 404));
    });
    const user = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Send to the insured' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Ravi Mehta <ravi@mills.example>')).toBeChecked();
    expect(within(dialog).getByLabelText('Priya Shah <priya@mills.example>')).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(sent).toMatchObject({
        to: ['ravi@mills.example', 'priya@mills.example'],
        attachLetter: true,
      }),
    );
  });

  it('shows the blocked state when the case is not placed', async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).endsWith(`/proposals/${CASE_ID}/coverage-confirmation`)) {
        return Promise.resolve(
          json(
            coverage({
              policy: null,
              blocked: 'Record the insurer’s policy or cover note on the Placement slip tab first.',
            }),
          ),
        );
      }
      return Promise.resolve(json({}, 404));
    });
    renderPanel();
    expect(await screen.findByText('Not ready for the coverage confirmation')).toBeInTheDocument();
  });
});
