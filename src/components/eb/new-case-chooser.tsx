'use client';

import { useState } from 'react';
import { LineOfBusinessChoice, type LineOfBusiness } from '@/components/ghi/line-of-business';
import { NewGhiCaseForm } from '@/components/ghi/new-ghi-case-form';
import { NewProposalForm } from '@/components/proposals/new-business/new-proposal-form';
import { AccessDeniedState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';
import type { EbProduct } from '@/shared';
import { ProductChoice } from './product-choice';

/**
 * New proposal (Requirement 1): the line of business, then for Employee Benefits the product,
 * none chosen at first; no form (and so no create request) until both are chosen. Property shows
 * its form exactly as before.
 */
export function NewCaseChooser({
  initialLine = null,
  initialProduct = null,
}: {
  initialLine?: LineOfBusiness | null;
  initialProduct?: EbProduct | null;
}) {
  const canCreate = usePermission('proposals.create');
  const [line, setLine] = useState<LineOfBusiness | null>(initialLine);
  const [product, setProduct] = useState<EbProduct | null>(initialProduct);
  if (!canCreate) {
    return <AccessDeniedState description="A Relationship Manager or Admin starts cases." />;
  }
  return (
    <>
      <LineOfBusinessChoice value={line} onChange={setLine} />
      {line === 'PROPERTY' ? <NewProposalForm key="NEW" initialType="NEW" /> : null}
      {line === 'EB' ? (
        <>
          <ProductChoice value={product} onChange={setProduct} />
          {product ? <NewGhiCaseForm key={product} product={product} /> : null}
        </>
      ) : null}
    </>
  );
}
