import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INSURER_A,
  caseRecord,
  json,
  urlOf,
} from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { PlacementSlip, Role } from '@/shared';
import { PlacementSlipPanel } from './placement-slip-panel';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { name: 'Asha Rao', roles: roles.current } }),
}));

const FILE_ID = 'f'.repeat(24);

function slip(overrides: Partial<PlacementSlip> = {}): PlacementSlip {
  return {
    status: 'DRAFT',
    accepted: {
      insurerId: INSURER_A,
      company: 'Kavach General',
      branch: 'Pune',
      option: 'P1',
      quoteId: '1'.repeat(24),
      version: 1,
      withTerrorism: false,
      premium: { net: '101500.00', gst: '18270.00', total: '119770.00' },
      acceptedOn: '2026-10-07',
      confirmedBy: 'Ravi Mehta',
      note: null,
      files: [],
      recordedAt: '2026-10-08T05:00:00.000Z',
      recordedBy: 'Asha Rao',
      quoteCurrent: true,
    },
    sections: [
      { code: 'FIRE', name: 'Fire', sumInsured: '60000000', premium: '100000' },
      { code: 'MONEY', name: 'Money', sumInsured: '500000', premium: '1500' },
    ],
    premium: { net: '101500.00', gst: '18270.00', total: '119770.00' },
    gstRatePercent: '18',
    capacityPercent: '100',
    deductibles: 'Fire: 5% of each claim',
    conditions: null,
    remarks: null,
    updatedAt: null,
    updatedBy: null,
    fingerprint: 'f1',
    approval: null,
    missing: [],
    templateUploaded: true,
    sends: [],
    recipients: [{ name: 'Kavach General, Pune', email: 'pune@kavach.example' }],
    placed: null,
    files: [],
    blocked: null,
    ...overrides,
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PlacementSlipPanel record={caseRecord({ stage: 'CLIENT_APPROVAL' })} />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

describe('PlacementSlipPanel', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('waits for the client approval', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockResolvedValue(
      json(slip({ accepted: null, sections: [], premium: null, blocked: 'Record it first.' })),
    );
    renderPanel();
    expect(await screen.findByText('Not ready for the placement slip')).toBeInTheDocument();
    expect(screen.getByText('Record it first.')).toBeInTheDocument();
  });

  it('shows the quote placed; an approver approves; the approved slip goes to the insurer', async () => {
    roles.current = ['MANAGER', 'ACCOUNT_MANAGER'];
    let sent: unknown;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/approve')) {
        return Promise.resolve(
          json(
            slip({
              status: 'APPROVED',
              approval: { at: '2026-10-08T06:00:00.000Z', by: 'Ravi Kumar', current: true },
            }),
          ),
        );
      }
      if (url.endsWith('/email')) {
        sent = JSON.parse(init?.body as string);
        return Promise.resolve(
          json({
            outcome: 'SENT',
            reason: null,
            slip: slip({
              status: 'SENT',
              sends: [
                {
                  mailId: 'd'.repeat(24),
                  at: '2026-10-08T07:00:00.000Z',
                  by: 'Asha Rao',
                  to: ['pune@kavach.example'],
                  result: 'OUTBOX',
                  error: null,
                },
              ],
            }),
          }),
        );
      }
      return Promise.resolve(json(slip()));
    });
    const user = renderPanel();
    expect(await screen.findByText('Kavach General, Pune')).toBeInTheDocument();
    expect(screen.getByText('₹1,19,770.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send to the insurer/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Approve slip' }));
    const send = await screen.findByRole('button', { name: /Send to the insurer/ });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: /pune@kavach.example/ })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sent).toMatchObject({ to: ['pune@kavach.example'], format: 'pdf' }));
    // Once sent, the policy or cover note can be recorded.
    expect(await screen.findByText('Record the policy or cover note')).toBeInTheDocument();
  });

  it('records the policy or cover note issued', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    const sentSlip = slip({
      status: 'SENT',
      sends: [
        {
          mailId: 'd'.repeat(24),
          at: '2026-10-08T07:00:00.000Z',
          by: 'Asha Rao',
          to: ['pune@kavach.example'],
          result: 'OUTBOX',
          error: null,
        },
      ],
      files: [
        {
          id: FILE_ID,
          fileName: 'Policy.pdf',
          contentType: 'application/pdf',
          size: 10,
          uploadedAt: '2026-10-08T08:00:00.000Z',
          uploadedBy: 'Asha Rao',
        },
      ],
    });
    let saved: unknown;
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'PUT') {
        saved = JSON.parse(init.body as string);
        return Promise.resolve(
          json({
            ...sentSlip,
            placed: {
              documentKind: 'COVER_NOTE',
              number: 'CN-77',
              issuedOn: '2026-10-08',
              note: null,
              files: sentSlip.files,
              recordedAt: '2026-10-08T09:00:00.000Z',
              recordedBy: 'Asha Rao',
            },
          }),
        );
      }
      return Promise.resolve(json(sentSlip));
    });
    const user = renderPanel();
    await user.selectOptions(await screen.findByLabelText('Issued'), 'COVER_NOTE');
    await user.type(screen.getByLabelText('Number'), 'CN-77');
    await user.clear(screen.getByLabelText('Issued on'));
    await user.type(screen.getByLabelText('Issued on'), '2026-10-08');
    await user.click(screen.getByRole('checkbox', { name: 'Policy.pdf' }));
    await user.click(screen.getByRole('button', { name: 'Record and mark as placed' }));
    await waitFor(() =>
      expect(saved).toEqual({
        documentKind: 'COVER_NOTE',
        number: 'CN-77',
        issuedOn: '2026-10-08',
        note: null,
        attachmentIds: [FILE_ID],
      }),
    );
    expect(await screen.findByText('Placed: Cover note CN-77')).toBeInTheDocument();
  });
});
