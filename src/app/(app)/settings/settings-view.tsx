'use client';

import { PageHeader } from '@/components/page-header';
import { MasterDataCard } from '@/components/settings/master-data-card';
import { SystemStatusCard } from '@/components/settings/system-status-card';
import { AccessDeniedState, DemoModeState, LoadingState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { hasRole } from '@/shared';

/** Admin only. Other roles, and demo mode, never send the status and master requests. */
export function SettingsView() {
  const me = useCurrentUser();
  const demoMode = useDemoMode();

  let content;
  if (!me.data) content = <LoadingState label="Loading your account…" />;
  else if (!hasRole(me.data.roles, 'ADMIN'))
    content = <AccessDeniedState description="Only admins can open Settings." />;
  else if (demoMode) content = <DemoModeState />;
  else
    content = (
      <div className="grid gap-4 lg:grid-cols-2">
        <SystemStatusCard />
        <MasterDataCard />
      </div>
    );

  return (
    <>
      <PageHeader title="Settings" description="System status and the active master data." />
      {content}
    </>
  );
}
