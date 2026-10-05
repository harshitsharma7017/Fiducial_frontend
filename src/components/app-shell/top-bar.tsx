'use client';

import { ROLE_LABELS, type User } from '@property-erp/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
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
import { toast } from '@/hooks/use-toast';

export function rolesLabel(user: Pick<User, 'roles'>): string {
  return user.roles.map((role) => ROLE_LABELS[role]).join(', ');
}

export function TopBar({ user, onOpenNav }: { user: User; onOpenNav: () => void }) {
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out failed');
      queryClient.clear();
      // A full page load on purpose: nothing from the ended session stays in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    } catch {
      setSigningOut(false);
      toast({ title: 'Could not sign out', description: 'Try again.', variant: 'destructive' });
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>
      <span className="font-semibold text-primary lg:hidden">Property ERP</span>
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto gap-3 py-1.5 text-left">
              <span className="grid leading-tight">
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{rolesLabel(user)}</span>
              </span>
              <ChevronDown aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="grid gap-0.5">
              <span>{user.name}</span>
              <span className="text-xs font-normal break-all text-muted-foreground">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
              <LogOut aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
