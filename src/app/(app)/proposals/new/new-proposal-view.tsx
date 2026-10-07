'use client';

import Link from 'next/link';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { NewProposalForm } from '@/components/proposals/new-business/new-proposal-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccessDeniedState, EmptyState } from '@/components/states';
import { FilePlus2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { parseType } from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';

/**
 * A new-business proposal is created here from the client master. Starting a renewal is not
 * built yet, so that keeps its Planned placeholder.
 */
export function NewProposalView({ serverSearch }: { serverSearch: string }) {
  const { params } = useUrlSearchParams(serverSearch);
  const type = parseType(params.get('type'));
  const isRenewal = type === 'EXISTING';
  if (!isRenewal) return <CreateNewBusiness />;
  const listHref = `/proposals?type=${isRenewal ? 'existing' : 'new'}`;

  return (
    <>
      <PageHeader
        title={isRenewal ? 'Start renewal' : 'New proposal'}
        description={<Badge variant="muted">Planned</Badge>}
      />
      <EmptyState
        icon={<FilePlus2 className="size-8" />}
        title="Proposal creation is planned"
        description={
          isRenewal
            ? 'Starting a renewal from the app is not available yet. For now, open an existing proposal to review it.'
            : 'Creating a proposal from the app is not available yet. For now, browse the sample proposals.'
        }
        className="mx-auto max-w-md"
      />
      <div className="mt-4 flex justify-center">
        <Button asChild variant="outline">
          <Link href={listHref}>Back to {isRenewal ? 'existing proposals' : 'new proposals'}</Link>
        </Button>
      </div>
    </>
  );
}

function CreateNewBusiness() {
  const canCreate = usePermission('proposals.create');
  return (
    <>
      <PageHeader
        title="New proposal"
        description="New business: choose the insured and its risk locations, then fill the Data Sheet and send the RFQ."
      />
      <DemoModeGate>
        {canCreate ? (
          <NewProposalForm />
        ) : (
          <AccessDeniedState description="A Relationship Manager or Admin starts new proposals." />
        )}
      </DemoModeGate>
    </>
  );
}
