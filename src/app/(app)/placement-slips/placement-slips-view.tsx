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
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import {
  PLACED_DOCUMENT_KIND_LABELS,
  PlacementSlipSummaryListSchema,
  QUOTE_OPTION_LABELS,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type PlacementSlipSummary,
} from '@/shared';

// Every quote a client accepted, in one list: the slip to approve, to send, waiting for the
// insurer's policy, and placed. Each row opens the case on its Placement slip tab.

const PHASES = ['TO_APPROVE', 'TO_SEND', 'AWAITING_POLICY', 'PLACED'] as const;
type Phase = (typeof PHASES)[number];
const PHASE_LABELS: Record<Phase, string> = {
  TO_APPROVE: 'Slip to approve',
  TO_SEND: 'Slip to send',
  AWAITING_POLICY: 'Awaiting policy',
  PLACED: 'Placed',
};
const PHASE_VARIANT: Record<Phase, 'warning' | 'info' | 'accent' | 'success'> = {
  TO_APPROVE: 'warning',
  TO_SEND: 'info',
  AWAITING_POLICY: 'accent',
  PLACED: 'success',
};

export function phaseOf(row: PlacementSlipSummary): Phase {
  if (row.placed) return 'PLACED';
  if (row.slip.sentAt) return 'AWAITING_POLICY';
  return row.slip.status === 'APPROVED' ? 'TO_SEND' : 'TO_APPROVE';
}

const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;

export function PlacementSlipsView({ serverSearch }: { serverSearch: string }) {
  const canDelete = usePermission('property.delete');
  const { params, replace } = useUrlSearchParams(serverSearch);
  const phase =
    PHASES.find((value) => value.toLowerCase().replace(/_/g, '-') === params.get('status')) ?? null;
  const q = params.get('q') ?? '';
  const list = useQuery({
    queryKey: ['proposals', 'placement-slip-list'],
    queryFn: ({ signal }) =>
      apiFetch('placement-slips', { schema: PlacementSlipSummaryListSchema, signal }),
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
    const text = [row.reference, row.clientName, row.accepted.company, row.placed?.number ?? '']
      .join(' ')
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const rows = searched.filter((row) => !phase || phaseOf(row) === phase);

  return (
    <>
      <PageHeader
        title="Placement Slips"
        description="Every quote a client has accepted: the slip to approve and send to the insurer, and the policy or cover note it is waiting for. Open a case to work on its slip."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Placement slip status">
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
            onClick={() =>
              setParam('status', phase === value ? null : value.toLowerCase().replace(/_/g, '-'))
            }
          />
        ))}
      </div>
      <WorklistTable
        caption="Placement slips"
        headers={[
          { label: 'Reference' },
          { label: 'Client' },
          { label: 'Quote accepted' },
          { label: 'Total premium', className: 'text-right' },
          { label: 'Slip' },
          { label: 'Policy or cover note' },
          ...(canDelete ? [{ label: 'Actions', srOnly: true, className: 'w-10' }] : []),
        ]}
        search={q}
        onSearch={(value) => setParam('q', value || null)}
        placeholder="Reference, client, insurer or policy number"
        state={{ pending: list.isPending, error: list.error, retry: () => void list.refetch() }}
        rows={rows.map((row) => (
          <SlipRow key={row.proposalId} row={row} />
        ))}
        empty={{
          title:
            all.length === 0
              ? 'No client has accepted a quote yet'
              : q.trim()
                ? `Nothing matches “${q.trim()}”`
                : `No slip is ${PHASE_LABELS[phase ?? 'TO_APPROVE'].toLowerCase()}`,
          description:
            all.length === 0
              ? 'A case appears here once the quote its client accepted is recorded.'
              : undefined,
        }}
        count={rows.length}
        noun={['slip', 'slips']}
      />
    </>
  );
}

function SlipRow({ row }: { row: PlacementSlipSummary }) {
  const phase = phaseOf(row);
  const canDelete = usePermission('property.delete');
  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        <Link
          href={`/proposals/${row.proposalId}?tab=placement-slip`}
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
      <TableCell className="min-w-52 text-sm whitespace-normal">
        {row.accepted.company}, {row.accepted.branch}
        <span className="block text-xs text-muted-foreground">
          {QUOTE_OPTION_LABELS[row.accepted.option]}
          {row.accepted.withTerrorism === null
            ? ''
            : row.accepted.withTerrorism
              ? ' · with terrorism'
              : ' · without terrorism'}{' '}
          · accepted {formatDate(row.accepted.acceptedOn)}
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular whitespace-nowrap">
        {paise(row.accepted.total)}
      </TableCell>
      <TableCell className="min-w-40 whitespace-normal">
        <Badge variant={PHASE_VARIANT[phase]}>{PHASE_LABELS[phase]}</Badge>
        <span className="block text-xs text-muted-foreground">
          {row.slip.sentAt
            ? `Sent ${formatDateTime(row.slip.sentAt)}`
            : row.slip.approvedAt
              ? `Approved ${formatDateTime(row.slip.approvedAt)}`
              : null}
        </span>
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {row.placed ? (
          <>
            <span className="font-medium">
              {PLACED_DOCUMENT_KIND_LABELS[row.placed.documentKind]} {row.placed.number}
            </span>
            <span className="block text-xs text-muted-foreground">
              Issued {formatDate(row.placed.issuedOn)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
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
