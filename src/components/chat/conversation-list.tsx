'use client';

import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConversations } from '@/lib/api/chat';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/shared';
import { ChatAvatar, chatDay, chatTime } from './chat-format';
import { NewChatDialog } from './new-chat-dialog';

/** The line under a conversation's name: the last message, with its sender in a group. */
function preview(conversation: Conversation, myName: string | null): string {
  const last = conversation.lastMessage;
  if (!last) return conversation.kind === 'GROUP' ? 'No messages yet' : 'Say hello';
  if (!last.senderName) return last.text;
  const who = last.senderName === myName ? 'You' : last.senderName.split(' ')[0];
  return conversation.kind === 'GROUP' || who === 'You' ? `${who}: ${last.text}` : last.text;
}

/** The user's chats and groups, most recent first, with their unread counts. */
export function ConversationList({
  selectedId,
  myName,
  today,
  onSelect,
}: {
  selectedId: string | null;
  myName: string | null;
  /** Today's date as chatDay writes it: today's messages show their time, older ones the day. */
  today: string;
  onSelect: (id: string) => void;
}) {
  const conversations = useConversations();
  const [search, setSearch] = useState('');
  const searchId = useId();
  const needle = search.trim().toLowerCase();
  const items = (conversations.data?.items ?? []).filter(
    (item) => !needle || item.title.toLowerCase().includes(needle),
  );

  return (
    <section aria-labelledby={`${searchId}-title`} className="flex min-h-0 flex-col">
      <div className="grid gap-3 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${searchId}-title`} className="text-base font-semibold">
            Chats
          </h2>
          <div className="flex gap-2">
            <NewChatDialog mode="group" onOpened={onSelect} />
            <NewChatDialog mode="direct" onOpened={onSelect} />
          </div>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Label htmlFor={searchId} className="sr-only">
            Search chats
          </Label>
          <Input
            id={searchId}
            value={search}
            placeholder="Search chats"
            className="pl-8"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.isPending ? (
          <LoadingState label="Loading chats" className="p-4" />
        ) : conversations.isError ? (
          <div className="p-3">
            <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="m-3"
            title={needle ? 'No chat matches' : 'No chats yet'}
            description={needle ? undefined : 'Start a chat with a colleague, or a group.'}
          />
        ) : (
          <ul aria-label="Chats">
            {items.map((conversation) => {
              const selected = conversation.id === selectedId;
              const at = conversation.lastMessage?.at ?? conversation.createdAt;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(conversation.id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none',
                      selected && 'bg-primary-soft/50',
                    )}
                  >
                    <ChatAvatar name={conversation.title} group={conversation.kind === 'GROUP'} />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{conversation.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {chatDay(at) === today ? chatTime(at) : chatDay(at)}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-xs',
                            conversation.unread > 0
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {preview(conversation, myName)}
                        </span>
                        {conversation.unread > 0 ? (
                          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-success px-1.5 text-[11px] font-semibold text-white tabular">
                            {conversation.unread}
                            <span className="sr-only"> unread</span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
