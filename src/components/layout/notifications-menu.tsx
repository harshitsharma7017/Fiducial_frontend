'use client';

import { Bell, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useIstNow } from '@/hooks/use-ist-now';
import { useNotifications } from '@/lib/api/notifications';
import { formatRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/shared';

/** Sample notifications with relative times. The read state lives in memory until a reload. */
export function NotificationsMenu() {
  const notifications = useNotifications();
  const nowMs = useIstNow();
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());

  const items = notifications.data ?? [];
  const isUnread = (id: string, unread: boolean) => unread && !readIds.has(id);
  const unreadCount = items.filter((item) => isUnread(item.id, item.unread)).length;
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  function markRead(id: string) {
    setReadIds((current) => new Set(current).add(id));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground tabular"
            >
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <span className="text-xs text-muted-foreground">Sample data</span>
        </div>

        {notifications.isPending ? (
          <div role="status" className="grid gap-3 p-3">
            <span className="sr-only">Loading notifications…</span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : notifications.isError ? (
          <DropdownMenuItem
            className="m-1 text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              void notifications.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" />
            Could not load notifications. Try again
          </DropdownMenuItem>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {items.map((item) => {
              const unread = isUnread(item.id, item.unread);
              return (
                <DropdownMenuItem
                  key={item.id}
                  asChild
                  className="items-start gap-3 rounded-none px-3 py-2.5"
                >
                  <Link href={`/proposals/${item.proposalId}`} onClick={() => markRead(item.id)}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        unread ? 'bg-accent' : 'bg-transparent',
                      )}
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium">
                        {unread ? <span className="sr-only">Unread: </span> : null}
                        {item.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                      <span className="text-xs text-muted-foreground tabular">
                        {nowMs === null
                          ? formatDateTime(item.at)
                          : formatRelativeTime(item.at, nowMs)}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {items.length > 0 ? (
          <>
            <DropdownMenuSeparator className="my-0" />
            <DropdownMenuItem
              disabled={unreadCount === 0}
              className="justify-center rounded-none py-2"
              onSelect={(event) => {
                event.preventDefault();
                setReadIds(new Set(items.map((item) => item.id)));
              }}
            >
              Mark all as read
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
