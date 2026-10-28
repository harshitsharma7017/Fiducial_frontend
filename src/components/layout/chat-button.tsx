'use client';

import { MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useConversations } from '@/lib/api/chat';

/** The navbar's way into the chat, with how many messages are unread (kept live). */
export function ChatButton() {
  const conversations = useConversations();
  const unread = conversations.data?.unreadTotal ?? 0;
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
    >
      <Link href="/chat">
        <MessagesSquare aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground tabular"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
