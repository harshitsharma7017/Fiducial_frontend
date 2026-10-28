'use client';

import { useState } from 'react';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { NewCaseChooser } from '@/components/eb/new-case-chooser';
import { LineOfBusinessChoice, type LineOfBusiness } from '@/components/ghi/line-of-business';
import { PageHeader } from '@/components/page-header';
import { NewProposalForm } from '@/components/proposals/new-business/new-proposal-form';
import { AccessDeniedState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { parseType } from '@/lib/proposal-params';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import { EB_PRODUCTS, casePermission, hasPermission, isEbProduct } from '@/shared';

/**
 * Creates a case (D-1): new business, or a renewal that starts from last year's policy (D-2).
 * ?type=existing opens it as a renewal (Start renewal). New business starts with the line of
 * business (Requirement 1.1): Property, or Employee Benefits (GMC, GPA, GTLI), as the user may
 * create them; a user who may create only one line goes straight to its form.
 * ?line=eb&product=GPA opens Employee Benefits with the product chosen (the lists' New case).
 */
export function NewProposalView({ serverSearch }: { serverSearch: string }) {
  const { params } = useUrlSearchParams(serverSearch);
  const renewal = parseType(params.get('type')) === 'EXISTING';
  const me = useCurrentUser();
  const permissions = me.data?.permissions;
  const canProperty = hasPermission(permissions, 'property.create');
  const canEb = EB_PRODUCTS.some((product) =>
    hasPermission(permissions, casePermission(product, 'create')),
  );
  const product = params.get('product');
  const [line, setLine] = useState<LineOfBusiness | null>(
    params.get('line') === 'eb' ? 'EB' : null,
  );
  const shown: LineOfBusiness | null =
    canProperty && canEb ? line : canProperty ? 'PROPERTY' : 'EB';
  const denied = (
    <AccessDeniedState description="A Relationship Manager or Admin starts proposals and renewals." />
  );

  return (
    <>
      <PageHeader
        title={renewal ? 'Start renewal' : 'New proposal'}
        description={
          renewal
            ? 'Renewal: last year’s policy is copied from the policy software as the Existing column. Choose the client, the policy period and who works on it.'
            : 'New business: choose the line of business, the insured, the policy period and who works on it. Then fill the Data Sheet and send the RFQ.'
        }
      />
      <DemoModeGate>
        {renewal ? (
          canProperty ? (
            <NewProposalForm key="EXISTING" initialType="EXISTING" />
          ) : (
            denied
          )
        ) : !canProperty && !canEb ? (
          denied
        ) : (
          <>
            {canProperty && canEb ? <LineOfBusinessChoice value={line} onChange={setLine} /> : null}
            {shown === 'PROPERTY' ? <NewProposalForm key="NEW" initialType="NEW" /> : null}
            {shown === 'EB' ? (
              <NewCaseChooser initialProduct={isEbProduct(product) ? product : null} />
            ) : null}
          </>
        )}
      </DemoModeGate>
    </>
  );
}
