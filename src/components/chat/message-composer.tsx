'use client';

import { LoaderCircle, Paperclip, SendHorizontal, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { chatFileType, useSendMessage } from '@/lib/api/chat';
import { MAX_CHAT_FILE_BYTES, MAX_CHAT_TEXT } from '@/shared';
import { fileSize } from './chat-format';

/**
 * Types and sends a message, with a file if one is attached. Enter sends, Shift+Enter starts a new
 * line. A failed send keeps what was typed; sending it again reuses its id, so it is posted once.
 */
export function MessageComposer({ conversationId }: { conversationId: string }) {
  const send = useSendMessage(conversationId);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const clientId = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textId = useId();

  const ready = (text.trim() !== '' || file !== null) && !send.isPending;
  const submit = () => {
    if (!ready) return;
    clientId.current ??= crypto.randomUUID();
    send.mutate(
      { text, file, clientId: clientId.current },
      {
        onSuccess: () => {
          setText('');
          setFile(null);
          setProblem(null);
          clientId.current = null;
        },
      },
    );
  };
  const choose = (chosen: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!chosen) return;
    if (!chatFileType(chosen)) return setProblem('This kind of file cannot be shared in the chat.');
    if (chosen.size > MAX_CHAT_FILE_BYTES) return setProblem('The file is larger than 10 MB.');
    setProblem(null);
    clientId.current = null;
    setFile(chosen);
  };

  return (
    <form
      className="grid gap-2 border-t bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {file ? (
        <div className="flex items-center gap-2 justify-self-start rounded-md border bg-muted/50 px-2 py-1 text-sm">
          <Paperclip aria-hidden="true" className="size-4" />
          <span className="max-w-64 truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">{fileSize(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Remove ${file.name}`}
            onClick={() => setFile(null)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {problem || send.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? `Not sent: ${errorMessage(send.error)} Press Send to try again.`}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach a file"
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip aria-hidden="true" />
        </Button>
        <Label htmlFor={textId} className="sr-only">
          Message
        </Label>
        <Textarea
          id={textId}
          value={text}
          rows={1}
          maxLength={MAX_CHAT_TEXT}
          placeholder="Type a message"
          className="max-h-40 min-h-10 flex-1 resize-none"
          onChange={(event) => {
            setText(event.target.value);
            clientId.current = null;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={!ready} aria-label="Send">
          {send.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <SendHorizontal aria-hidden="true" />
          )}
        </Button>
      </div>
    </form>
  );
}
