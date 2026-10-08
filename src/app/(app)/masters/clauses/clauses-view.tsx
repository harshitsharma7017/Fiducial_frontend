'use client';

import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';

/** SEC-09: the clause library printed under "Clauses to be attached" on the documents. */
export function ClausesView() {
  return (
    <>
      <PageHeader
        title="Clauses"
        description="The clause library, in this order. Each clause prints under “Clauses to be attached” on the RFQ, QCR and Placement Slip marked for it, grouped by its heading, on cases that quote one of its sections (every case when none is given). Until the library has a clause for a document, the client’s format keeps its own clauses."
        actions={<CatalogWorkbookActions />}
      />
      <CatalogTable master="clauses" />
    </>
  );
}
