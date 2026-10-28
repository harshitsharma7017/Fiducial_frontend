'use client';

import { MessagesSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConversationList } from '@/components/chat/conversation-list';
import { chatDay } from '@/components/chat/chat-format';
import { MessageThread } from '@/components/chat/message-thread';
import { PageHeader } from '@/components/page-header';
import { EmptyState, LoadingState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { useIstNow } from '@/hooks/use-ist-now';
import { cn } from '@/lib/utils';

/**
 * The internal chat (client review, 27 Oct 2026): the user's chats and groups beside the open
 * conversation, as in a messaging app; on small screens one at a time. Messages arrive live.
 */
export function ChatView({ initialId }: { initialId: string | null }) {
  const router = useRouter();
  const me = useCurrentUser();
  const demo = useDemoMode();
  const nowMs = useIstNow();
  const [selected, setSelected] = useState<string | null>(initialId);

  const select = (id: string | null) => {
    setSelected(id);
    router.replace(id ? `/chat?c=${id}` : '/chat', { scroll: false });
  };

  if (demo) {
    return (
      <>
        <PageHeader title="Chat" description="Message colleagues one to one and in groups." />
        <EmptyState
          title="Not available in demo mode"
          description="The chat needs the live API (Fiducial_backend)."
        />
      </>
    );
  }
  if (!me.data) return <LoadingState label="Loading the chat" />;
  const myId = me.data.id;

  return (
    <>
      <PageHeader
        title="Chat"
        description="Message colleagues one to one and in groups, and share files."
      />
      <div className="grid h-[calc(100dvh-13rem)] min-h-[28rem] overflow-hidden rounded-lg border bg-card lg:grid-cols-[22rem_1fr]">
        <div
          className={cn(
            'min-h-0 border-r lg:flex lg:flex-col',
            selected ? 'hidden' : 'flex flex-col',
          )}
        >
          <ConversationList
            selectedId={selected}
            myName={me.data.name}
            today={nowMs === null ? '' : chatDay(new Date(nowMs).toISOString())}
            onSelect={select}
          />
        </div>
        <div className={cn('min-h-0 lg:flex lg:flex-col', selected ? 'flex flex-col' : 'hidden')}>
          {selected ? (
            <MessageThread
              key={selected}
              conversationId={selected}
              myId={myId}
              onBack={() => select(null)}
              onLeft={() => select(null)}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              <EmptyState
                icon={<MessagesSquare aria-hidden="true" className="size-8" />}
                title="Choose a chat"
                description="Pick a conversation on the left, or start a new chat or group."
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
