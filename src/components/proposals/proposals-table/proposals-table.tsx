'use client';

import { useState } from 'react';
import { ErrorState, TableLoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { useProposals } from '@/lib/api/proposals';
import { formatInrCompact } from '@/lib/money';
import type { SortBy } from '@/lib/proposal-metrics';
import { formatDate } from '@/shared';
import { PRODUCT_NAMES, type ProposalType, type Stage } from '@/types/proposal';
import { ExpiryChip, StageBadge, TypeBadge } from '../badges';
import { DeleteCaseButton } from '../delete-case';
import { SortableHead, type SortState } from './header-cell';
import { InsurersCell } from './insurers-cell';
import { TablePagination } from './pagination';
import { TableToolbar } from './toolbar';

const PAGE_SIZE = 5;

export function ProposalsTable({
  type,
  stage,
  onStage,
  onOpen,
}: {
  type: ProposalType;
  stage: Stage | null;
  onStage: (stage: Stage | null) => void;
  onOpen: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ by: 'date', dir: 'asc' });
  const debouncedQuery = useDebouncedValue(query, 250);
  const canDelete = usePermission('proposals.delete');

  // The query the data layer should run. The debounced value changing resets the page below via
  // the key, so paging and filtering stay in step without a page-resetting effect.
  const effectiveQuery = debouncedQuery.trim();

  // Reset to page 1 whenever the type, stage, sort or (debounced) search changes. Deriving it
  // from a key during render avoids a setState-in-effect cascade.
  const filterKey = `${type}|${stage ?? ''}|${sort.by}|${sort.dir}|${effectiveQuery}`;
  const [lastKey, setLastKey] = useState(filterKey);
  const currentPage = filterKey === lastKey ? page : 1;
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }

  const proposals = useProposals({
    type,
    stage: stage ?? undefined,
    q: effectiveQuery || undefined,
    sort,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  function toggleSort(column: SortBy) {
    setSort((current) =>
      current.by === column
        ? { by: column, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { by: column, dir: 'asc' },
    );
  }

  const items = proposals.data?.items ?? [];
  const total = proposals.data?.total ?? 0;
  const filtersActive = debouncedQuery !== '' || stage !== null;

  return (
    <div className="rounded-lg border bg-card">
      <TableToolbar
        query={query}
        onQuery={setQuery}
        stage={stage}
        onStage={onStage}
        resultCount={total}
      />
      <div
        role="region"
        aria-label="Proposals"
        tabIndex={0}
        className="overflow-x-auto border-t outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead column="reference" label="Reference" sort={sort} onSort={toggleSort} />
              <SortableHead column="client" label="Client" sort={sort} onSort={toggleSort} />
              <TableHead scope="col">Type</TableHead>
              <SortableHead column="product" label="Policy" sort={sort} onSort={toggleSort} />
              <SortableHead
                column="fireSumInsured"
                label="Fire SI (Proposed 1)"
                sort={sort}
                onSort={toggleSort}
                className="text-right"
                numeric
              />
              <SortableHead
                column="sectionsIncluded"
                label="Sections"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead column="stage" label="Stage" sort={sort} onSort={toggleSort} />
              <SortableHead
                column="insurersResponded"
                label="Insurers"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead
                column="date"
                label={type === 'EXISTING' ? 'Renewal' : 'Due'}
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead column="owner" label="Owner" sort={sort} onSort={toggleSort} />
              {canDelete ? (
                <TableHead scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.isPending ? (
              <TableLoadingRows columns={canDelete ? 11 : 10} rows={PAGE_SIZE} />
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={(event) => {
                    const button =
                      event.currentTarget.querySelector<HTMLButtonElement>('button[data-row-open]');
                    if (button) onOpen(item.id, button);
                  }}
                >
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      data-row-open
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(item.id, event.currentTarget);
                      }}
                      className="rounded-sm text-accent-strong tabular underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.reference}
                      <span className="sr-only"> — open {item.client.name}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{item.client.name}</span>
                    <span className="block text-xs text-muted-foreground">{item.client.city}</span>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={item.type} />
                  </TableCell>
                  <TableCell>
                    {item.product ? (
                      <abbr title={PRODUCT_NAMES[item.product]} className="no-underline">
                        {item.product}
                      </abbr>
                    ) : (
                      <span className="text-muted-foreground" title="Chosen at QCR">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatInrCompact(item.fireSumInsured)}
                  </TableCell>
                  <TableCell className="tabular">{item.sectionsIncluded}/14</TableCell>
                  <TableCell>
                    <StageBadge stage={item.stage} />
                  </TableCell>
                  <TableCell className="tabular">
                    <InsurersCell item={item} />
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {formatDate(item.date)}
                    {item.type === 'EXISTING' && item.daysToExpiry !== null ? (
                      <ExpiryChip
                        daysToExpiry={item.daysToExpiry}
                        placed={item.placed}
                        className="mt-1 block w-fit"
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{item.owner}</TableCell>
                  {canDelete ? (
                    <TableCell className="w-10 text-right">
                      <DeleteCaseButton
                        id={item.id}
                        reference={item.reference}
                        clientName={item.client.name}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!proposals.isPending && proposals.isError ? (
          <div className="p-4">
            <ErrorState error={proposals.error} onRetry={() => void proposals.refetch()} />
          </div>
        ) : null}

        {!proposals.isPending && !proposals.isError && items.length === 0 ? (
          <div className="grid gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {filtersActive
                ? 'No proposals match these filters.'
                : 'No proposals of this type yet.'}
            </p>
            {filtersActive ? (
              <Button
                variant="outline"
                className="mx-auto"
                onClick={() => {
                  setQuery('');
                  onStage(null);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <TablePagination page={currentPage} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
    </div>
  );
}
