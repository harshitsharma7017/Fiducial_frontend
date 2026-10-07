'use client';

import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';

/** M-9: the NOTE and disclaimer text at the foot of the documents. */
export function NotesView() {
  return (
    <>
      <PageHeader
        title="Standard notes"
        description="The NOTE and disclaimer text printed at the foot of the documents, in this order. The RFQ export prints the notes marked for it; the Data Sheet, QCR and Placement Slip will when their exports are built."
        actions={<CatalogWorkbookActions />}
      />
      <CatalogTable master="notes" />
    </>
  );
}
