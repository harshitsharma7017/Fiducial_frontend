'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch, type Control } from 'react-hook-form';
import { errorMessage } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { catalogQuery } from '@/lib/api/catalog';
import { addonFavouritesQuery } from '@/lib/api/new-business';
import { fireTotal, type DataSheetForm } from '@/lib/data-sheet';
import { queryKeys } from '@/lib/query-keys';
import {
  ADDON_LIST_LABELS,
  AddonFavouritesSchema,
  addonListsForProduct,
  productRangeText,
  suggestProducts,
  type AddonList,
  type CatalogItem,
} from '@/shared';
import { TextField } from './data-sheet-fields';

// The product of a case (C-1) and its add-on covers (C-4). The product follows the Fire sum
// insured as it is typed, the same way the API works it out; one outside the suggestion needs a
// reason. Add-ons come from the product's lists; each client's favourites are listed first.

const addonKey = (addon: { list: string; name: string }) =>
  `${addon.list}|${addon.name.trim().toLowerCase()}`;

/** The product the Data Sheet stands for as typed: chosen, or the first one suggested. */
export function useProductChoice(control: Control<DataSheetForm>) {
  const products = useQuery(catalogQuery('products'));
  const locations = useWatch({ control, name: 'locations' });
  const code = useWatch({ control, name: 'product.code' }) ?? '';
  const total = fireTotal(locations ?? []);
  return useMemo(() => {
    const all = products.data ?? [];
    const suggested = total === '0' ? [] : suggestProducts(all, total);
    const chosen = code ? all.find((product) => product.code === code) : undefined;
    const product = code ? chosen : suggested[0];
    return {
      loaded: products.isSuccess,
      failed: products.isError,
      products: all,
      suggested,
      product,
      /** A product the Fire sum insured does not suggest: it needs the reason. */
      override:
        Boolean(code) && suggested.length > 0 && !suggested.some((item) => item.code === code),
      lists: product ? addonListsForProduct(product) : ([] as AddonList[]),
    };
  }, [products.data, products.isSuccess, products.isError, code, total]);
}

