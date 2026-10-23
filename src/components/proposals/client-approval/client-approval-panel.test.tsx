import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INSURER_A,
  INSURER_B,
  caseRecord,
  json,
} from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import {
  legacyPermissionsOf,
  type ProposalClientApproval,
  type LegacyRole as Role,
} from '@/shared';
import { ClientApprovalPanel } from './client-approval-panel';

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      name: 'Asha Rao',
      roles: roles.current,
      roleNames: [],
      permissions: legacyPermissionsOf(roles.current),
    },
  }),
}));

const FILE_ID = 'f'.repeat(24);

function state(overrides: Partial<ProposalClientApproval> = {}): ProposalClientApproval {
  return {
    approval: null,
    choices: [
      {
        insurerId: INSURER_A,
        company: 'Kavach General',
        branch: 'Pune',
        option: 'P1',
        quoteId: '1'.repeat(24),
        version: 1,
        withTerrorism: { net: '121500.00', gst: '21870.00', total: '143370.00' },
        withoutTerrorism: { net: '101500.00', gst: '18270.00', total: '119770.00' },
        recommended: false,
        lowest: true,
      },
      {
        insurerId: INSURER_B,
        company: 'Suraksha General',
        branch: 'Fort',
        option: 'P1',
        quoteId: '2'.repeat(24),
        version: 1,
        withTerrorism: { net: '116000.00', gst: '20880.00', total: '136880.00' },
        withoutTerrorism: null,
        recommended: true,
        lowest: false,
      },
    ],
    files: [
      {
        id: FILE_ID,
        fileName: 'Client reply.pdf',
        contentType: 'application/pdf',
        size: 100,
        uploadedAt: '2026-10-08T05:00:00.000Z',
        uploadedBy: 'Asha Rao',
      },
    ],
    contacts: ['Ravi Mehta'],
    blocked: null,
    ...overrides,
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientApprovalPanel record={caseRecord({ stage: 'QCR' })} />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

describe('ClientApprovalPanel', { timeout: 20_000 }, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('waits for the QCR to reach the insured', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockResolvedValue(
      json(state({ blocked: 'Send the QCR to the insured first (QCR tab).' })),
    );
    renderPanel();
    expect(await screen.findByText('Not ready for the client approval')).toBeInTheDocument();
    expect(screen.getByText('Send the QCR to the insured first (QCR tab).')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Record client approval' }),
    ).not.toBeInTheDocument();
  });

  it('records the quote accepted, Fire with or without terrorism, with the client’s mail', async () => {
    roles.current = ['ACCOUNT_MANAGER'];
    let saved: unknown;
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'PUT') {
        saved = JSON.parse(init.body as string);
        return Promise.resolve(
          json(
            state({
              approval: {
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
                files: state().files,
                recordedAt: '2026-10-08T06:00:00.000Z',
                recordedBy: 'Asha Rao',
                quoteCurrent: true,
              },
            }),
          ),
        );
      }
      return Promise.resolve(json(state()));
    });
    const user = renderPanel();
    // The QCR's recommendation is chosen first.
    const recommended = await screen.findByRole('radio', { name: /Suraksha General, Fort/ });
    expect(recommended).toBeChecked();
    expect(screen.getByLabelText('Confirmed by')).toHaveValue('Ravi Mehta');

    await user.click(screen.getByRole('radio', { name: /Kavach General, Pune/ }));
    // Kavach quoted Fire both ways: the choice is needed before anything is sent.
    await user.click(screen.getByRole('checkbox', { name: 'Client reply.pdf' }));
    await user.click(screen.getByRole('button', { name: 'Record client approval' }));
    expect(
      await screen.findByText('Say whether the client takes Fire with or without terrorism.'),
    ).toBeInTheDocument();
    expect(saved).toBeUndefined();

    await user.click(screen.getByRole('radio', { name: /Without terrorism/ }));
    await user.clear(screen.getByLabelText('Accepted on'));
    await user.type(screen.getByLabelText('Accepted on'), '2026-10-07');
    await user.click(screen.getByRole('button', { name: 'Record client approval' }));
    await waitFor(() =>
      expect(saved).toEqual({
        insurerId: INSURER_A,
        option: 'P1',
        withTerrorism: false,
        acceptedOn: '2026-10-07',
        confirmedBy: 'Ravi Mehta',
        note: null,
        attachmentIds: [FILE_ID],
      }),
    );
    expect(await screen.findByText('Accepted by the client')).toBeInTheDocument();
    expect(screen.getByText('₹1,19,770.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });
});
