'use client';

import { Copy, X } from 'lucide-react';
import { InsurerStatusBadge, OverdueBadge } from '@/components/proposals/badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  formatDate,
  formatDateTime,
  isAwaitingResponse,
  type ProposalInsurer,
  type ProposalRecord,
} from '@/shared';
import { MarkSentDialog } from './mark-sent-dialog';
import { ReminderDialog } from './reminder-dialog';
import { ResponseDialog } from './response-dialog';
import { copyText } from './use-rfq';

export interface RowPermissions {
  canEdit: boolean;
  canSend: boolean;
  /** Mail can be sent from the app (not turned off). */
  mailOn: boolean;
}

/** Where the RFQ stands with one insurer: status, Overdue, due date, sent, reminders, answer (8.1). */
function StatusCell({ insurer }: { insurer: ProposalInsurer }) {
  const via = insurer.sentVia === 'APP' ? 'emailed' : 'sent outside the app';
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <InsurerStatusBadge status={insurer.status} />
        {insurer.overdue ? <OverdueBadge /> : null}
      </div>
      <dl className="grid gap-0.5 text-xs text-muted-foreground tabular">
        {insurer.dueDate ? (
          <div>
            <dt className="inline">Quotes due </dt>
            <dd className="inline">{formatDate(insurer.dueDate)}</dd>
          </div>
        ) : null}
        {insurer.sentAt ? (
          <div>
            <dt className="inline">{via[0]?.toUpperCase() + via.slice(1)} </dt>
            <dd className="inline">
              {formatDateTime(insurer.sentAt)}
              {insurer.sentBy ? ` · ${insurer.sentBy}` : ''}
            </dd>
          </div>
        ) : null}
        {insurer.reminderCount > 0 ? (
          <div>
            <dt className="inline">Reminders </dt>
            <dd className="inline">
              {insurer.reminderCount}
              {insurer.lastRemindedAt ? `, last ${formatDateTime(insurer.lastRemindedAt)}` : ''}
            </dd>
          </div>
        ) : null}
        {insurer.lastMail?.result === 'FAILED' ? (
          <div className="text-destructive">
            Last mail failed · {formatDateTime(insurer.lastMail.at)}
          </div>
        ) : null}
        {insurer.response?.note ? (
          <div>
            <dt className="inline">Note </dt>
            <dd className="inline text-foreground">“{insurer.response.note}”</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function InsurerRow({
  record,
  insurer,
  permissions,
  removing,
  onRemove,
}: {
  record: ProposalRecord;
  insurer: ProposalInsurer;
  permissions: RowPermissions;
  removing: boolean;
  onRemove: () => void;
}) {
  const { canEdit, canSend, mailOn } = permissions;
  const name = `${insurer.company}, ${insurer.branch}`;
  const complete = record.missing.length === 0;
  const open = record.stage !== 'CLOSED';
  const notSent = insurer.status === 'NOT_SENT';

  return (
    <TableRow>
      <TableCell className="min-w-40 whitespace-normal">
        <span className="font-medium">{insurer.company}</span>
        <span className="block text-xs text-muted-foreground">{insurer.branch}</span>
        {insurer.active ? null : <Badge variant="warning">Inactive</Badge>}
      </TableCell>
      <TableCell className="min-w-48 whitespace-normal">
        {insurer.rfqEmails.length === 0 ? (
          <span className="text-sm text-muted-foreground">None on file</span>
        ) : (
          <div className="flex items-start gap-1">
            <span className="text-sm break-all">{insurer.rfqEmails.join(', ')}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => void copyText(insurer.rfqEmails.join(', '), 'Addresses')}
            >
              <Copy aria-hidden="true" />
              <span className="sr-only">Copy addresses for {name}</span>
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-44 whitespace-normal">
        <StatusCell insurer={insurer} />
      </TableCell>
      {canEdit || canSend ? (
        <TableCell className="text-right">
          <div className="flex flex-wrap justify-end gap-1">
            {open && notSent && canSend ? (
              <MarkSentDialog
                record={record}
                insurers={[insurer]}
                disabled={!complete}
                outsideApp={mailOn}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!complete}
                    aria-label={`${mailOn ? 'Sent outside the app' : 'Mark sent'}: ${name}`}
                  >
                    {mailOn ? 'Sent outside the app' : 'Mark sent'}
                  </Button>
                }
              />
            ) : null}
            {open && notSent && canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removing}
                onClick={onRemove}
                aria-label={`Remove ${name}`}
              >
                <X aria-hidden="true" />
                Remove
              </Button>
            ) : null}
            {open && mailOn && canSend && isAwaitingResponse(insurer.status) ? (
              <ReminderDialog record={record} insurer={insurer} />
            ) : null}
            {open && canEdit && !notSent ? (
              <ResponseDialog record={record} insurer={insurer} />
            ) : null}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
