'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ProposalDrawer, type DrawerTarget } from '@/components/proposals/proposal-drawer';
import { ProposalsTable } from '@/components/proposals/proposals-table/proposals-table';
import { TypeSwitch } from '@/components/proposals/type-switch';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { useDashboardStats } from '@/lib/api/proposals';
import { parseProposalParams, proposalParamsToSearch, withType } from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import Link from 'next/link';
import { FilePlus2, RefreshCcw, Trash2 } from 'lucide-react';

/** The proposals list for a type: the type switch, the table and the drawer. */
export function ProposalsListView({ serverSearch }: { serverSearch: string }) {
  const { params, replace } = useUrlSearchParams(serverSearch);
  const { type, stage } = parseProposalParams(params);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const canCreate = usePermission('property.create');
  const canDelete = usePermission('property.delete');

  const newStats = useDashboardStats('NEW');
  const existingStats = useDashboardStats('EXISTING');

  const action =
    type === 'EXISTING'
      ? { label: 'Start renewal', href: '/proposals/new?type=existing', Icon: RefreshCcw }
      : { label: 'New proposal', href: '/proposals/new?type=new', Icon: FilePlus2 };

  return (
    <>
      <PageHeader
        title="Proposals"
        description={
          type === 'EXISTING' ? 'Renewals of existing policies.' : 'New business proposals.'
        }
        actions={
          canCreate || canDelete ? (
            <>
              {canDelete ? (
                <Button asChild variant="outline">
                  <Link href="/proposals/deleted">
                    <Trash2 aria-hidden="true" />
                    Deleted bin
                  </Link>
                </Button>
              ) : null}
              {canCreate ? (
                <Button asChild variant="accent">
                  <Link href={action.href}>
                    <action.Icon aria-hidden="true" />
                    {action.label}
                  </Link>
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      <div className="grid gap-6">
        <TypeSwitch
          type={type}
          counts={{
            NEW: newStats.data?.total ?? null,
            EXISTING: existingStats.data?.total ?? null,
          }}
          onChange={(next) => replace(proposalParamsToSearch(withType(next)))}
        />
        <ProposalsTable
          type={type}
          stage={stage}
          onStage={(next) => replace(proposalParamsToSearch({ type, stage: next }))}
          onOpen={(id, trigger) => setDrawer({ id, trigger })}
        />
      </div>
      <ProposalDrawer target={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}
