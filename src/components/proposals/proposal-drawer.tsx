'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useProposal } from '@/lib/api/proposals';
import { ProposalSections } from './sections/proposal-sections';

export interface DrawerTarget {
  id: string;
  /** The control that opened the drawer; focus returns here on close. */
  trigger: HTMLButtonElement | null;
}

/**
 * The proposal components in a right-side drawer, full screen below 640 px. It loads the proposal
 * by id, shows a skeleton or error while it does, and returns focus to the opening control.
 */
export function ProposalDrawer({
  target,
  onClose,
}: {
  target: DrawerTarget | null;
  onClose: () => void;
}) {
  // Remember the trigger so focus can return to it after the close animation, when `target` is
  // already null. Written in an effect, not during render.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (target) triggerRef.current = target.trigger;
  }, [target]);

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;
          if (trigger && trigger.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        {target ? <DrawerBody id={target.id} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ id }: { id: string }) {
  const proposal = useProposal(id);

  return (
    <>
      <SheetHeader>
        {proposal.data ? (
          <>
            <SheetTitle>{proposal.data.client.name}</SheetTitle>
            <SheetDescription className="tabular">
              {proposal.data.reference} · {proposal.data.client.city}
            </SheetDescription>
          </>
        ) : (
          <>
            <SheetTitle>Proposal</SheetTitle>
            <SheetDescription>Loading the proposal details.</SheetDescription>
          </>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-5">
        {proposal.isPending ? (
          <LoadingState label="Loading proposal" />
        ) : proposal.isError ? (
          <ErrorState error={proposal.error} onRetry={() => void proposal.refetch()} />
        ) : (
          <ProposalSections proposal={proposal.data} />
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t p-4">
        {proposal.data ? (
          <Button asChild variant="outline">
            <Link href={`/proposals/${proposal.data.id}`}>Open full proposal</Link>
          </Button>
        ) : null}
        <SheetClose asChild>
          <Button variant="ghost">Close</Button>
        </SheetClose>
      </div>
    </>
  );
}
