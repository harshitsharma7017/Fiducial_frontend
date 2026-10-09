'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { CatalogRowDialog } from '@/components/catalog/catalog-row-dialog';
import { EmptyState, ErrorState, TableLoadingRows, errorMessage } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { catalogQuery } from '@/lib/api/catalog';
import { todayIst } from '@/lib/dates';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  ADDON_LIST_LABELS,
  CATALOG_REORDERABLE,
  CATALOG_SHEETS,
  CatalogListResponseSchema,
  addonRuleFormula,
  formatDate,
  formatRupeesShort,
  productRangeText,
  taxRateOn,
  type CatalogItem,
  type CatalogMaster,
} from '@/shared';

interface DisplayColumn<M extends CatalogMaster> {
  header: string;
  className?: string;
  cell: (item: CatalogItem<M>, all: readonly CatalogItem<M>[]) => ReactNode;
}

const rupees = (value: string | null) =>
  value === null ? <span className="text-muted-foreground">—</span> : formatRupeesShort(value);
const yesNo = (value: boolean) =>
  value ? <Badge variant="success">Yes</Badge> : <Badge variant="muted">No</Badge>;
const list = (values: readonly string[]) =>
  values.length === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <ul className="grid gap-0.5 text-xs">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  );

/** What each master's table shows. Every column stays editable in the form and the workbook. */
const DISPLAY: { [M in CatalogMaster]: DisplayColumn<M>[] } = {
  products: [
    { header: 'Code', className: 'font-medium', cell: (p) => p.code },
    { header: 'Name', cell: (p) => p.name },
    { header: 'Suggested for', cell: (p) => productRangeText(p) },
    { header: 'Active', cell: (p) => yesNo(p.active) },
  ],
  sections: [
    {
      header: 'Section',
      className: 'min-w-48',
      cell: (s) => (
        <>
          <span className="font-medium">{s.name}</span>
          <span className="block text-xs text-muted-foreground">{s.code}</span>
        </>
      ),
    },
    { header: 'Offered', cell: (s) => yesNo(s.active) },
    { header: 'Schedule lines', className: 'min-w-56', cell: (s) => list(s.fields) },
    { header: 'Add-on covers', className: 'min-w-48', cell: (s) => list(s.addons) },
  ],
  addons: [
    { header: 'List', cell: (a) => ADDON_LIST_LABELS[a.list] },
    { header: 'S No', className: 'tabular text-right', cell: (a) => a.seq },
    { header: 'Add-on cover', className: 'min-w-56 font-medium', cell: (a) => a.name },
    {
      header: 'Type',
      cell: (a) =>
        a.kind ? (
          <Badge variant={a.kind === 'PAID' ? 'warning' : 'info'}>
            {a.kind === 'PAID' ? 'Paid' : 'Inbuilt'}
          </Badge>
        ) : (
          '—'
        ),
    },
    {
      header: 'Sum insured limit',
      className: 'min-w-56',
      cell: (a) => <span className="line-clamp-3 text-xs">{a.limit ?? '—'}</span>,
    },
    { header: 'Active', cell: (a) => yesNo(a.active) },
  ],
  'addon-rules': [
    { header: 'S No', className: 'tabular text-right', cell: (r) => r.seq },
    { header: 'Add-on cover', className: 'min-w-44 font-medium', cell: (r) => r.name },
    {
      header: 'Limit — Sookshma (BSUS)',
      className: 'min-w-44 text-xs',
      cell: (r) => r.sookshmaLimit,
    },
    { header: 'Limit — Laghu (BLUS)', className: 'min-w-44 text-xs', cell: (r) => r.laghuLimit },
    { header: 'Rate', className: 'min-w-52 text-xs', cell: (r) => addonRuleFormula(r) },
    {
      header: 'Cap BSUS / BLUS',
      className: 'whitespace-nowrap text-xs',
      cell: (r) => (
        <>
          {rupees(r.sookshmaCap)} / {rupees(r.laghuCap)}
          {r.perBlock ? <span className="block text-muted-foreground">per block</span> : null}
        </>
      ),
    },
    { header: 'Active', cell: (r) => yesNo(r.active) },
  ],
  'tax-rates': [
    { header: 'Tax', className: 'font-medium', cell: (t) => t.tax },
    { header: 'Rate', className: 'tabular', cell: (t) => `${t.ratePercent}%` },
    { header: 'Effective from', className: 'tabular', cell: (t) => formatDate(t.effectiveFrom) },
    {
      header: 'Status',
      cell: (t, all) => {
        const today = todayIst();
        if (t.effectiveFrom > today)
          return <Badge variant="info">From {formatDate(t.effectiveFrom)}</Badge>;
        return taxRateOn(all, t.tax, today)?.id === t.id ? (
          <Badge variant="success">In force today</Badge>
        ) : (
          <Badge variant="muted">Earlier rate</Badge>
        );
      },
    },
    { header: 'Note', cell: (t) => t.note ?? '—' },
  ],
  notes: [
    {
      header: 'Note',
      className: 'min-w-72',
      cell: (n) => (
        <>
          <span className="font-medium">{n.title}</span>
          <span className="block text-xs whitespace-pre-line text-muted-foreground">{n.text}</span>
        </>
      ),
    },
    {
      header: 'Printed on',
      className: 'min-w-40',
      cell: (n) => (
        <div className="flex flex-wrap gap-1">
          {n.onDataSheet ? <Badge variant="outline">Data Sheet</Badge> : null}
          {n.onRfq ? <Badge variant="outline">RFQ</Badge> : null}
          {n.onQcr ? <Badge variant="outline">QCR</Badge> : null}
          {n.onPlacementSlip ? <Badge variant="outline">Placement Slip</Badge> : null}
        </div>
      ),
    },
    { header: 'Active', cell: (n) => yesNo(n.active) },
  ],
  clauses: [
    {
      header: 'Clause',
      className: 'min-w-72',
      cell: (c) => (
        <>
          <span className="font-medium">{c.heading}</span>
          <span className="block text-xs whitespace-pre-line text-muted-foreground">{c.text}</span>
        </>
      ),
    },
    {
      header: 'Sections',
      className: 'min-w-36',
      cell: (c) =>
        c.sections.length === 0 ? <span className="text-xs">Every case</span> : list(c.sections),
    },
    {
      header: 'Printed on',
      className: 'min-w-40',
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.onRfq ? <Badge variant="outline">RFQ</Badge> : null}
          {c.onQcr ? <Badge variant="outline">QCR</Badge> : null}
          {c.onPlacementSlip ? <Badge variant="outline">Placement Slip</Badge> : null}
        </div>
      ),
    },
    { header: 'Active', cell: (c) => yesNo(c.active) },
  ],
  'occupancy-defaults': [
    {
      header: 'Occupancy',
      className: 'min-w-56',
      cell: (o) => (
        <>
          <span className="font-medium tabular">{o.tacCode}</span>
          {o.occupancy ? (
            <span className="line-clamp-2 text-xs text-muted-foreground" title={o.occupancy}>
              {o.occupancy}
            </span>
          ) : null}
        </>
      ),
    },
    { header: 'Sections to quote', className: 'min-w-44', cell: (o) => list(o.sections) },
    { header: 'Fire add-ons required', className: 'min-w-44', cell: (o) => list(o.fireRequired) },
    {
      header: 'Fire add-ons not required',
      className: 'min-w-44',
      cell: (o) => list(o.fireNotRequired),
    },
    { header: 'Active', cell: (o) => yesNo(o.active) },
  ],
};

