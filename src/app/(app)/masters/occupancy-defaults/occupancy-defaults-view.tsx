'use client';

import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';

/** The covers a new case starts with for each occupancy (IIB TAC code). */
export function OccupancyDefaultsView() {
  return (
    <>
      <PageHeader
        title="Occupancy cover defaults"
        description="For each occupancy, the sections ticked and the Fire add-ons answered when a new case starts. A case with locations of several occupancies gets all their sections, and an add-on is Required when any of them asks for it. The team can change everything on the Data Sheet; cases already created are not changed."
        actions={<CatalogWorkbookActions />}
      />
      <CatalogTable master="occupancy-defaults" />
    </>
  );
}
