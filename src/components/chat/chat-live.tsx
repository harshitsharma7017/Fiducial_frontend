'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from '@/hooks/use-toast';
import { upsertMessage } from '@/lib/api/chat';
import { queryKeys } from '@/lib/query-keys';
import { ChatEventSchema, type ChatEvent } from '@/shared';

// The chat's live connection (server-sent events through the BFF, GET chat/events): one per
// signed-in tab, opened by the app shell. New messages go straight into the caches; changes to
// conversations refresh them. The browser reconnects by itself, and a reconnect catches up on what
// was missed by refreshing every chat list.

export type ChatLiveStatus = 'off' | 'connecting' | 'live' | 'reconnecting';

const ChatLiveContext = createContext<ChatLiveStatus>('off');

/** The state of the live connection, for the chat page's "Reconnecting…" line. */
export function useChatLiveStatus(): ChatLiveStatus {
  return use(ChatLiveContext);
}

const EVENT_TYPES = ['message', 'conversation', 'read'] as const satisfies ChatEvent['type'][];

export function ChatLiveProvider({
  userId,
  enabled,
  children,
}: {
  /** The signed-in user (null while loading). */
  userId: string | null;
  /** Off in demo mode, where there is no API to connect to. */
  enabled: boolean;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const pathname = usePathname();
  const [status, setStatus] = useState<ChatLiveStatus>('connecting');
  const opened = useRef(false);
  const active = enabled && userId !== null && typeof EventSource !== 'undefined';

  const onEvent = useEffectEvent((event: ChatEvent) => {
    if (event.type === 'message') {
      upsertMessage(client, event.message);
      void client.invalidateQueries({ queryKey: queryKeys.chat.conversations });
      const { sender } = event.message;
      // Away from the chat, a new message from a colleague shows as a toast.
      if (
        sender &&
        sender.id !== userId &&
        !event.message.deleted &&
        !pathname.startsWith('/chat')
      ) {
        toast({
          title: `New message from ${sender.name}`,
          description: event.message.text || 'Sent a file',
        });
      }
      return;
    }
    if (event.type === 'conversation' && event.removed) {
      client.removeQueries({ queryKey: queryKeys.chat.messages(event.conversationId) });
      client.removeQueries({ queryKey: queryKeys.chat.conversation(event.conversationId) });
    } else if (event.type === 'conversation') {
      void client.invalidateQueries({
        queryKey: queryKeys.chat.conversation(event.conversationId),
      });
    }
    void client.invalidateQueries({ queryKey: queryKeys.chat.conversations });
  });

  useEffect(() => {
    if (!active) return;
    const source = new EventSource('/api/proxy/chat/events');
    source.onopen = () => {
      setStatus('live');
      // Back after a drop: refresh what may have changed meanwhile.
      if (opened.current) void client.invalidateQueries({ queryKey: queryKeys.chat.all });
      opened.current = true;
    };
    source.onerror = () =>
      setStatus(source.readyState === EventSource.CLOSED ? 'off' : 'reconnecting');
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (message: MessageEvent<string>) => {
        let data: unknown;
        try {
          data = JSON.parse(message.data);
        } catch {
          return;
        }
        const parsed = ChatEventSchema.safeParse(data);
        if (parsed.success) onEvent(parsed.data);
      });
    }
    return () => source.close();
  }, [active, client]);

  return <ChatLiveContext value={active ? status : 'off'}>{children}</ChatLiveContext>;
}