/** Text of a row for the search box. */
function rowText(item: object): string {
  return Object.values(item)
    .map((value) =>
      Array.isArray(value)
        ? value.join(' ')
        : typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : '',
    )
    .join(' ')
    .toLowerCase();
}

/** Download and upload of the product and cover masters workbook, for page headers. */
export function CatalogWorkbookActions() {
  const canManage = usePermission('masters.manage');
  return (
    <>
      <Button asChild variant="outline">
        <a href="/api/proxy/catalog/workbook" download>
          <Download aria-hidden="true" />
          Download as Excel
        </a>
      </Button>
      {canManage ? (
        <Button asChild>
          <Link href="/masters/import?type=catalog">
            <Upload aria-hidden="true" />
            Upload Excel
          </Link>
        </Button>
      ) : null}
    </>
  );
}

/**
 * One product and cover master as a table: search, add and edit rows (Admins), and move rows up
 * or down where the order matters. `filter` narrows the rows (for example one add-on list).
 */
export function CatalogTable<M extends CatalogMaster>({
  master,
  filter,
  defaults,
  caption,
}: {
  master: M;
  filter?: (item: CatalogItem<M>) => boolean;
  /** Values for a new row's form. */
  defaults?: Record<string, string>;
  caption?: string;
}) {
  const searchId = useId();
  const queryClient = useQueryClient();
  const canManage = usePermission('masters.manage');
  const spec = CATALOG_SHEETS[master];
  const rows = useQuery(catalogQuery(master));
  const [search, setSearch] = useState('');
  const reorderable = canManage && CATALOG_REORDERABLE.includes(master);
  const columns = DISPLAY[master];
  const columnCount = columns.length + (reorderable ? 1 : 0) + (canManage ? 1 : 0);

  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(`catalog/${master}/order`, {
        method: 'PUT',
        body: { ids },
        schema: CatalogListResponseSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error) =>
      toast({
        title: 'Could not reorder',
        description: errorMessage(error),
        variant: 'destructive',
      }),
  });

  const all = rows.data ?? [];
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all.filter(
    (item) => (!filter || filter(item)) && words.every((word) => rowText(item).includes(word)),
  );
  const move = (item: CatalogItem<M>, step: -1 | 1) => {
    const ids = all.map((row) => row.id);
    const from = ids.indexOf(item.id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to] ?? '', ids[from] ?? ''];
    reorder.mutate(ids);
  };
  const isPinned = (item: CatalogItem<M>) =>
    master === 'sections' && (item as CatalogItem<'sections'>).code === 'FIRE';

  let body: ReactNode;
  if (rows.isPending) body = <TableLoadingRows columns={columnCount} rows={4} />;
  else if (rows.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={columnCount} className="p-4">
          <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (shown.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columnCount}>
          <EmptyState
            title={all.length === 0 ? `No ${spec.label.toLowerCase()} yet` : 'Nothing matches'}
            description={
              all.length === 0 ? (
                canManage ? (
                  <>
                    Upload the policy and cover masters workbook on the{' '}
                    <Link
                      href="/masters/import?type=catalog"
                      className="text-accent-strong hover:underline"
                    >
                      Import data
                    </Link>{' '}
                    page.
                  </>
                ) : (
                  'An Admin uploads the policy and cover masters.'
                )
              ) : (
                'Try other words.'
              )
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = shown.map((item) => {
      const index = all.indexOf(item);
      const pinned = isPinned(item);
      return (
        <TableRow key={item.id}>
          {reorderable ? (
            <TableCell className="whitespace-nowrap">
              <span className="mr-1 inline-block w-5 text-right text-xs text-muted-foreground tabular">
                {index + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={
                  pinned ||
                  index === 0 ||
                  isPinned(all[index - 1] ?? item) ||
                  reorder.isPending ||
                  words.length > 0
                }
                onClick={() => move(item, -1)}
              >
                <ArrowUp aria-hidden="true" />
                <span className="sr-only">Move up</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={
                  pinned || index === all.length - 1 || reorder.isPending || words.length > 0
                }
                onClick={() => move(item, 1)}
              >
                <ArrowDown aria-hidden="true" />
                <span className="sr-only">Move down</span>
              </Button>
            </TableCell>
          ) : null}
          {columns.map((column) => (
            <TableCell
              key={column.header}
              className={cn('align-top whitespace-normal', column.className)}
            >
              {column.cell(item, all)}
            </TableCell>
          ))}
          {canManage ? (
            <TableCell className="text-right align-top">
              <CatalogRowDialog
                master={master}
                item={item}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                }
              />
            </TableCell>
          ) : null}
        </TableRow>
      );
    });
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="grid w-full max-w-sm gap-2">
          <Label htmlFor={searchId}>Search {caption ?? spec.label}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        {canManage && master !== 'sections' ? (
          <CatalogRowDialog
            master={master}
            defaults={defaults}
            trigger={
              <Button variant="outline">
                <Plus aria-hidden="true" />
                Add row
              </Button>
            }
          />
        ) : null}
      </div>
      <Table>
        <TableCaption className="sr-only">{caption ?? spec.label}</TableCaption>
        <TableHeader>
          <TableRow>
            {reorderable ? <TableHead>Order</TableHead> : null}
            {columns.map((column) => (
              <TableHead key={column.header}>{column.header}</TableHead>
            ))}
            {canManage ? (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {rows.isSuccess && all.length > 0 ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground tabular">
          {shown.length === all.length
            ? `${all.length} rows`
            : `Showing ${shown.length} of ${all.length}`}
        </p>
      ) : null}
    </Card>
  );
}
