'use client';

import { useQuery } from '@tanstack/react-query';
import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { catalogQuery } from '@/lib/api/catalog';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import { cn } from '@/lib/utils';
import { ADDON_LIST_LABELS, ADDON_LISTS, type AddonList } from '@/shared';

const isList = (value: string | null): value is AddonList =>
  (ADDON_LISTS as readonly string[]).includes(value ?? '');

/**
 * M-6 and M-7: the add-on lists from the client's workbooks (Fire additional, PAR, SFSP, BSUS &
 * BLUS), and the BSUS/BLUS paid add-ons' limits, caps and rates.
 */
export function AddonsView({ serverSearch }: { serverSearch: string }) {
  const { params, replace } = useUrlSearchParams(serverSearch);
  const tab = params.get('tab') === 'rates' ? 'rates' : 'lists';
  const list = isList(params.get('list')) ? (params.get('list') as AddonList) : null;
  const addons = useQuery(catalogQuery('addons'));
  const count = (value: AddonList | null) =>
    (addons.data ?? []).filter((addon) => value === null || addon.list === value).length;

  const setParams = (next: { tab?: string; list?: string | null }) => {
    const query = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    if (query.get('tab') === 'lists') query.delete('tab');
    replace(query.toString());
  };

  return (
    <>
      <PageHeader
        title="Add-on covers"
        description="The add-on lists from the client’s RFQ and QCR workbooks, and the BSUS and BLUS add-on limits and rates."
        actions={<CatalogWorkbookActions />}
      />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })} className="gap-4">
        <TabsList>
          <TabsTrigger value="lists">Add-on lists</TabsTrigger>
          <TabsTrigger value="rates">BSUS &amp; BLUS limits and rates</TabsTrigger>
        </TabsList>
        <TabsContent value="lists" className="grid min-w-0 gap-4 *:min-w-0">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Add-on list">
            {[null, ...ADDON_LISTS].map((value) => {
              const label = value ? ADDON_LIST_LABELS[value] : 'All lists';
              const pressed = list === value;
              return (
                <button
                  key={value ?? 'all'}
                  type="button"
                  aria-pressed={pressed}
                  aria-label={`${label} (${count(value)})`}
                  onClick={() => setParams({ list: value })}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    pressed
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'bg-card hover:bg-muted',
                  )}
                >
                  {label}
                  <span
                    aria-hidden="true"
                    className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular"
                  >
                    {count(value)}
                  </span>
                </button>
              );
            })}
          </div>
          <CatalogTable
            master="addons"
            filter={list ? (addon) => addon.list === list : undefined}
            defaults={list ? { list } : undefined}
            caption={list ? `${ADDON_LIST_LABELS[list]} add-ons` : 'Add-on covers'}
          />
        </TabsContent>
        <TabsContent value="rates" className="grid min-w-0 gap-4 *:min-w-0">
          <p className="text-sm text-muted-foreground">
            The paid add-ons of Bharat Sookshma (BSUS) and Bharat Laghu (BLUS): the cover limit and
            cap for each scheme, and the rate as a percentage of the policy rate.
          </p>
          <CatalogTable master="addon-rules" />
        </TabsContent>
      </Tabs>
    </>
  );
}
