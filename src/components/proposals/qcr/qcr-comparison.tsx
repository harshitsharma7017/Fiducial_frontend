'use client';

import { CircleAlert, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { QUOTE_OPTION_LABELS, formatIndianNumber, type Qcr, type QcrOption } from '@/shared';

// The comparison per option (QC-1, QC-2): the existing policy and every insurer's latest quote
// side by side, Fire without terrorism as the client's QCR compares, the lowest total marked, and
// where the insurers' cover differs.

const paise = (value: string | null) => (value === null ? '—' : `₹${formatIndianNumber(value, 2)}`);
const rupees = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 0)}`;

export function QcrComparison({ qcr, renewal }: { qcr: Qcr; renewal: boolean }) {
  const options = qcr.options.filter((option) => option.quotes.length > 0);
  if (options.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No quotes to compare yet. Record the insurers’ quotes on the Quotes tab.
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {options.map((option) => (
        <OptionCard key={option.option} qcr={qcr} option={option} renewal={renewal} />
      ))}
    </div>
  );
}

function OptionCard({ qcr, option, renewal }: { qcr: Qcr; option: QcrOption; renewal: boolean }) {
  const columns = qcr.insurers.map((insurer) => ({
    insurer,
    quote: option.quotes.find((quote) => quote.insurerId === insurer.insurerId),
  }));
  const name = (insurerId: string) => {
    const insurer = qcr.insurers.find((item) => item.insurerId === insurerId);
    return insurer ? `${insurer.company}, ${insurer.branch}` : '';
  };
  const recommended = qcr.recommendedOption === option.option ? qcr.recommendedInsurerId : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{QUOTE_OPTION_LABELS[option.option]}</CardTitle>
        <CardDescription>
          Premiums with Fire without terrorism, as the QCR compares them. The lowest total is
          marked.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">
              {QUOTE_OPTION_LABELS[option.option]}: premiums by section and insurer
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                {renewal ? (
                  <>
                    <TableHead className="text-right">Existing sum insured</TableHead>
                    <TableHead className="text-right">Existing premium</TableHead>
                  </>
                ) : null}
                <TableHead className="text-right">Sum insured</TableHead>
                {columns.map(({ insurer, quote }) => (
                  <TableHead
                    key={insurer.insurerId}
                    className={cn('text-right', quote?.lowest && 'bg-success-soft')}
                  >
                    <span className="block">
                      {insurer.company}, {insurer.branch}
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {quote?.lowest ? (
                        <Badge variant="success">
                          <Trophy aria-hidden="true" />
                          Lowest
                        </Badge>
                      ) : null}
                      {recommended === insurer.insurerId ? (
                        <Badge variant="info">Recommended</Badge>
                      ) : null}
                      {quote ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          v{quote.version}
                        </span>
                      ) : null}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {option.sections.map((section) => (
                <TableRow key={section.code}>
                  <TableCell>{section.name}</TableCell>
                  {renewal ? (
                    <>
                      <TableCell className="text-right tabular">
                        {rupees(section.existingSumInsured)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {paise(section.existingPremium)}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="text-right tabular">{rupees(section.sumInsured)}</TableCell>
                  {columns.map(({ insurer, quote }) => {
                    const premium =
                      quote?.premiums.find((item) => item.code === section.code)?.premium ?? null;
                    return (
                      <TableCell key={insurer.insurerId} className="text-right tabular">
                        {!quote ? (
                          <span className="text-muted-foreground">No quote</span>
                        ) : premium === null ? (
                          <span className="text-warning">Not quoted</span>
                        ) : (
                          <>
                            {paise(premium)}
                            {section.code === 'FIRE' && quote.fireWithTerrorism ? (
                              <span className="block text-xs text-muted-foreground">
                                with terrorism (no other figure)
                              </span>
                            ) : null}
                          </>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {(['net', 'gst', 'total'] as const).map((key) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">
                    {key === 'net'
                      ? 'Net premium'
                      : key === 'gst'
                        ? `GST ${qcr.gstRatePercent}%`
                        : 'Total premium'}
                  </TableCell>
                  {renewal ? (
                    <>
                      <TableCell />
                      <TableCell className="text-right tabular">
                        {paise(option.existing?.[key] ?? null)}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell />
                  {columns.map(({ insurer, quote }) => (
                    <TableCell
                      key={insurer.insurerId}
                      className={cn(
                        'text-right tabular',
                        key === 'total' && 'font-semibold',
                        key === 'total' && quote?.lowest && 'bg-success-soft text-success',
                      )}
                    >
                      {quote ? paise(quote.totals[key]) : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {columns.some(({ quote }) => quote?.terrorismExtra) ? (
                <TableRow>
                  <TableCell className="text-xs font-normal">
                    Terrorism, extra net premium
                  </TableCell>
                  {renewal ? <TableCell colSpan={2} /> : null}
                  <TableCell />
                  {columns.map(({ insurer, quote }) => (
                    <TableCell
                      key={insurer.insurerId}
                      className="text-right text-xs font-normal tabular"
                    >
                      {quote?.terrorismExtra ? paise(quote.terrorismExtra) : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ) : null}
            </TableFooter>
          </Table>
        </div>

        {columns.some(({ quote }) => (quote?.deviations.length ?? 0) > 0) ? (
          <section aria-label="Deviations from the RFQ" className="grid gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <CircleAlert aria-hidden="true" className="size-4 text-warning" />
              Departs from the RFQ
            </h3>
            <ul className="grid gap-1 text-sm">
              {columns.flatMap(({ insurer, quote }) =>
                (quote?.deviations ?? []).map((deviation) => (
                  <li key={`${insurer.insurerId}-${deviation}`}>
                    <span className="font-medium">
                      {insurer.company}, {insurer.branch}:
                    </span>{' '}
                    {deviation}
                  </li>
                )),
              )}
            </ul>
          </section>
        ) : null}

        {option.differences.length > 0 ? (
          <section aria-label="Where the insurers differ" className="grid gap-2">
            <h3 className="text-sm font-semibold">Where the insurers differ</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cover or term</TableHead>
                  {qcr.insurers.map((insurer) => (
                    <TableHead key={insurer.insurerId}>
                      {insurer.company}, {insurer.branch}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {option.differences.map((difference) => (
                  <TableRow key={difference.topic}>
                    <TableCell className="whitespace-normal">{difference.topic}</TableCell>
                    {qcr.insurers.map((insurer) => (
                      <TableCell key={insurer.insurerId} className="whitespace-normal">
                        {difference.values.find((value) => value.insurerId === insurer.insurerId)
                          ?.value ?? '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ) : null}
        <p className="sr-only">
          Lowest total:{' '}
          {option.quotes
            .filter((quote) => quote.lowest)
            .map((quote) => name(quote.insurerId))
            .join(', ')}
        </p>
      </CardContent>
    </Card>
  );
}
