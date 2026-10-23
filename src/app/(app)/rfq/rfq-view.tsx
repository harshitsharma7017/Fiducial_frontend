'use client';

import { useQuery } from '@tanstack/react-query';
import { FilePlus2, Search } from 'lucide-react';
import Link from 'next/link';
import { DeleteCaseButton } from '@/components/proposals/delete-case';
import { useId } from 'react';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
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
import { fetchCases } from '@/lib/api/new-business';
import { daysBetween, todayIst } from '@/lib/dates';
import { formatInrCompact } from '@/lib/money';
import {
  OVERDUE_FILTER,
  RFQ_STATUS_LABELS,
  RFQ_STATUS_SLUGS,
  RFQ_STATUSES,
  countByStatus,
  hasOverdueInsurer,
  lastSent,
  matchesSearch,
  parseRfqStatus,
  rfqStatusOf,
  type RfqStatus,
} from '@/lib/rfq-status';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import { cn } from '@/lib/utils';
import {
  INSURER_STATUS_LABELS,
  formatDate,
  formatDateTime,
  hasRfq,
  wholeRupees,
  type ProposalRecord,
} from '@/shared';

const STATUS_VARIANT: Record<RfqStatus, 'muted' | 'warning' | 'info' | 'success'> = {
  NOT_READY: 'muted',
  READY: 'warning',
  PARTLY_SENT: 'info',
  SENT: 'success',
};

/** Ready to send first, then partly sent, not ready and sent; earliest due date first in each. */
const STATUS_ORDER: Record<RfqStatus, number> = { READY: 0, PARTLY_SENT: 1, NOT_READY: 2, SENT: 3 };

/**
 * Every new-business RFQ in one list: what still needs its Data Sheet, what is ready to send, and
 * what has gone to which insurers. Each row opens the proposal on its Insurers and RFQ tab.
 */
