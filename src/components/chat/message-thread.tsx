'use client';

import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  messagesOf,
  useConversation,
  useConversations,
  useDeleteMessage,
  useMarkRead,
  useMessages,
} from '@/lib/api/chat';
import { ChatAvatar, chatDay } from './chat-format';
import { useChatLiveStatus } from './chat-live';
import { GroupInfo } from './group-info';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';

/** How close to the bottom (px) still counts as reading the latest messages. */
const NEAR_BOTTOM = 80;

/**
 * One conversation: its messages, newest at the bottom (older ones on request), and the composer.
 * New messages scroll into view while the user is at the bottom; the conversation is marked read
 * while it is on screen.
 */
export function MessageThread({
  conversationId,
  myId,
  onBack,
  onLeft,
}: {
  conversationId: string;
  myId: string;
  /** Back to the list (small screens). */
  onBack: () => void;
  onLeft: () => void;
}) {
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const list = useConversations();
  const markRead = useMarkRead();
  const remove = useDeleteMessage(conversationId);
  const live = useChatLiveStatus();
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const shown = useRef<{ first?: string; last?: string; height: number }>({ height: 0 });

  const items = messagesOf(messages.data);
  const first = items[0]?.id;
  const last = items.at(-1);
  const unread = list.data?.items.find((item) => item.id === conversationId)?.unread ?? 0;

  // New at the bottom: follow it when reading the latest (or it is one's own). Older above:
  // keep the messages in view where they were.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const before = shown.current;
    if (before.first !== undefined && first !== before.first && last?.id === before.last) {
      element.scrollTop += element.scrollHeight - before.height;
    } else if (last?.id !== before.last && (atBottom.current || last?.sender?.id === myId)) {
      element.scrollTop = element.scrollHeight;
    }
    shown.current = { first, last: last?.id, height: element.scrollHeight };
  }, [first, last, myId]);

  // Read while on screen: now, and as messages arrive.
  const { mutate } = markRead;
  useEffect(() => {
    const read = () => {
      if (unread > 0 && document.visibilityState === 'visible') mutate(conversationId);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [conversationId, unread, mutate]);

  if (conversation.isPending) return <LoadingState label="Opening the chat" className="p-6" />;
  if (conversation.isError) {
    return (
      <div className="p-4">
        <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />
      </div>
    );
  }
  const chat = conversation.data;
  const group = chat.kind === 'GROUP';
  const others = chat.members.filter((member) => member.id !== myId);

  return (
    <section aria-label={`Chat with ${chat.title}`} className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b bg-card px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Back to chats"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <ChatAvatar name={chat.title} group={group} />
        <div className="grid min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{chat.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {live === 'reconnecting'
              ? 'Reconnecting…'
              : group
                ? ['You', ...others.map((member) => member.name)].join(', ')
                : others[0]?.active === false
                  ? 'No longer active'
                  : 'Direct message'}
          </p>
        </div>
        {group ? <GroupInfo conversation={chat} myId={myId} onLeft={onLeft} /> : null}
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-3 py-3"
        onScroll={(event) => {
          const element = event.currentTarget;
          atBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM;
        }}
      >
        {messages.isPending ? (
          <LoadingState label="Loading messages" />
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        ) : (
          <>
            {messages.hasNextPage ? (
              <div className="mb-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={messages.isFetchingNextPage}
                  onClick={() => void messages.fetchNextPage()}
                >
                  {messages.isFetchingNextPage ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Load earlier messages
                </Button>
              </div>
            ) : null}
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. Say hello.
              </p>
            ) : (
              <ol aria-label="Messages" aria-live="polite" className="grid gap-1.5">
                {items.map((message, index) => {
                  const previous = items[index - 1];
                  const newDay =
                    !previous || chatDay(previous.createdAt) !== chatDay(message.createdAt);
                  const sameSender =
                    !newDay &&
                    previous?.kind === 'TEXT' &&
                    previous.sender?.id === message.sender?.id;
                  return (
                    <Fragment key={message.id}>
                      {newDay ? (
                        <li className="my-2 flex justify-center" aria-hidden="true">
                          <span className="rounded-md bg-card px-2 py-0.5 text-xs text-muted-foreground shadow-xs">
                            {chatDay(message.createdAt)}
                          </span>
                        </li>
                      ) : null}
                      <MessageBubble
                        message={message}
                        mine={message.sender?.id === myId}
                        showSender={group && message.sender?.id !== myId && !sameSender}
                        onDelete={() =>
                          remove.mutate(message.id, {
                            onError: (error) =>
                              toast({
                                title: 'Could not delete',
                                description: errorMessage(error),
                                variant: 'destructive',
                              }),
                          })
                        }
                      />
                    </Fragment>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>

      <MessageComposer conversationId={conversationId} />
    </section>
  );
}
