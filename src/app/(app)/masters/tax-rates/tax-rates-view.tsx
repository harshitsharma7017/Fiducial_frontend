'use client';

import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';
import { todayIst } from '@/lib/dates';

/** M-8: GST with effective dates. A proposal keeps the rate in force when it was created. */
export function TaxRatesView() {
  return (
    <>
      <PageHeader
        title="Tax rates"
        description="GST and the date each rate applies from. To change GST, add the new rate with its effective date; proposals created before that date keep their rate."
        actions={<CatalogWorkbookActions />}
      />
      <CatalogTable master="tax-rates" defaults={{ tax: 'GST', effectiveFrom: todayIst() }} />
    </>
  );
}
