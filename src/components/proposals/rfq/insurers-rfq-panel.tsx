'use client';

import { useQuery } from '@tanstack/react-query';
import { Copy, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermission } from '@/hooks/use-permission';
import type { ProposalInsurer, ProposalRecord } from '@/shared';
import { rfqStateQuery } from '@/components/proposals/rfq-review/rfq-review-panel';
import { DownloadRfqButtons } from './download-rfq';
import { InsurersCard } from './insurers-card';
import { MarkSentDialog } from './mark-sent-dialog';
import { SendRfqDialog } from './send-rfq-dialog';
import { copyText, useMailStatus } from './use-rfq';

function emailsOf(insurers: readonly ProposalInsurer[]): string[] {
  return [...new Set(insurers.flatMap((insurer) => insurer.rfqEmails))];
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary tabular"
      >
        {number}
      </span>
      <div className="grid min-w-0 gap-2">
        <h3 className="text-sm font-semibold">
          <span className="sr-only">Step {number}: </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

/**
 * The RFQ round: choose up to five insurers, check the RFQ, email it to each insurer from the
 * app (or record that it went another way), then remind and record answers. The first insurer
 * sent locks the Data Sheet.
 */
export function InsurersRfqPanel({ record }: { record: ProposalRecord }) {
  const canEdit = usePermission('property.edit');
  const canSend = usePermission('property.send');
  const canExport = usePermission('property.export');
  const mail = useMailStatus();
  // Unknown (the user cannot read the settings) counts as on until a send says otherwise.
  const mailOn = mail?.transport !== 'off';
  const unsent = record.insurers.filter((insurer) => insurer.status === 'NOT_SENT');
  const complete = record.missing.length === 0;
  // R-5: the RFQ goes to insurers only once its latest version is approved (RFQ review tab).
  const rfq = useQuery(rfqStateQuery(record.id));
  const approved = rfq.data?.sendable ?? false;
  const ready = complete && approved;
  const open = record.stage !== 'CLOSED';
  const markTrigger = (label: string, variant: 'default' | 'outline') => (
    <Button type="button" variant={variant} disabled={!ready}>
      {variant === 'default' ? <Send aria-hidden="true" /> : null}
      {label}
    </Button>
  );

  return (
    <div className="grid gap-6 *:min-w-0">
      <InsurersCard
        record={record}
        permissions={{ canEdit, canSend, mailOn, rfqApproved: approved }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Send the RFQ</CardTitle>
          <CardDescription>
            {mailOn
              ? 'Each insurer gets its own mail with the RFQ attached. Every mail is kept on the Activity tab.'
              : 'Sending mail from the app is turned off. Email the workbook from your mailbox, then record it here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-5">
            <Step number={1} title="Check the RFQ">
              {complete ? (
                <p className="text-sm text-muted-foreground">
                  Premium details for the insurer to fill in, the schedule, Fire by location, risk
                  details and claim details.
                </p>
              ) : (
                <p className="text-sm text-warning">
                  Complete the Data Sheet first: {record.missing.length}{' '}
                  {record.missing.length === 1 ? 'item is' : 'items are'} still needed.
                </p>
              )}
              {canExport ? (
                <DownloadRfqButtons record={record} disabled={!complete} />
              ) : (
                <p className="text-sm text-muted-foreground">Your role cannot download the RFQ.</p>
              )}
            </Step>
            <Step
              number={2}
              title={mailOn ? 'Email it to the insurers' : 'Email it and mark it as sent'}
            >
              {unsent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {record.insurers.length === 0
                    ? 'Choose insurers above first.'
                    : 'Every chosen insurer has the RFQ.'}
                </p>
              ) : complete && rfq.data && !approved ? (
                <p className="text-sm text-warning">{rfq.data.blocked} Use the RFQ review tab.</p>
              ) : !canSend || !open ? (
                <p className="text-sm text-muted-foreground">
                  {open ? 'Your role cannot send the RFQ.' : 'This case is closed.'}
                </p>
              ) : mailOn ? (
                <div className="flex flex-wrap items-center gap-2">
                  {ready ? (
                    <SendRfqDialog record={record} insurers={unsent} />
                  ) : (
                    markTrigger('Email the RFQ', 'default')
                  )}
                  <MarkSentDialog
                    record={record}
                    insurers={unsent}
                    disabled={!ready}
                    outsideApp
                    trigger={markTrigger('Sent outside the app', 'outline')}
                  />
                </div>
              ) : (
                <>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm break-words select-all">
                    {emailsOf(unsent).join(', ') || 'No RFQ addresses on file'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={emailsOf(unsent).length === 0}
                      onClick={() => void copyText(emailsOf(unsent).join(', '), 'Addresses')}
                    >
                      <Copy aria-hidden="true" />
                      Copy all addresses
                    </Button>
                    <MarkSentDialog
                      record={record}
                      insurers={unsent}
                      disabled={!ready}
                      outsideApp={false}
                      trigger={markTrigger(
                        `Mark as sent to ${unsent.length === 1 ? '1 insurer' : `all ${unsent.length}`}`,
                        'default',
                      )}
                    />
                  </div>
                </>
              )}
            </Step>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
