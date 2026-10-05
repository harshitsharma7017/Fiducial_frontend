'use client';

import { useState, type ReactNode } from 'react';
import { ErrorState } from '@/components/states';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/use-current-user';
import { SidebarNav } from './sidebar-nav';
import { TopBar } from './top-bar';

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-active px-5">
      <span
        className="grid size-7 place-items-center rounded bg-accent text-xs font-bold text-accent-foreground"
        aria-hidden="true"
      >
        PE
      </span>
      <span className="grid leading-tight">
        <span className="text-sm font-semibold text-primary-foreground">Property ERP</span>
        <span className="text-[11px] text-sidebar-muted">Fiducial</span>
      </span>
    </div>
  );
}

/** Sidebar and top bar around every signed-in page. Below 1024px the sidebar becomes a drawer. */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  if (me.isPending) {
    return (
      <div className="flex min-h-screen" role="status" aria-live="polite">
        <span className="sr-only">Loading your workspace…</span>
        <div className="hidden w-60 bg-sidebar lg:block" />
        <div className="flex-1 p-8">
          <Skeleton className="mb-6 h-7 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (me.isError) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <ErrorState
          error={me.error}
          onRetry={() => void me.refetch()}
          title="Could not load your account"
        />
      </main>
    );
  }

  const user = me.data;
  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <Brand />
        <SidebarNav roles={user.roles} />
      </aside>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          className="w-64 border-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-64"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <Brand />
          <SidebarNav roles={user.roles} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} onOpenNav={() => setNavOpen(true)} />
        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
