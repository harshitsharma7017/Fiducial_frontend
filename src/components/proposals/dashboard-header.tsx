'use client';

import { FilePlus2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { useIstNow } from '@/hooks/use-ist-now';
import { can, formatDate } from '@/shared';
import type { ProposalType } from '@/types/proposal';

function greeting(hourIst: number): string {
  if (hourIst < 12) return 'Good morning';
  if (hourIst < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The IST hour (0-23) for an instant. */
function istHour(nowMs: number): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hour12: false,
      }).format(nowMs),
    ) % 24
  );
}

/**
 * Greeting with the user's first name, today's IST date, and the type's primary action, shown
 * only to users who may create proposals (proposals.create).
 */
export function DashboardHeader({ type }: { type: ProposalType }) {
  const me = useCurrentUser();
  const nowMs = useIstNow();
  const firstName = me.data?.name.split(/\s+/)[0];
  const canCreate = me.data ? can(me.data.roles, 'proposals.create') : false;
  // New business comes from the API; renewals (and everything in demo mode) are still samples.
  const sampleNote = useDemoMode()
    ? 'Demo mode: sample proposals.'
    : type === 'EXISTING'
      ? 'Sample data: renewals are not connected to the API yet.'
      : 'New business proposals.';

  const action =
    type === 'EXISTING'
      ? { label: 'Start renewal', href: '/proposals/new?type=existing', icon: RefreshCcw }
      : { label: 'New proposal', href: '/proposals/new?type=new', icon: FilePlus2 };
  const ActionIcon = action.icon;

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          {/* Greeting and date come from the browser clock, so the server render differs. */}
          <span suppressHydrationWarning>
            {nowMs === null || !firstName
              ? 'Dashboard'
              : `${greeting(istHour(nowMs))}, ${firstName}`}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {nowMs === null ? (
            <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted align-middle" />
          ) : (
            `${formatDate(new Date(nowMs))} · `
          )}
          {sampleNote}
        </p>
      </div>
      {canCreate ? (
        <Button asChild variant="accent">
          <Link href={action.href}>
            <ActionIcon aria-hidden="true" />
            {action.label}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
