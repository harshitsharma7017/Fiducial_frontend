import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  legacyPermissionsOf,
  type ProposalRecord,
  type LegacyRole as Role,
  type SendResult,
} from '@/shared';
import { InsurersRfqPanel } from './insurers-rfq-panel';
import { MailLog } from './mail-log';
import {
  CASE_ID,
  INSURER_A,
  INSURER_B,
  MAIL_ID,
  SURAKSHA,
  caseRecord,
  insurer,
  json,
  mailDetail,
  urlOf,
  approvedRfqState,
} from './rfq-fixtures.test-utils';

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

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
type Handler = (url: string, body: unknown, method: string) => Response | undefined;

/** Answers previews from the request, the given handler first, and 404 for anything else. */
function serve(handler: Handler) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const answer = handler(url, body, method);
    if (answer) return Promise.resolve(answer);
    if (url.endsWith('/rfq/versions')) return Promise.resolve(json(approvedRfqState()));
    if (url.endsWith('/rfq/preview')) {
      const request = body as { insurers: { insurerId: string; to: string[] }[] };
      return Promise.resolve(
        json({
          mails: request.insurers.map((entry) => ({
            insurerId: entry.insurerId,
            insurerName:
              entry.insurerId === INSURER_A ? 'Kavach General, Pune' : 'Suraksha General, Fort',
            to: entry.to,
            subject: 'Request for quotation: Sundarvan Agro Foods (PRP-2026-0042)',
            text: `Mail for ${entry.insurerId}`,
            html: '<div></div>',
          })),
          attachmentName: 'RFQ-PRP-2026-0042.xlsx',
        }),
      );
    }
    return Promise.resolve(json({ code: 'NOT_FOUND', message: 'Not found' }, 404));
  });
}

function renderWith(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The RFQ's latest version is approved (R-5), so it can be sent.
  queryClient.setQueryData(['proposals', 'rfq', CASE_ID], approvedRfqState());
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup();
}

const result = (
  insurerId: string,
  outcome: SendResult['outcome'],
  reason: string | null = null,
) => ({
  insurerId,
  insurerName: insurerId === INSURER_A ? 'Kavach General, Pune' : 'Suraksha General, Fort',
  outcome,
  mailId: outcome === 'SENT' ? MAIL_ID : null,
  reason,
});

