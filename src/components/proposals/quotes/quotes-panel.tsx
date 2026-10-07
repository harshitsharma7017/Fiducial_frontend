'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, FilePlus2, History, Paperclip, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { InsurerStatusBadge } from '@/components/proposals/badges';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  ProposalQuotesSchema,
  QUOTE_OPTION_LABELS,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  hasRfq,
  quoteExpectation,
  type ProposalQuotes,
  type ProposalRecord,
  type QuoteVersion,
} from '@/shared';
import { QuoteFormSheet, type QuoteTarget } from './quote-form';

// The Quotes tab (Q-1 to Q-5): per insurer and option, the latest quote with its totals,
// deviations from the RFQ and proof; earlier versions on request; declines with their reason;
// and what the QCR will compare.

const paise = (value: string) => `₹${formatIndianNumber(value, 2)}`;

export function quotesQuery(id: string) {
  return {
    queryKey: queryKeys.proposals.quotes(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch(`proposals/${id}/quotes`, { schema: ProposalQuotesSchema, signal }),
  };
}

export function QuotesPanel({ record, canEdit }: { record: ProposalRecord; canEdit: boolean }) {
  const quotes = useQuery(quotesQuery(record.id));
  const [target, setTarget] = useState<QuoteTarget | null>(null);

  if (quotes.isPending) return <LoadingState label="Loading quotes…" />;
  if (quotes.isError) {
    return <ErrorState error={quotes.error} onRetry={() => void quotes.refetch()} />;
  }
  const data = quotes.data;
  const editable = canEdit && record.stage !== 'CLOSED';

  if (data.insurers.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No insurers on this case yet. Choose them and send the RFQ on the Insurers and RFQ tab.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <QcrSummary quotes={data} />
      {data.insurers.map((insurer) => {
        const name = `${insurer.company}, ${insurer.branch}`;
        return (
          <Card key={insurer.insurerId}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {name}
                  <InsurerStatusBadge status={insurer.status} />
                </CardTitle>
                <CardDescription>
                  {insurer.declined
                    ? `Declined: ${insurer.declined.reason ?? 'no reason given'} (${insurer.declined.by}, ${formatDateTime(insurer.declined.at)}). Left out of the QCR.`
                    : hasRfq(insurer.status)
                      ? 'Enter each option the insurer quoted, with its mail or PDF.'
                      : 'The RFQ has not gone to this insurer yet.'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {insurer.quotes.map(({ option, versions }) => {
                const latest = versions[0];
                const asked = data.options.includes(option);
                return (
                  <section
                    key={option}
                    aria-label={`${name}: ${QUOTE_OPTION_LABELS[option]}`}
                    className="grid gap-2 rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {QUOTE_OPTION_LABELS[option]}
                        {latest ? (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            · version {latest.version}
                          </span>
                        ) : null}
                        {!asked ? (
                          <Badge variant="muted" className="ml-2">
                            No longer asked for
                          </Badge>
                        ) : null}
                      </h3>
                      {editable && asked && hasRfq(insurer.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={latest ? 'outline' : 'default'}
                          aria-label={`${latest ? 'Revise quote' : 'Enter quote'} for ${name}, ${QUOTE_OPTION_LABELS[option]}`}
                          onClick={() =>
                            setTarget({
                              insurerId: insurer.insurerId,
                              name,
                              option,
                              expectation: quoteExpectation(record, option),
                              latest,
                            })
                          }
                        >
                          {latest ? (
                            <PencilLine aria-hidden="true" />
                          ) : (
                            <FilePlus2 aria-hidden="true" />
                          )}
                          {latest ? 'Revise quote' : 'Enter quote'}
                        </Button>
                      ) : null}
                    </div>
                    {latest ? (
                      <QuoteSummary record={record} quote={latest} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No quote yet.</p>
                    )}
                    {versions.length > 1 ? (
                      <details className="text-sm">
                        <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                          <History aria-hidden="true" className="size-4" />
                          Earlier versions ({versions.length - 1})
                        </summary>
                        <ol className="mt-2 grid gap-3 border-l pl-3">
                          {versions.slice(1).map((version) => (
                            <li key={version.id} className="grid gap-1">
                              <span className="font-medium">Version {version.version}</span>
                              <QuoteSummary record={record} quote={version} />
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                  </section>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
      <QuoteFormSheet
        record={record}
        quotes={data}
        target={target}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

function QuoteSummary({ record, quote }: { record: ProposalRecord; quote: QuoteVersion }) {
  const { withTerrorism, withoutTerrorism } = quote.totals;
  return (
    <div className="grid gap-2 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Net premium</dt>
          <dd className="font-medium tabular">{paise(withTerrorism.net)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">GST {quote.gstRatePercent}%</dt>
          <dd className="tabular">{paise(withTerrorism.gst)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total premium</dt>
          <dd className="font-semibold tabular">{paise(withTerrorism.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total without terrorism</dt>
          <dd className="tabular">{withoutTerrorism ? paise(withoutTerrorism.total) : '—'}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {quote.createdBy}, {formatDateTime(quote.createdAt)}
        {quote.reason ? ` · Revised: ${quote.reason}` : ''}
        {quote.validUntil ? ` · Valid until ${formatDate(quote.validUntil)}` : ''}
        {quote.capacityPercent ? ` · Capacity ${quote.capacityPercent}%` : ''}
      </p>
      {quote.deviations.length > 0 ? (
        <div className="grid gap-1 rounded-md border border-warning/30 bg-warning-soft px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CircleAlert aria-hidden="true" className="size-3.5" />
            {quote.deviations.length} {quote.deviations.length === 1 ? 'deviation' : 'deviations'}{' '}
            from the RFQ
          </p>
          <ul className="list-disc pl-5 text-xs">
            {quote.deviations.map((deviation) => (
              <li key={deviation}>{deviation}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-success">As the RFQ asked.</p>
      )}
      <ul className="flex flex-wrap gap-2" aria-label="The insurer’s mail or PDF">
        {quote.attachments.map((attachment) => (
          <li key={attachment.id}>
            <a
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
              href={`/api/proxy/proposals/${record.id}/quote-attachments/${attachment.id}`}
            >
              <Paperclip aria-hidden="true" className="size-3" />
              {attachment.fileName}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the QCR will compare: each option's latest quote of the insurers that have not declined. */
function QcrSummary({ quotes }: { quotes: ProposalQuotes }) {
  const declined = quotes.insurers.filter((insurer) => insurer.declined);
  return (
    <Card>
      <CardHeader>
        <CardTitle>For the QCR</CardTitle>
        <CardDescription>
          The latest version of each quote, from insurers that have not declined.
          {declined.length > 0
            ? ` Left out: ${declined.map((insurer) => `${insurer.company}, ${insurer.branch}`).join('; ')}.`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {quotes.qcr.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotes recorded yet.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {quotes.qcr.map((entry) => (
              <li key={entry.quoteId}>
                {entry.company}, {entry.branch} — {QUOTE_OPTION_LABELS[entry.option]}, version{' '}
                {entry.version}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
