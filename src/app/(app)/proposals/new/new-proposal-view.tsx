'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { NewProposalForm } from '@/components/proposals/new-business/new-proposal-form';
import { AccessDeniedState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';
import { parseType } from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';

/**
 * Creates a case (D-1): new business, or a renewal that starts from last year's policy (D-2).
 * ?type=existing opens it as a renewal (Start renewal).
 */
export function NewProposalView({ serverSearch }: { serverSearch: string }) {
  const { params } = useUrlSearchParams(serverSearch);
  const renewal = parseType(params.get('type')) === 'EXISTING';
  const canCreate = usePermission('proposals.create');

  return (
    <>
      <PageHeader
        title={renewal ? 'Start renewal' : 'New proposal'}
        description={
          renewal
            ? 'Renewal: last year’s policy is copied from the policy software as the Existing column. Choose the client, the policy period and who works on it.'
            : 'New business: choose the insured and its risk locations, the policy period and who works on it. Then fill the Data Sheet and send the RFQ.'
        }
      />
      <DemoModeGate>
        {canCreate ? (
          <NewProposalForm
            key={renewal ? 'EXISTING' : 'NEW'}
            initialType={renewal ? 'EXISTING' : 'NEW'}
          />
        ) : (
          <AccessDeniedState description="A Relationship Manager or Admin starts proposals and renewals." />
        )}
      </DemoModeGate>
    </>
  );
}
