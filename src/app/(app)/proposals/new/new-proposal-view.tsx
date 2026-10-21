'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { NewCaseChooser } from '@/components/eb/new-case-chooser';
import { PageHeader } from '@/components/page-header';
import { NewProposalForm } from '@/components/proposals/new-business/new-proposal-form';
import { AccessDeniedState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';
import { parseType } from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import { isEbProduct } from '@/shared';

/**
 * Creates a case (D-1): new business, or a renewal that starts from last year's policy (D-2).
 * ?type=existing opens it as a renewal (Start renewal).
 */
export function NewProposalView({ serverSearch }: { serverSearch: string }) {
  const { params } = useUrlSearchParams(serverSearch);
  const renewal = parseType(params.get('type')) === 'EXISTING';
  const canCreate = usePermission('proposals.create');
  // ?line=eb&product=GPA opens Employee Benefits with the product chosen (the lists' New case).
  const product = params.get('product');
  const line = params.get('line') === 'eb' ? 'EB' : null;

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
        {/* New business: the line of business first (Requirement 1.1); a renewal is Property's. */}
        {canCreate && !renewal ? (
          <NewCaseChooser
            initialLine={line}
            initialProduct={line && isEbProduct(product) ? product : null}
          />
        ) : canCreate ? (
          <NewProposalForm key="EXISTING" initialType="EXISTING" />
        ) : (
          <AccessDeniedState description="A Relationship Manager or Admin starts proposals and renewals." />
        )}
      </DemoModeGate>
    </>
  );
}
