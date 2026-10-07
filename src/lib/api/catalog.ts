import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { catalogListSchema, type CatalogItem, type CatalogMaster } from '@/shared';

/** Every row of a product and cover master, in display order. */
export function catalogQuery<M extends CatalogMaster>(master: M) {
  return queryOptions({
    queryKey: queryKeys.catalog.master(master),
    queryFn: async ({ signal }) => {
      const response = await apiFetch(`catalog/${master}`, {
        schema: catalogListSchema(master),
        signal,
      });
      return response.items as CatalogItem<M>[];
    },
  });
}