export function ProductAndAddons({
  clientId,
  readOnly,
  canEdit,
}: {
  clientId: string;
  readOnly: boolean;
  /** May change the client's favourites (even once the Data Sheet is locked). */
  canEdit: boolean;
}) {
  const form = useFormContext<DataSheetForm>();
  const choice = useProductChoice(form.control);
  const { suggested } = choice;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy and add-on covers</CardTitle>
        <CardDescription>
          The policy follows the Fire sum insured
          {suggested.length > 0
            ? `: ${suggested.map((product) => product.code).join(' or ')} for this total`
            : ''}
          . Choose another to override it, with the reason. Add-ons are picked from the policy’s
          lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="product.code"
            render={({ field }) => (
              <FormItem className="gap-1">
                <FormLabel>Policy</FormLabel>
                <FormControl>
                  <NativeSelect
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    disabled={field.disabled || choice.failed}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <option value="">
                      {suggested[0]
                        ? `Follow the suggestion (${suggested[0].code})`
                        : 'Follow the suggestion (enter the Fire sums insured)'}
                    </option>
                    {choice.products
                      .filter((product) => product.active || product.code === field.value)
                      .map((product) => (
                        <option key={product.code} value={product.code}>
                          {product.name} — {productRangeText(product)}
                          {suggested.some((item) => item.code === product.code)
                            ? ' (suggested)'
                            : ''}
                        </option>
                      ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage className="text-xs" />
                {choice.failed ? (
                  <p className="text-xs text-destructive">The policy master could not be loaded.</p>
                ) : null}
              </FormItem>
            )}
          />
          {choice.override ? (
            <TextField
              name="product.reason"
              label="Reason for this policy"
              description={`The Fire sum insured suggests ${suggested.map((product) => product.code).join(' or ')}.`}
              maxLength={300}
            />
          ) : null}
        </div>
        <AddonPicker
          clientId={clientId}
          readOnly={readOnly}
          canEdit={canEdit}
          productCode={choice.product?.code ?? null}
          lists={choice.lists}
          ready={choice.loaded}
        />
      </CardContent>
    </Card>
  );
}

interface PickerItem {
  list: AddonList;
  name: string;
  limit: string | null;
  /** Chosen earlier but no longer active in the add-on master. */
  retired: boolean;
}

function AddonPicker({
  clientId,
  readOnly,
  canEdit,
  productCode,
  lists,
  ready,
}: {
  clientId: string;
  readOnly: boolean;
  canEdit: boolean;
  productCode: string | null;
  lists: readonly AddonList[];
  ready: boolean;
}) {
  const form = useFormContext<DataSheetForm>();
  const queryClient = useQueryClient();
  const master = useQuery(catalogQuery('addons'));
  const favourites = useQuery(addonFavouritesQuery(clientId));
  const watched = useWatch({ control: form.control, name: 'addons' });
  const chosen = useMemo(() => watched ?? [], [watched]);
  const [search, setSearch] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  // Add-ons from another product's lists ("only PAR add-ons on a PAR case") are left out when the
  // Data Sheet is saved; the screen says which.
  const offList = ready ? chosen.filter((addon) => !lists.includes(addon.list)) : [];

  const favouriteKeys = useMemo(
    () => new Set((favourites.data?.items ?? []).map(addonKey)),
    [favourites.data],
  );
  const chosenKeys = new Set(chosen.map(addonKey));

  const saveFavourites = useMutation({
    mutationFn: (items: { list: AddonList; name: string }[]) =>
      apiFetch(`clients/${clientId}/addon-favourites`, {
        method: 'PUT',
        body: { items },
        schema: AddonFavouritesSchema,
      }),
    onSuccess: (saved) =>
      queryClient.setQueryData(queryKeys.clients.addonFavourites(clientId), saved),
    onError: (error) =>
      toast({
        title: 'Favourites not saved',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });

  const items = useMemo<PickerItem[]>(() => {
    const active = (master.data ?? []).filter(
      (addon: CatalogItem<'addons'>) => addon.active && lists.includes(addon.list),
    );
    const known = new Set(active.map(addonKey));
    const retired = chosen
      .filter((addon) => lists.includes(addon.list) && !known.has(addonKey(addon)))
      .map((addon) => ({ list: addon.list, name: addon.name, limit: null, retired: true }));
    const all = [
      ...retired,
      ...active.map((addon) => ({
        list: addon.list,
        name: addon.name,
        limit: addon.limit,
        retired: false,
      })),
    ];
    // Favourites first, each group in the master's order.
    return [
      ...all.filter((item) => favouriteKeys.has(addonKey(item))),
      ...all.filter((item) => !favouriteKeys.has(addonKey(item))),
    ];
  }, [master.data, lists, chosen, favouriteKeys]);

  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter(
    (item) =>
      (!favouritesOnly || favouriteKeys.has(addonKey(item))) &&
      words.every((word) => item.name.toLowerCase().includes(word)),
  );

  const toggle = (item: PickerItem, on: boolean) =>
    form.setValue(
      'addons',
      on
        ? [...chosen, { list: item.list, name: item.name }]
        : chosen.filter((addon) => addonKey(addon) !== addonKey(item)),
      { shouldDirty: true },
    );
  const toggleFavourite = (item: PickerItem) => {
    const current = favourites.data?.items ?? [];
    saveFavourites.mutate(
      favouriteKeys.has(addonKey(item))
        ? current.filter((addon) => addonKey(addon) !== addonKey(item))
        : [...current, { list: item.list, name: item.name }],
    );
  };

  return (
    <section aria-labelledby="addons-heading" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="addons-heading" className="text-sm font-semibold">
          Add-on covers
          {lists.length > 0 ? (
            <span className="font-normal text-muted-foreground">
              {' '}
              — {lists.map((list) => ADDON_LIST_LABELS[list]).join(' and ')} list
            </span>
          ) : null}
        </h3>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {chosen.length} chosen
        </span>
      </div>
      {offList.length > 0 ? (
        <p
          role="status"
          className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm"
        >
          Not on {productCode ?? 'the policy'}’s list, so left out when you save:{' '}
          {offList.map((addon) => addon.name).join(', ')}.
        </p>
      ) : null}
      {!productCode ? (
        <p className="text-sm text-muted-foreground">
          Enter the Fire sums insured, or choose a policy, to pick its add-ons.
        </p>
      ) : lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The policy master gives {productCode} no add-on list.
        </p>
      ) : master.isError ? (
        <p className="text-sm text-destructive">The add-on master could not be loaded.</p>
      ) : (
        <>
          {chosen.some((addon) => lists.includes(addon.list)) ? (
            <ul aria-label="Chosen add-on covers" className="flex flex-wrap gap-1.5">
              {chosen
                .filter((addon) => lists.includes(addon.list))
                .map((addon) => (
                  <li key={addonKey(addon)}>
                    <Badge variant="muted" className="gap-1 py-1 pr-1 font-normal">
                      {addon.name}
                      {readOnly ? null : (
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                          onClick={() =>
                            form.setValue(
                              'addons',
                              chosen.filter((item) => addonKey(item) !== addonKey(addon)),
                              { shouldDirty: true },
                            )
                          }
                        >
                          <X aria-hidden="true" className="size-3" />
                          <span className="sr-only">Remove {addon.name}</span>
                        </button>
                      )}
                    </Badge>
                  </li>
                ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-56 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Search add-on covers"
                placeholder="Search add-on covers"
                className="pl-8"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="addons-favourites-only"
                checked={favouritesOnly}
                onCheckedChange={(value) => setFavouritesOnly(value === true)}
              />
              <Label htmlFor="addons-favourites-only" className="font-normal">
                Favourites only ({favouriteKeys.size})
              </Label>
            </div>
          </div>
          <ul
            aria-label={`${productCode} add-on covers`}
            // relative: the checkboxes' hidden inputs are absolutely placed; without it they escape
            // the scroll box and stretch the page below the form.
            className="relative grid max-h-96 gap-1 overflow-y-auto rounded-md border p-2"
          >
            {shown.length === 0 ? (
              <li className="p-2 text-sm text-muted-foreground">
                {master.isPending ? 'Loading add-ons…' : 'No add-on matches.'}
              </li>
            ) : (
              shown.map((item) => {
                const key = addonKey(item);
                const id = `addon-${key.replace(/[^a-z0-9]+/gi, '-')}`;
                const favourite = favouriteKeys.has(key);
                return (
                  <li
                    key={key}
                    className="flex items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={chosenKeys.has(key)}
                      disabled={readOnly}
                      onCheckedChange={(value) => toggle(item, value === true)}
                    />
                    <Label htmlFor={id} className="grid flex-1 gap-0.5 font-normal">
                      <span>
                        {item.name}
                        {item.retired ? (
                          <Badge variant="outline" className="ml-2">
                            No longer in the master
                          </Badge>
                        ) : null}
                      </span>
                      {item.limit ? (
                        <span className="text-xs text-muted-foreground">{item.limit}</span>
                      ) : null}
                    </Label>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-pressed={favourite}
                        disabled={saveFavourites.isPending}
                        onClick={() => toggleFavourite(item)}
                      >
                        <Star
                          aria-hidden="true"
                          className={favourite ? 'fill-amber-400 text-amber-500' : undefined}
                        />
                        <span className="sr-only">Favourite for this client: {item.name}</span>
                      </Button>
                    ) : favourite ? (
                      <Star
                        aria-label="Favourite"
                        className="size-4 fill-amber-400 text-amber-500"
                      />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
    </section>
  );
}