export function RfqView({ serverSearch }: { serverSearch: string }) {
  const canDelete = usePermission('property.delete');
  const columns = canDelete ? 8 : 7;
  const searchId = useId();
  const { params, replace } = useUrlSearchParams(serverSearch);
  const status = parseRfqStatus(params.get('status'));
  const q = params.get('q') ?? '';
  const overdueOnly = params.get('filter') === OVERDUE_FILTER;
  const canCreate = usePermission('property.create');

  const rfqs = useQuery({
    queryKey: ['proposals', 'rfq'],
    queryFn: async () => (await fetchCases()) ?? [],
  });

  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    replace(next.toString());
  };

  const all = rfqs.data ?? [];
  const searched = q.trim() ? all.filter((record) => matchesSearch(record, q)) : all;
  const counts = countByStatus(searched);
  const overdueCount = searched.filter(hasOverdueInsurer).length;
  const filtered = searched.filter(
    (record) =>
      (!status || rfqStatusOf(record) === status) && (!overdueOnly || hasOverdueInsurer(record)),
  );
  const rows = filtered.toSorted(
    (a, b) =>
      STATUS_ORDER[rfqStatusOf(a)] - STATUS_ORDER[rfqStatusOf(b)] ||
      a.dueDate.localeCompare(b.dueDate) ||
      a.reference.localeCompare(b.reference),
  );

  let body;
  if (rfqs.isPending) body = <TableLoadingRows columns={columns} />;
  else if (rfqs.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={columns} className="p-4">
          <ErrorState error={rfqs.error} onRetry={() => void rfqs.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (rows.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columns}>
          <EmptyState
            title={
              all.length === 0
                ? 'No RFQs yet'
                : q.trim()
                  ? `No RFQs match “${q.trim()}”`
                  : overdueOnly && !status
                    ? 'No insurer is overdue'
                    : `No RFQs are ${RFQ_STATUS_LABELS[status ?? 'READY'].toLowerCase()}`
            }
            description={
              all.length === 0
                ? 'Each new proposal gets an RFQ once its Data Sheet is filled.'
                : undefined
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((record) => <RfqRow key={record.id} record={record} />);
  }

  return (
    <>
      <PageHeader
        title="RFQ"
        description="Every request for quotation, new business and renewals: ready to send, partly sent and sent, with the insurers each went to."
        actions={
          canCreate ? (
            <Button asChild variant="accent">
              <Link href="/proposals/new?type=new">
                <FilePlus2 aria-hidden="true" />
                New proposal
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="RFQ status">
        <StatusChip
          label="All"
          count={searched.length}
          pressed={status === null}
          onClick={() => setParam('status', null)}
        />
        {RFQ_STATUSES.map((value) => (
          <StatusChip
            key={value}
            label={RFQ_STATUS_LABELS[value]}
            count={counts[value]}
            pressed={status === value}
            onClick={() => setParam('status', status === value ? null : RFQ_STATUS_SLUGS[value])}
          />
        ))}
        <StatusChip
          label="Overdue responses"
          count={overdueCount}
          pressed={overdueOnly}
          onClick={() => setParam('filter', overdueOnly ? null : OVERDUE_FILTER)}
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="grid max-w-md gap-2 p-4">
          <Label htmlFor={searchId}>Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={q}
              onChange={(event) => setParam('q', event.target.value || null)}
              placeholder="Reference, client or insurer"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <Table>
          <TableCaption className="sr-only">RFQs, ready to send first</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>RFQ</TableHead>
              <TableHead>Insurers</TableHead>
              <TableHead className="text-right">Fire SI (Option 1)</TableHead>
              <TableHead>Quotes needed by</TableHead>
              <TableHead>Last sent</TableHead>
              {canDelete ? (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
        {rfqs.isSuccess && rows.length > 0 ? (
          <p className="border-t px-4 py-3 text-sm text-muted-foreground tabular">
            {rows.length} {rows.length === 1 ? 'RFQ' : 'RFQs'}
          </p>
        ) : null}
      </Card>
    </>
  );
}

function StatusChip({
  label,
  count,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${label} (${count})`}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed ? 'border-primary bg-primary-soft text-primary' : 'bg-card hover:bg-muted',
      )}
    >
      {label}
      <span
        aria-hidden="true"
        className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular"
      >
        {count}
      </span>
    </button>
  );
}

function RfqRow({ record }: { record: ProposalRecord }) {
  const status = rfqStatusOf(record);
  const sent = record.insurers.filter((insurer) => hasRfq(insurer.status)).length;
  const latest = lastSent(record);
  const daysLeft = daysBetween(todayIst(), record.dueDate);
  const waiting = status !== 'SENT';
  const canDelete = usePermission('property.delete');

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        <Link
          href={`/proposals/${record.id}?tab=${status === 'NOT_READY' ? 'data-sheet' : 'rfq'}`}
          className="rounded-sm text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {record.reference}
        </Link>
        {record.type === 'EXISTING' ? (
          <Badge variant="accent" className="ml-2">
            Renewal
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="min-w-44 whitespace-normal">
        {record.client.name}
        <span className="block text-xs text-muted-foreground">
          {record.client.city || record.client.state}
        </span>
      </TableCell>
      <TableCell className="whitespace-normal">
        <Badge variant={STATUS_VARIANT[status]}>{RFQ_STATUS_LABELS[status]}</Badge>
        {status === 'NOT_READY' ? (
          <span className="block text-xs text-muted-foreground">
            {record.missing.length} {record.missing.length === 1 ? 'item' : 'items'} needed
          </span>
        ) : null}
      </TableCell>
      <TableCell className="min-w-48 whitespace-normal">
        {record.insurers.length === 0 ? (
          <span className="text-sm text-muted-foreground">None chosen</span>
        ) : (
          <>
            <span className="text-sm tabular">
              {sent} of {record.insurers.length} sent
            </span>
            <ul className="text-xs text-muted-foreground">
              {record.insurers.map((insurer) => (
                <li key={insurer.insurerId}>
                  {insurer.company}, {insurer.branch}:{' '}
                  <span className={insurer.overdue ? 'font-medium text-destructive' : undefined}>
                    {INSURER_STATUS_LABELS[insurer.status]}
                    {insurer.overdue ? ', overdue' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </TableCell>
      <TableCell className="text-right tabular whitespace-nowrap">
        {formatInrCompact(wholeRupees(record.fire.proposed1))}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="tabular">{formatDate(record.dueDate)}</span>
        {waiting ? (
          <Badge
            variant={daysLeft < 0 ? 'destructive' : daysLeft <= 2 ? 'warning' : 'muted'}
            className="ml-2 tabular"
          >
            {daysLeft < 0
              ? `${-daysLeft}d overdue`
              : daysLeft === 0
                ? 'Today'
                : `${daysLeft}d left`}
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {latest ? (
          <>
            <span className="tabular">{formatDateTime(latest.at)}</span>
            {latest.by ? (
              <span className="block text-xs text-muted-foreground">{latest.by}</span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {canDelete ? (
        <TableCell className="w-10 text-right">
          <DeleteCaseButton
            id={record.id}
            reference={record.reference}
            clientName={record.client.name}
          />
        </TableCell>
      ) : null}
    </TableRow>
  );
}
