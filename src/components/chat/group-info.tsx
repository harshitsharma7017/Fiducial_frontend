'use client';

import { Info, LoaderCircle, LogOut, UserMinus, UserPlus } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAddMembers, useLeaveGroup, useRemoveMember, useRenameGroup } from '@/lib/api/chat';
import { MAX_GROUP_NAME, type Conversation } from '@/shared';
import { ChatAvatar } from './chat-format';
import { ColleaguePicker } from './new-chat-dialog';

/**
 * A group's details: its members; for its admins, renaming it and adding or removing members;
 * for everyone, leaving it.
 */
export function GroupInfo({
  conversation,
  myId,
  onLeft,
}: {
  conversation: Conversation;
  myId: string;
  onLeft: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(conversation.title);
  const [adding, setAdding] = useState<string[] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const nameId = useId();
  const rename = useRenameGroup(conversation.id);
  const add = useAddMembers(conversation.id);
  const remove = useRemoveMember(conversation.id);
  const leave = useLeaveGroup(conversation.id);
  const error = rename.error ?? add.error ?? remove.error ?? leave.error;
  const admin = conversation.admin;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setName(conversation.title);
        setAdding(null);
        setConfirmLeave(false);
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Group info">
          <Info aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent className="grid content-start gap-5 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{conversation.title}</SheetTitle>
          <SheetDescription>
            {conversation.members.length} members.{' '}
            {admin ? 'You are an admin of this group.' : 'Its admins choose the members.'}
          </SheetDescription>
        </SheetHeader>

        {admin ? (
          <form
            className="grid gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) rename.mutate(name.trim());
            }}
          >
            <Label htmlFor={nameId}>Group name</Label>
            <div className="flex gap-2">
              <Input
                id={nameId}
                value={name}
                maxLength={MAX_GROUP_NAME}
                onChange={(event) => setName(event.target.value)}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={rename.isPending || !name.trim() || name.trim() === conversation.title}
              >
                {rename.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Rename
              </Button>
            </div>
          </form>
        ) : null}

        <section aria-label="Members" className="grid gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Members</h3>
            {admin && adding === null ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding([])}>
                <UserPlus aria-hidden="true" />
                Add members
              </Button>
            ) : null}
          </div>
          {adding !== null ? (
            <div className="grid gap-2 rounded-md border p-2">
              <ColleaguePicker
                multiple
                chosen={adding}
                onChoose={setAdding}
                exclude={conversation.members.map((member) => member.id)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={adding.length === 0 || add.isPending}
                  onClick={() => add.mutate(adding, { onSuccess: () => setAdding(null) })}
                >
                  Add {adding.length > 0 ? adding.length : ''}
                </Button>
              </div>
            </div>
          ) : null}
          <ul className="grid gap-1">
            {conversation.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                <ChatAvatar name={member.name} className="size-8" />
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <span className="truncate">{member.id === myId ? 'You' : member.name}</span>
                  {member.admin ? <Badge variant="info">Admin</Badge> : null}
                  {!member.active ? <Badge variant="muted">Inactive</Badge> : null}
                </span>
                {admin && member.id !== myId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={remove.isPending}
                    aria-label={`Remove ${member.name}`}
                    onClick={() => remove.mutate(member.id)}
                  >
                    <UserMinus aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        {confirmLeave ? (
          <div
            role="group"
            aria-label="Leave the group"
            className="grid gap-2 rounded-md border p-3"
          >
            <p className="text-sm">
              Leave “{conversation.title}”? You will no longer see its messages.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={leave.isPending}
                onClick={() =>
                  leave.mutate(myId, {
                    onSuccess: () => {
                      setOpen(false);
                      onLeft();
                    },
                  })
                }
              >
                {leave.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Leave
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmLeave(false)}
              >
                Stay
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start text-destructive"
            onClick={() => setConfirmLeave(true)}
          >
            <LogOut aria-hidden="true" />
            Leave group
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
