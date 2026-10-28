'use client';

import { LoaderCircle, MessageSquarePlus, Search, UsersRound } from 'lucide-react';
import { useId, useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChatDirectory, useCreateGroup, useOpenDirectChat } from '@/lib/api/chat';
import { MAX_GROUP_NAME, type ChatUser } from '@/shared';
import { ChatAvatar } from './chat-format';

/**
 * Colleagues to choose from, searchable by name or email. One is chosen for a direct chat;
 * several, with checkboxes, for a group. Colleagues in `exclude` (already members) are left out.
 */
export function ColleaguePicker({
  multiple,
  chosen,
  onChoose,
  exclude = [],
}: {
  multiple: boolean;
  chosen: readonly string[];
  onChoose: (ids: string[]) => void;
  exclude?: readonly string[];
}) {
  const directory = useChatDirectory();
  const [search, setSearch] = useState('');
  const searchId = useId();
  if (directory.isPending) return <LoadingState label="Loading colleagues" />;
  if (directory.isError) {
    return <ErrorState error={directory.error} onRetry={() => void directory.refetch()} />;
  }
  const needle = search.trim().toLowerCase();
  const people = directory.data.items.filter(
    (person) =>
      !exclude.includes(person.id) &&
      (!needle ||
        person.name.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle)),
  );
  const toggle = (person: ChatUser, on: boolean) =>
    onChoose(on ? [...chosen, person.id] : chosen.filter((id) => id !== person.id));

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Label htmlFor={searchId} className="sr-only">
          Search colleagues
        </Label>
        <Input
          id={searchId}
          value={search}
          placeholder="Search by name or email"
          className="pl-8"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {people.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No colleagues found.</p>
      ) : (
        <ul className="grid max-h-72 gap-1 overflow-y-auto" aria-label="Colleagues">
          {people.map((person) => {
            const id = `colleague-${person.id}`;
            const label = (
              <span className="grid text-left">
                <span className="text-sm font-medium">{person.name}</span>
                <span className="text-xs text-muted-foreground">{person.email}</span>
              </span>
            );
            return (
              <li key={person.id}>
                {multiple ? (
                  <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                    <Checkbox
                      id={id}
                      checked={chosen.includes(person.id)}
                      onCheckedChange={(value) => toggle(person, value === true)}
                    />
                    <ChatAvatar name={person.name} className="size-8" />
                    <Label htmlFor={id} className="flex-1 font-normal">
                      {label}
                    </Label>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => onChoose([person.id])}
                  >
                    <ChatAvatar name={person.name} className="size-8" />
                    {label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Starts a direct chat with a colleague, or a new group. */
export function NewChatDialog({
  mode,
  onOpened,
}: {
  mode: 'direct' | 'group';
  onOpened: (conversationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const nameId = useId();
  const direct = useOpenDirectChat();
  const group = useCreateGroup();
  const pending = direct.isPending || group.isPending;
  const error = direct.error ?? group.error;
  const reset = () => {
    setName('');
    setMembers([]);
    direct.reset();
    group.reset();
  };
  const done = (conversationId: string) => {
    setOpen(false);
    reset();
    onOpened(conversationId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={mode === 'direct' ? 'default' : 'outline'} size="sm">
          {mode === 'direct' ? (
            <MessageSquarePlus aria-hidden="true" />
          ) : (
            <UsersRound aria-hidden="true" />
          )}
          {mode === 'direct' ? 'New chat' : 'New group'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'direct' ? 'New chat' : 'New group'}</DialogTitle>
          <DialogDescription>
            {mode === 'direct'
              ? 'Choose a colleague to message.'
              : 'Name the group and choose its members. You will be its admin.'}
          </DialogDescription>
        </DialogHeader>
        {mode === 'group' ? (
          <div className="grid gap-1">
            <Label htmlFor={nameId}>Group name</Label>
            <Input
              id={nameId}
              value={name}
              maxLength={MAX_GROUP_NAME}
              placeholder="For example, Renewals team"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        ) : null}
        <ColleaguePicker
          multiple={mode === 'group'}
          chosen={members}
          onChoose={(ids) => {
            if (mode === 'direct') {
              const [userId] = ids;
              if (userId && !pending) direct.mutate(userId, { onSuccess: (chat) => done(chat.id) });
            } else setMembers(ids);
          }}
        />
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        {mode === 'group' ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim() || members.length === 0}
              onClick={() =>
                group.mutate(
                  { name: name.trim(), memberIds: members },
                  { onSuccess: (chat) => done(chat.id) },
                )
              }
            >
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Create group{members.length > 0 ? ` (${members.length + 1} members)` : ''}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
