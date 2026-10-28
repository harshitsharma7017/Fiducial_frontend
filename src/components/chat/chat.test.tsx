import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import { chatFileType, messagesOf, upsertMessage, type MessagePages } from '@/lib/api/chat';
import { queryKeys } from '@/lib/query-keys';
import type { ChatMessage, Conversation } from '@/shared';
import { ChatLiveProvider } from './chat-live';
import { ConversationList } from './conversation-list';
import { MessageThread } from './message-thread';
import { NewChatDialog } from './new-chat-dialog';

// The internal chat (client review, 27 Oct 2026).

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ toast: toastMock }));
const pathname = vi.hoisted(() => ({ current: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const ME = 'a'.repeat(24);
const RAVI = 'b'.repeat(24);
const CHAT = 'c'.repeat(24);

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '1'.repeat(24),
    conversationId: CHAT,
    kind: 'TEXT',
    sender: { id: RAVI, name: 'Ravi Mehta' },
    text: 'Hello Asha',
    attachment: null,
    clientId: null,
    deleted: false,
    createdAt: '2026-10-28T05:00:00.000Z',
    ...overrides,
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CHAT,
    kind: 'DIRECT',
    title: 'Ravi Mehta',
    members: [
      { id: ME, name: 'Asha Rao', admin: false, active: true },
      { id: RAVI, name: 'Ravi Mehta', admin: false, active: true },
    ],
    admin: false,
    lastMessage: { text: 'Hello Asha', senderName: 'Ravi Mehta', at: '2026-10-28T05:00:00.000Z' },
    unread: 1,
    createdAt: '2026-10-28T04:00:00.000Z',
    updatedAt: '2026-10-28T05:00:00.000Z',
    ...overrides,
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderWith(
  children: ReactNode,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
  return { user: userEvent.setup({ delay: null }), client };
}

/** A stand-in for the browser's EventSource that the test drives. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  static readonly CLOSED = 2;
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, listener);
  }
  emit(type: string, data: unknown) {
    this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  fetchMock.mockReset();
  toastMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

describe('the live connection', () => {
  it('puts a new message into the open chat and tells the user away from the chat', () => {
    pathname.current = '/dashboard';
    fetchMock.mockResolvedValue(json({ items: [], unreadTotal: 0 }));
    const { client } = renderWith(
      <ChatLiveProvider userId={ME} enabled>
        <span>App</span>
      </ChatLiveProvider>,
    );
    const pages: MessagePages = { pages: [{ items: [], hasMore: false }], pageParams: [null] };
    client.setQueryData(queryKeys.chat.messages(CHAT), pages);
    const source = FakeEventSource.last!;
    expect(source.url).toBe('/api/proxy/chat/events');
    act(() => {
      source.onopen?.();
      source.emit('message', { type: 'message', conversationId: CHAT, message: message() });
    });
    expect(messagesOf(client.getQueryData(queryKeys.chat.messages(CHAT)))).toHaveLength(1);
    expect(toastMock).toHaveBeenCalledWith({
      title: 'New message from Ravi Mehta',
      description: 'Hello Asha',
    });
    // Not for one's own message.
    act(() =>
      source.emit('message', {
        type: 'message',
        conversationId: CHAT,
        message: message({ id: '2'.repeat(24), sender: { id: ME, name: 'Asha Rao' } }),
      }),
    );
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it('opens no connection in demo mode', () => {
    FakeEventSource.last = null;
    renderWith(
      <ChatLiveProvider userId={ME} enabled={false}>
        <span>App</span>
      </ChatLiveProvider>,
    );
    expect(FakeEventSource.last).toBeNull();
  });
});

describe('a conversation', () => {
  it('shows the messages, marks them read, sends and deletes', async () => {
    let sent: { text: string; clientId: string } | undefined;
    let read = false;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/read')) {
        read = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/messages') && init?.method === 'POST') {
        sent = JSON.parse(init.body as string) as typeof sent;
        return Promise.resolve(
          json(
            message({
              id: '3'.repeat(24),
              sender: { id: ME, name: 'Asha Rao' },
              text: 'On my way',
              clientId: sent?.clientId ?? null,
            }),
            201,
          ),
        );
      }
      if (url.includes('/messages/') && init?.method === 'DELETE') {
        return Promise.resolve(
          json(
            message({
              id: '3'.repeat(24),
              sender: { id: ME, name: 'Asha Rao' },
              text: '',
              deleted: true,
            }),
          ),
        );
      }
      if (url.includes('/messages'))
        return Promise.resolve(json({ items: [message()], hasMore: false }));
      if (url.endsWith('/chat/conversations')) {
        return Promise.resolve(
          json({ items: [conversation({ unread: read ? 0 : 1 })], unreadTotal: read ? 0 : 1 }),
        );
      }
      return Promise.resolve(json(conversation()));
    });
    const { user } = renderWith(
      <MessageThread conversationId={CHAT} myId={ME} onBack={() => {}} onLeft={() => {}} />,
    );
    expect(await screen.findByText('Hello Asha')).toBeInTheDocument();
    await waitFor(() => expect(read).toBe(true));

    await user.type(screen.getByLabelText('Message'), 'On my way{Enter}');
    expect(await screen.findByText('On my way')).toBeInTheDocument();
    expect(sent?.text).toBe('On my way');
    expect(sent?.clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByLabelText('Message')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: /Options for your message/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete for everyone' }));
    expect(await screen.findByText('This message was deleted')).toBeInTheDocument();
  });
});

describe('the chats list', () => {
  it('lists chats with their last message and unread count, and searches them', async () => {
    fetchMock.mockResolvedValue(
      json({
        items: [
          conversation(),
          conversation({
            id: 'd'.repeat(24),
            kind: 'GROUP',
            title: 'Renewals team',
            unread: 0,
            lastMessage: { text: 'Done', senderName: 'Asha Rao', at: '2026-10-27T05:00:00.000Z' },
          }),
        ],
        unreadTotal: 1,
      }),
    );
    const onSelect = vi.fn();
    const { user } = renderWith(
      <ConversationList
        selectedId={null}
        myName="Asha Rao"
        today="28 Oct 2026"
        onSelect={onSelect}
      />,
    );
    const chats = await screen.findByRole('list', { name: 'Chats' });
    const ravi = within(chats).getByRole('button', { name: /Ravi Mehta/ });
    expect(ravi).toHaveTextContent('1 unread');
    expect(ravi).toHaveTextContent('10:30');
    // A group shows who wrote last; an older message shows its day.
    const group = within(chats).getByRole('button', { name: /Renewals team/ });
    expect(group).toHaveTextContent('You: Done');
    expect(group).toHaveTextContent('27 Oct 2026');
    await user.type(screen.getByLabelText('Search chats'), 'renew');
    expect(within(chats).queryByRole('button', { name: /Ravi Mehta/ })).not.toBeInTheDocument();
    await user.click(within(chats).getByRole('button', { name: /Renewals team/ }));
    expect(onSelect).toHaveBeenCalledWith('d'.repeat(24));
  });

  it('starts a direct chat and creates a group', async () => {
    const posts: { url: string; body: unknown }[] = [];
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(init.body as string) });
        return Promise.resolve(
          json(conversation({ id: url.endsWith('groups') ? 'd'.repeat(24) : CHAT })),
        );
      }
      return Promise.resolve(
        json({
          items: [
            { id: RAVI, name: 'Ravi Mehta', email: 'ravi@example.com' },
            { id: 'e'.repeat(24), name: 'Meena Iyer', email: 'meena@example.com' },
          ],
        }),
      );
    });
    const onOpened = vi.fn();
    const { user } = renderWith(
      <>
        <NewChatDialog mode="direct" onOpened={onOpened} />
        <NewChatDialog mode="group" onOpened={onOpened} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await user.click(await screen.findByRole('button', { name: /Ravi Mehta/ }));
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(CHAT));
    expect(posts[0]).toEqual({
      url: expect.stringContaining('/chat/conversations/direct') as string,
      body: { userId: RAVI },
    });

    await user.click(screen.getByRole('button', { name: 'New group' }));
    const dialog = await screen.findByRole('dialog', { name: 'New group' });
    await user.type(within(dialog).getByLabelText('Group name'), 'Renewals team');
    await user.click(await within(dialog).findByLabelText(/Ravi Mehta/));
    await user.click(within(dialog).getByLabelText(/Meena Iyer/));
    await user.click(within(dialog).getByRole('button', { name: 'Create group (3 members)' }));
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith('d'.repeat(24)));
    expect(posts[1]?.body).toEqual({ name: 'Renewals team', memberIds: [RAVI, 'e'.repeat(24)] });
  });
});

describe('chat helpers', () => {
  it('replaces a known message and appends a new one', () => {
    const client = new QueryClient();
    client.setQueryData<MessagePages>(queryKeys.chat.messages(CHAT), {
      pages: [
        { items: [message()], hasMore: true },
        { items: [message({ id: '0'.repeat(24) })], hasMore: false },
      ],
      pageParams: [null, '1'.repeat(24)],
    });
    upsertMessage(client, message({ deleted: true, text: '' }));
    upsertMessage(client, message({ id: '9'.repeat(24), text: 'Newest' }));
    const all = messagesOf(client.getQueryData(queryKeys.chat.messages(CHAT)));
    expect(all.map((item) => [item.id[0], item.deleted, item.text])).toEqual([
      ['0', false, 'Hello Asha'],
      ['1', true, ''],
      ['9', false, 'Newest'],
    ]);
  });

  it('knows a file’s type by its extension when the browser does not', () => {
    expect(chatFileType(new File(['x'], 'mail.eml', { type: '' }))).toBe('message/rfc822');
    expect(chatFileType(new File(['x'], 'photo.JPEG', { type: '' }))).toBe('image/jpeg');
    expect(
      chatFileType(new File(['x'], 'run.exe', { type: 'application/x-msdownload' })),
    ).toBeNull();
  });
});