describe('Email the RFQ', () => {
  beforeEach(() => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('ticks RFQ addresses, not contacts, previews each mail and retries a failure with a new send id', async () => {
    const sends: {
      sendId: string;
      insurers: { insurerId: string; to: string[] }[];
      dueDate: string;
    }[] = [];
    serve((url, body) => {
      if (!url.endsWith('/rfq/email')) return undefined;
      const request = body as (typeof sends)[number];
      sends.push(request);
      const sent: ProposalRecord = caseRecord({ stage: 'RFQ_SENT', locked: true });
      return json({
        results:
          sends.length === 1
            ? [
                result(INSURER_A, 'SENT'),
                result(INSURER_B, 'FAILED', 'The mail server refused the mail (550)'),
              ]
            : [result(INSURER_B, 'SENT')],
        proposal: sent,
      });
    });
    const user = renderWith(<InsurersRfqPanel record={caseRecord()} />);
    await user.click(screen.getByRole('button', { name: 'Email the RFQ' }));
    const dialog = await screen.findByRole('dialog', { name: 'Email the RFQ' });

    expect(within(dialog).getByRole('checkbox', { name: /^rfq@kavach\.example/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /^pune@kavach\.example/ })).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: /^meera@kavach\.example/ }),
    ).not.toBeChecked();
    // Addresses come only from the insurer master: there is no field to type one.
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog).getByLabelText('Quotes due by')).toHaveValue('2099-01-10');

    expect(await within(dialog).findAllByRole('tab')).toHaveLength(2);
    expect(within(dialog).getByRole('tab', { name: 'Suraksha General, Fort' })).toBeInTheDocument();
    expect(
      within(dialog).getByText('Each mail carries RFQ-PRP-2026-0042.xlsx'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('checkbox', { name: /^meera@kavach\.example/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Send to 2 insurers' }));
    await waitFor(() => expect(sends).toHaveLength(1));
    expect(sends[0]).toMatchObject({
      insurers: [
        {
          insurerId: INSURER_A,
          to: ['rfq@kavach.example', 'pune@kavach.example', 'meera@kavach.example'],
        },
        { insurerId: INSURER_B, to: ['rfq@suraksha.example'] },
      ],
      dueDate: '2099-01-10',
      format: 'xlsx',
    });
    expect(sends[0]?.sendId).toMatch(/^[0-9a-f-]{36}$/);

    expect(await within(dialog).findByText('Sent to Kavach General, Pune')).toBeInTheDocument();
    const failure = within(dialog).getByRole('alert');
    expect(within(failure).getByText('Not sent to Suraksha General, Fort')).toBeInTheDocument();
    expect(within(failure).getByText('The mail server refused the mail (550)')).toBeInTheDocument();

    await user.click(
      within(failure).getByRole('button', { name: 'Try again for Suraksha General, Fort' }),
    );
    await waitFor(() => expect(sends).toHaveLength(2));
    expect(sends[1]?.insurers).toEqual([{ insurerId: INSURER_B, to: ['rfq@suraksha.example'] }]);
    expect(sends[1]?.sendId).not.toBe(sends[0]?.sendId);
    expect(await within(dialog).findByText('Sent to Suraksha General, Fort')).toBeInTheDocument();
  });

  it('falls back to marking it sent when mail is off', async () => {
    serve((url) =>
      url.endsWith('/rfq/email')
        ? json(
            { code: 'MAIL_DISABLED', message: 'Sending mail is turned off on this server.' },
            409,
          )
        : undefined,
    );
    const user = renderWith(<InsurersRfqPanel record={caseRecord()} />);
    await user.click(screen.getByRole('button', { name: 'Email the RFQ' }));
    const dialog = await screen.findByRole('dialog', { name: 'Email the RFQ' });
    await within(dialog).findAllByRole('tab');
    await user.click(within(dialog).getByRole('button', { name: 'Send to 2 insurers' }));
    expect(await within(dialog).findByText('Mail is turned off')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('button', { name: 'Mark as sent to all 2' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email the RFQ' })).not.toBeInTheDocument();
  });

  it('is not offered to roles without proposals.send', () => {
    roles.current = ['MANAGER'];
    serve(() => undefined);
    renderWith(<InsurersRfqPanel record={caseRecord()} />);
    expect(screen.queryByRole('button', { name: 'Email the RFQ' })).not.toBeInTheDocument();
    expect(screen.getByText('Your role cannot send the RFQ.')).toBeInTheDocument();
  });
});

describe('reminders and answers', () => {
  beforeEach(() => {
    roles.current = ['PLACEMENT_EXEC'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  const sentCase = () =>
    caseRecord({
      stage: 'RFQ_SENT',
      locked: true,
      insurers: [
        insurer({
          status: 'SENT',
          sentVia: 'APP',
          sentAt: '2026-10-08T05:00:00.000Z',
          sentBy: 'Asha Rao',
          dueDate: '2026-10-09',
          overdue: true,
          lastMail: {
            id: MAIL_ID,
            kind: 'RFQ',
            at: '2026-10-08T05:00:00.000Z',
            result: 'DELIVERED',
          },
        }),
        SURAKSHA({
          status: 'DECLINED',
          sentVia: 'OUTSIDE',
          sentAt: '2026-10-08T05:00:00.000Z',
          response: {
            status: 'DECLINED',
            note: 'Outside appetite',
            at: '2026-10-09T05:00:00.000Z',
            by: 'Priya Nair',
          },
        }),
      ],
    });

  it('shows status, Overdue, the due date and the answer note on each insurer', () => {
    serve(() => undefined);
    renderWith(<InsurersRfqPanel record={sentCase()} />);
    const [, kavach, suraksha] = screen.getAllByRole('row');
    expect(within(kavach as HTMLElement).getByText('Sent')).toBeInTheDocument();
    expect(within(kavach as HTMLElement).getByText('Overdue')).toBeInTheDocument();
    expect(within(kavach as HTMLElement).getByText('09 Oct 2026')).toBeInTheDocument();
    expect(within(suraksha as HTMLElement).getByText('Declined')).toBeInTheDocument();
    expect(within(suraksha as HTMLElement).getByText('“Outside appetite”')).toBeInTheDocument();
    // A declined insurer cannot be reminded.
    expect(
      within(suraksha as HTMLElement).queryByRole('button', { name: /Remind/ }),
    ).not.toBeInTheDocument();
  });

  it('reminds with the last mail’s addresses and the RFQ attached', async () => {
    let reminder: unknown;
    serve((url, body) => {
      if (url.endsWith(`/mails/${MAIL_ID}`)) return json(mailDetail());
      if (url.endsWith(`/insurers/${INSURER_A}/reminder`)) {
        reminder = body;
        return json({ results: [result(INSURER_A, 'SENT')], proposal: sentCase() });
      }
      return undefined;
    });
    const user = renderWith(<InsurersRfqPanel record={sentCase()} />);
    await user.click(screen.getByRole('button', { name: 'Remind Kavach General, Pune' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remind Kavach General, Pune' });
    await waitFor(() =>
      expect(within(dialog).getByRole('checkbox', { name: /^pune@kavach\.example/ })).toBeChecked(),
    );
    expect(
      within(dialog).getByRole('checkbox', { name: /^rfq@kavach\.example/ }),
    ).not.toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Attach the RFQ (Excel) again' }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Send reminder' }));
    await waitFor(() =>
      expect(reminder).toMatchObject({
        to: ['pune@kavach.example'],
        attachRfq: true,
        format: 'xlsx',
      }),
    );
  });

  it('records an answer from the allowed statuses only', async () => {
    let answer: unknown;
    serve((url, body) => {
      if (!url.endsWith(`/insurers/${INSURER_A}/response`)) return undefined;
      answer = body;
      return json(sentCase());
    });
    const user = renderWith(<InsurersRfqPanel record={sentCase()} />);
    await user.click(
      screen.getByRole('button', { name: 'Record answer for Kavach General, Pune' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual(['Quoted', 'Declined', 'No response']);
    // Q-5: a decline waits for its reason.
    await user.click(within(dialog).getByRole('radio', { name: 'Declined' }));
    expect(within(dialog).getByRole('button', { name: 'Save answer' })).toBeDisabled();
    expect(within(dialog).getByLabelText('Reason for declining')).toBeRequired();
    await user.click(within(dialog).getByRole('radio', { name: 'Quoted' }));
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'Best terms');
    await user.click(within(dialog).getByRole('button', { name: 'Save answer' }));
    await waitFor(() => expect(answer).toEqual({ status: 'QUOTED', note: 'Best terms' }));
  });
});

describe('MailLog', () => {
  beforeEach(() => {
    roles.current = ['ACCOUNT_MANAGER'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('lists mails newest first, loads more, and opens one with its message', async () => {
    const second = mailDetail({
      id: 'dddddddddddddddddddddd02',
      insurerName: 'Suraksha General, Fort',
      kind: 'REMINDER',
      result: 'FAILED',
      error: '550 refused',
      attachment: null,
    });
    serve((url) => {
      if (url.includes(`/proposals/${CASE_ID}/mails?`)) {
        return url.includes('cursor=')
          ? json({ items: [second], nextCursor: null })
          : json({ items: [mailDetail()], nextCursor: MAIL_ID });
      }
      if (url.endsWith(`/mails/${MAIL_ID}`)) return json(mailDetail());
      return undefined;
    });
    const user = renderWith(<MailLog proposalId={CASE_ID} />);
    const first = await screen.findByRole('button', { name: /Kavach General, Pune/ });
    expect(within(first).getByText('Delivered to the mail server')).toBeInTheDocument();
    expect(within(first).getByText('To pune@kavach.example')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    const reminder = await screen.findByRole('button', { name: /Suraksha General, Fort/ });
    expect(within(reminder).getByText('Reminder email')).toBeInTheDocument();
    expect(within(reminder).getByText('Failed')).toBeInTheDocument();

    await user.click(first);
    const sheet = await screen.findByRole('dialog', { name: 'RFQ email to Kavach General, Pune' });
    expect(await within(sheet).findByText(/Please find attached our request/)).toBeInTheDocument();
    expect(
      within(sheet).getByRole('button', { name: 'Download RFQ-PRP-2026-0042.xlsx' }),
    ).toBeInTheDocument();
  });

  it('shows the demo-mode state in demo mode', async () => {
    serve(() => json({ code: 'DEMO_MODE', message: 'Not available in demo mode.' }, 503));
    renderWith(<MailLog proposalId={CASE_ID} />);
    expect(await screen.findByText('Not available in demo mode')).toBeInTheDocument();
  });
});
