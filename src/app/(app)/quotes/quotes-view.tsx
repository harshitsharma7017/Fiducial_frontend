'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DeleteCaseButton } from '@/components/proposals/delete-case';
import { usePermission } from '@/hooks/use-permission';
import { PageHeader } from '@/components/page-header';
import { StageBadge } from '@/components/proposals/badges';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { StatusChip, WorklistTable } from '@/components/worklists/worklist';
import { apiFetch } from '@/lib/api-client';
import { daysBetween, todayIst } from '@/lib/dates';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import {
  QCR_STATUS_LABELS,
  QUOTE_OPTION_LABELS,
  QcrSummaryListSchema,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type QcrSummary,
} from '@/shared';

// Every case whose RFQ has gone out, in one list: waiting for quotes, quotes to compare, QCR
// approved, and QCR sent to the insured. Each row opens the case on its Quotes or QCR tab.

const PHASES = ['AWAITING', 'TO_COMPARE', 'APPROVED', 'SENT'] as const;
type Phase = (typeof PHASES)[number];
const PHASE_LABELS: Record<Phase, string> = {
  AWAITING: 'Awaiting quotes',
  TO_COMPARE: 'QCR to approve',
  APPROVED: 'QCR to send',
  SENT: 'Sent to the insured',
};
const PHASE_VARIANT: Record<Phase, 'muted' | 'warning' | 'info' | 'success'> = {
  AWAITING: 'muted',
  TO_COMPARE: 'warning',
  APPROVED: 'info',
  SENT: 'success',
};

export function phaseOf(row: QcrSummary): Phase {
  if (row.qcr.status === 'SENT') return 'SENT';
  if (row.qcr.status === 'APPROVED') return 'APPROVED';
  return row.lowest ? 'TO_COMPARE' : 'AWAITING';
}

const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;

export function QuotesView({ serverSearch }: { serverSearch: string }) {
  const canDelete = usePermission('proposals.delete');
  const { params, replace } = useUrlSearchParams(serverSearch);
  const phase = PHASES.find((value) => value.toLowerCase() === params.get('status')) ?? null;
  const q = params.get('q') ?? '';
  const list = useQuery({
    queryKey: ['proposals', 'qcr-list'],
    queryFn: ({ signal }) => apiFetch('qcrs', { schema: QcrSummaryListSchema, signal }),
  });
  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    replace(next.toString());
  };

  const all = list.data?.items ?? [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const searched = all.filter((row) => {
    const text = [
      row.reference,
      row.clientName,
      row.lowest?.company ?? '',
      row.qcr.recommended ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const rows = searched.filter((row) => !phase || phaseOf(row) === phase);

  return (
    <>
      <PageHeader
        title="Quotes and QCR"
        description="Every case whose RFQ has gone out: the insurers’ answers, the lowest quote and where its quote comparison stands. Open a case to enter quotes or work on its QCR."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="QCR status">
        <StatusChip
          label="All"
          count={searched.length}
          pressed={phase === null}
          onClick={() => setParam('status', null)}
        />
        {PHASES.map((value) => (
          <StatusChip
            key={value}
            label={PHASE_LABELS[value]}
            count={searched.filter((row) => phaseOf(row) === value).length}
            pressed={phase === value}
            onClick={() => setParam('status', phase === value ? null : value.toLowerCase())}
          />
        ))}
      </div>
      <WorklistTable
        caption="Quotes and QCRs"
        headers={[
          { label: 'Reference' },
          { label: 'Client' },
          { label: 'Insurers' },
          { label: 'Lowest quote' },
          { label: 'QCR' },
          { label: 'Quotes needed by' },
          ...(canDelete ? [{ label: 'Actions', srOnly: true, className: 'w-10' }] : []),
        ]}
        search={q}
        onSearch={(value) => setParam('q', value || null)}
        placeholder="Reference, client or insurer"
        state={{ pending: list.isPending, error: list.error, retry: () => void list.refetch() }}
        rows={rows.map((row) => (
          <QuoteRow key={row.proposalId} row={row} />
        ))}
        empty={{
          title:
            all.length === 0
              ? 'No RFQs have gone out yet'
              : q.trim()
                ? `Nothing matches “${q.trim()}”`
                : `No case is ${PHASE_LABELS[phase ?? 'AWAITING'].toLowerCase()}`,
          description:
            all.length === 0
              ? 'Cases appear here once their RFQ is sent to an insurer.'
              : undefined,
        }}
        count={rows.length}
        noun={['case', 'cases']}
      />
    </>
  );
}

function QuoteRow({ row }: { row: QcrSummary }) {
  const phase = phaseOf(row);
  const canDelete = usePermission('proposals.delete');
  const daysLeft = daysBetween(todayIst(), row.dueDate);
  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        <Link
          href={`/proposals/${row.proposalId}?tab=${phase === 'AWAITING' ? 'quotes' : 'qcr'}`}
          className="rounded-sm text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.reference}
        </Link>
        {row.type === 'EXISTING' ? (
          <Badge variant="accent" className="ml-2">
            Renewal
          </Badge>
        ) : null}
        <span className="mt-1 block">
          <StageBadge stage={row.stage} />
        </span>
      </TableCell>
      <TableCell className="min-w-44 whitespace-normal">
        {row.clientName}
        <span className="block text-xs text-muted-foreground">{row.clientCity}</span>
      </TableCell>
      <TableCell className="min-w-40 text-sm whitespace-normal">
        <span className="tabular">
          {row.insurers.quoted} of {row.insurers.asked} quoted
        </span>
        <span className="block text-xs text-muted-foreground">
          {[
            row.insurers.declined ? `${row.insurers.declined} declined` : null,
            row.insurers.awaiting ? `${row.insurers.awaiting} awaiting` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {row.insurers.overdue ? (
            <span className="font-medium text-destructive"> · {row.insurers.overdue} overdue</span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="min-w-48 text-sm whitespace-normal">
        {row.lowest ? (
          <>
            <span className="font-medium tabular">{paise(row.lowest.total)}</span>
            <span className="block text-xs text-muted-foreground">
              {row.lowest.company}, {row.lowest.branch} · {QUOTE_OPTION_LABELS[row.lowest.option]}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">No quotes yet</span>
        )}
      </TableCell>
      <TableCell className="min-w-44 whitespace-normal">
        <Badge variant={PHASE_VARIANT[phase]}>
          {phase === 'AWAITING' || phase === 'TO_COMPARE'
            ? PHASE_LABELS[phase]
            : QCR_STATUS_LABELS[row.qcr.status]}
        </Badge>
        <span className="block text-xs text-muted-foreground">
          {row.qcr.sentAt
            ? `Sent ${formatDateTime(row.qcr.sentAt)}`
            : row.qcr.approvedAt
              ? `Approved ${formatDateTime(row.qcr.approvedAt)}`
              : row.qcr.recommended
                ? `Recommends ${row.qcr.recommended}`
                : null}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="tabular">{formatDate(row.dueDate)}</span>
        {phase === 'AWAITING' ? (
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
      {canDelete ? (
        <TableCell className="w-10 text-right">
          <DeleteCaseButton
            id={row.proposalId}
            reference={row.reference}
            clientName={row.clientName}
          />
        </TableCell>
      ) : null}
    </TableRow>
  );
}
