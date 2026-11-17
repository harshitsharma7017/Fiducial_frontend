'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { wcKeys } from '@/lib/wc/api';
import { WcCaseSchema, WcQuotesInputSchema, type WcCase } from '@/shared';

interface QuoteDraft {
  insurerId: string;
  paymentInFavourOf: string;
  /** Premium including GST by coverage option id, as typed. */
  premiums: Record<string, string>;
}

/**
 * A column for every insurer on the Insurers and RFQ tab, with its quote when saved (and any
 * insurer that quoted before being taken off the RFQ). A new one's payee starts as "M/s Company".
 */
const draftOf = (record: WcCase): QuoteDraft[] => {
  const saved = new Map(record.quotes.map((quote) => [quote.insurerId, quote]));
  const ids = [
    ...record.rfqInsurers.map((item) => item.insurerId),
    ...record.quotes
      .map((quote) => quote.insurerId)
      .filter((id) => !record.rfqInsurers.some((item) => item.insurerId === id)),
  ];
  return ids.map((insurerId) => {
    const quote = saved.get(insurerId);
    const name = record.rfqInsurers.find((item) => item.insurerId === insurerId)?.insurerName;
    return {
      insurerId,
      paymentInFavourOf: quote
        ? (quote.paymentInFavourOf ?? '')
        : name
          ? `M/s ${name.split(',')[0]}`
          : '',
      premiums: Object.fromEntries(
        (quote?.premiums ?? []).map((premium) => [premium.optionId, premium.premium ?? '']),
      ),
    };
  });
};

const amount = (value: string | undefined) => {
  const cleaned = (value ?? '').replace(/[,\s₹]/g, '');
  return cleaned ? cleaned : null;
};

/**
 * The insurers' quotes: one column per insurer with its premium (GST included) for each coverage
 * option of the Data Sheet and the payee, the lowest per option marked. The insurers the RFQ was
 * sent to are listed to start with.
 */
export function QuotesEditor({ record, canEdit }: { record: WcCase; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [quotes, setQuotes] = useState<QuoteDraft[]>(() => draftOf(record));
  // The recommendation and remarks are made on the QCR tab; they are kept as they are here.
  const recommended = record.recommendedInsurerId ?? '';
  const remarks = record.remarks ?? '';
  const save = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`wc/cases/${record.id}/quotes`, { method: 'PUT', body, schema: WcCaseSchema }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wcKeys.case(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: wcKeys.list() });
      toast({ title: 'Quotes saved', variant: 'success' });
    },
  });

  // Insurers come from the Insurers and RFQ tab (as on the other lines), or a quote saved before.
  const nameOf = (insurerId: string) =>
    record.rfqInsurers.find((item) => item.insurerId === insurerId)?.insurerName ??
    record.quotes.find((quote) => quote.insurerId === insurerId)?.insurerName ??
    'Insurer';
  const body = {
    quotes: quotes.map((quote) => ({
      insurerId: quote.insurerId,
      paymentInFavourOf: quote.paymentInFavourOf.trim() || null,
      premiums: record.coverageOptions.map((option) => ({
        optionId: option.id,
        premium: amount(quote.premiums[option.id]),
      })),
    })),
    recommendedInsurerId: quotes.some((quote) => quote.insurerId === recommended)
      ? recommended
      : null,
    remarks: remarks.trim() || null,
  };
  const parsed = WcQuotesInputSchema.safeParse(body);
  const problems = parsed.success
    ? []
    : [...new Set(parsed.error.issues.map((issue) => issue.message))];
  const disabled = !canEdit || save.isPending;
  const lowest = (optionId: string) => {
    const values = quotes
      .map((quote) => Number(amount(quote.premiums[optionId]) ?? Number.NaN))
      .filter((value) => Number.isFinite(value));
    return values.length > 1 ? Math.min(...values) : null;
  };
  const setQuote = (index: number, patch: Partial<QuoteDraft>) =>
    setQuotes((current) =>
      current.map((quote, at) => (at === index ? { ...quote, ...patch } : quote)),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotes received</CardTitle>
        <CardDescription>
          The premium including GST ({record.gstRatePercent}%) each insurer quotes for every
          coverage option. The quote comparison prints them side by side; the lowest per option is
          marked.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add the insurers on the Insurers and RFQ tab: each gets a column here for its premiums.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Quotes by insurer">
            {quotes.map((quote, index) => {
              const quotedCount = record.coverageOptions.filter((option) =>
                amount(quote.premiums[option.id]),
              ).length;
              return (
                <li
                  key={quote.insurerId}
                  className="grid content-start gap-3 rounded-md border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{nameOf(quote.insurerId)}</h3>
                    <Badge variant={quotedCount > 0 ? 'success' : 'muted'}>
                      {quotedCount > 0
                        ? `${quotedCount} of ${record.coverageOptions.length} quoted`
                        : 'Not quoted yet'}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {record.coverageOptions.map((option) => {
                      const value = quote.premiums[option.id] ?? '';
                      const min = lowest(option.id);
                      const isLowest = min !== null && Number(amount(value) ?? Number.NaN) === min;
                      const id = `wc-quote-${quote.insurerId}-${option.id}`;
                      return (
                        <div key={option.id} className="grid gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={id} className="font-normal">
                              {option.label}
                            </Label>
                            {isLowest ? <Badge variant="success">Lowest</Badge> : null}
                          </div>
                          <Input
                            id={id}
                            aria-label={`${nameOf(quote.insurerId)}: ${option.label} premium`}
                            inputMode="decimal"
                            className="text-right"
                            placeholder="Not quoted"
                            value={value}
                            disabled={disabled}
                            onChange={(event) =>
                              setQuote(index, {
                                premiums: { ...quote.premiums, [option.id]: event.target.value },
                              })
                            }
                          />
                        </div>
                      );
                    })}
                    <div className="grid gap-1.5 border-t pt-3">
                      <Label htmlFor={`wc-payee-${quote.insurerId}`} className="font-normal">
                        Cheque / payment in favour of
                      </Label>
                      <Input
                        id={`wc-payee-${quote.insurerId}`}
                        aria-label={`${nameOf(quote.insurerId)}: payment in favour of`}
                        value={quote.paymentInFavourOf}
                        maxLength={300}
                        disabled={disabled}
                        onChange={(event) =>
                          setQuote(index, { paymentInFavourOf: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canEdit ? (
          <div className="grid gap-2">
            {problems.length > 0 ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{problems.join(' ')}</AlertDescription>
              </Alert>
            ) : null}
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div>
              <Button
                type="button"
                disabled={!parsed.success || save.isPending}
                onClick={() => {
                  if (parsed.success) save.mutate(parsed.data);
                }}
              >
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Save quotes
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
