import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { expiryLabel, expiryUrgency, type ExpiryUrgency } from '@/lib/proposal-metrics';
import { INSURER_STATUS_LABELS, type InsurerStatus } from '@/shared';
import {
  DOC_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
  STAGE_LABELS,
  type DocStatus,
  type ProposalType,
  type Stage,
} from '@/types/proposal';

type Variant = React.ComponentProps<typeof Badge>['variant'];

export function TypeBadge({ type }: { type: ProposalType }) {
  return (
    <Badge variant={type === 'EXISTING' ? 'accent' : 'default'}>{PROPOSAL_TYPE_LABELS[type]}</Badge>
  );
}

const STAGE_VARIANT: Record<Stage, Variant> = {
  DRAFT: 'muted',
  DATA_SHEET: 'muted',
  RFQ_SENT: 'info',
  QUOTES_RECEIVED: 'info',
  QCR: 'warning',
  CLIENT_APPROVAL: 'warning',
  PLACEMENT_SLIP: 'accent',
  PLACED: 'success',
  CLOSED: 'outline',
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

const INSURER_VARIANT: Record<InsurerStatus, Variant> = {
  NOT_SENT: 'muted',
  SENT: 'info',
  REMINDED: 'info',
  QUOTED: 'success',
  DECLINED: 'destructive',
  NO_RESPONSE: 'warning',
};

/** An insurer's status on a case, with the shared label (never colour alone). */
export function InsurerStatusBadge({ status }: { status: InsurerStatus }) {
  return <Badge variant={INSURER_VARIANT[status]}>{INSURER_STATUS_LABELS[status]}</Badge>;
}

/** Sent or Reminded after the quote due date. */
export function OverdueBadge() {
  return <Badge variant="destructive">Overdue</Badge>;
}

const DOC_VARIANT: Record<DocStatus, Variant> = {
  NOT_STARTED: 'muted',
  DRAFT: 'muted',
  READY: 'info',
  SENT: 'info',
  APPROVED: 'success',
};

export function DocStatusBadge({ status }: { status: DocStatus }) {
  return <Badge variant={DOC_VARIANT[status]}>{DOC_STATUS_LABELS[status]}</Badge>;
}

const EXPIRY_VARIANT: Record<ExpiryUrgency, Variant> = {
  neutral: 'muted',
  warning: 'warning',
  danger: 'destructive',
};

/** Days-to-expiry chip for a renewal, coloured by urgency, with the days in text. */
export function ExpiryChip({
  daysToExpiry,
  placed,
  className,
}: {
  daysToExpiry: number;
  placed: boolean;
  className?: string;
}) {
  const urgency = expiryUrgency(daysToExpiry, placed);
  return (
    <Badge variant={EXPIRY_VARIANT[urgency]} className={cn('tabular', className)}>
      {expiryLabel(daysToExpiry)}
    </Badge>
  );
}
