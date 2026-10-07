'use client';

import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';

/** M-5: the 14 coverage sections, their order and whether new Data Sheets offer them. */
export function SectionsView() {
  return (
    <>
      <PageHeader
        title="Coverage sections"
        description="The 14 sections of the Data Sheet and RFQ, in the order they are listed. A section switched off is not offered on new Data Sheets; Fire is always first and always on."
        actions={<CatalogWorkbookActions />}
      />
      <CatalogTable master="sections" />
    </>
  );
}
