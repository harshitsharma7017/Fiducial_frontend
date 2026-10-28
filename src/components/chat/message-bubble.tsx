'use client';

import { useMutation } from '@tanstack/react-query';
import { Ban, Download, EllipsisVertical, FileText, LoaderCircle } from 'lucide-react';
import { errorMessage } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { apiDownload, saveFile } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { ChatAttachment, ChatMessage } from '@/shared';
import { chatTime, fileSize } from './chat-format';

function AttachmentChip({
  conversationId,
  attachment,
  mine,
}: {
  conversationId: string;
  attachment: ChatAttachment;
  mine: boolean;
}) {
  const download = useMutation({
    mutationFn: () =>
      apiDownload(
        `chat/conversations/${conversationId}/files/${attachment.id}`,
        attachment.fileName,
      ),
    onSuccess: (file) => saveFile(file),
    onError: (error) =>
      toast({
        title: 'Could not download',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });
  return (
    <button
      type="button"
      disabled={download.isPending}
      onClick={() => download.mutate()}
      className={cn(
        'flex w-full max-w-72 items-center gap-2 rounded-md border px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        mine ? 'border-primary/20 bg-background/70' : 'bg-muted/60',
      )}
    >
      <FileText aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{attachment.fileName}</span>
        <span className="text-xs text-muted-foreground">{fileSize(attachment.size)}</span>
      </span>
      {download.isPending ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
      <span className="sr-only">Download</span>
    </button>
  );
}

/**
 * One message: the user's own on the right, others' on the left with the sender's name in a
 * group; system lines in the middle. The user may delete their own message for everyone.
 */
export function MessageBubble({
  message,
  mine,
  showSender,
  onDelete,
}: {
  message: ChatMessage;
  mine: boolean;
  showSender: boolean;
  onDelete: () => void;
}) {
  if (message.kind === 'SYSTEM') {
    return (
      <li className="my-1 flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.text}
        </span>
      </li>
    );
  }
  return (
    <li className={cn('group flex items-start gap-1', mine ? 'justify-end' : 'justify-start')}>
      {mine && !message.deleted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Options for your message sent at ${chatTime(message.createdAt)}`}
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDelete} className="text-destructive">
              Delete for everyone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <div
        className={cn(
          'grid max-w-[min(36rem,80%)] gap-1 rounded-lg px-3 py-2 shadow-xs',
          mine ? 'rounded-tr-sm bg-primary-soft' : 'rounded-tl-sm border bg-card',
        )}
      >
        {showSender && message.sender ? (
          <span className="text-xs font-semibold text-accent-strong">{message.sender.name}</span>
        ) : null}
        {message.deleted ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground italic">
            <Ban aria-hidden="true" className="size-3.5" />
            This message was deleted
          </span>
        ) : (
          <>
            {message.attachment ? (
              <AttachmentChip
                conversationId={message.conversationId}
                attachment={message.attachment}
                mine={mine}
              />
            ) : null}
            {message.text ? (
              <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
            ) : null}
          </>
        )}
        <span className="justify-self-end text-[11px] text-muted-foreground tabular">
          {chatTime(message.createdAt)}
        </span>
      </div>
    </li>
  );
}
