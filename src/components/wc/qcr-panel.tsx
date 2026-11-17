'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { wcKeys } from '@/lib/wc/api';
import { WcCaseSchema, formatIndianNumber, type WcCase } from '@/shared';
import { WcDocumentButtons } from './wc-ui';

const rupees = (value: string) => `₹${formatIndianNumber(value, value.includes('.') ? 2 : 0)}`;

/**
 * The quote comparison (QCR): each coverage option's premium from every insurer side by side,
 * the lowest marked, and the broker's recommendation and remarks printed on the QCR.
 */
export function WcQcrPanel({ record, canEdit }: { record: WcCase; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [recommended, setRecommended] = useState(record.recommendedInsurerId ?? '');
  const [remarks, setRemarks] = useState(record.remarks ?? '');
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`wc/cases/${record.id}/quotes`, {
        method: 'PUT',
        body: {
          quotes: record.quotes.map((quote) => ({
            insurerId: quote.insurerId,
            paymentInFavourOf: quote.paymentInFavourOf,
            premiums: quote.premiums,
          })),
          recommendedInsurerId: recommended || null,
          remarks: remarks.trim() || null,
        },
        schema: WcCaseSchema,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wcKeys.case(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: wcKeys.list() });
      toast({ title: 'Recommendation saved', variant: 'success' });
    },
  });
  const premiumOf = (insurerId: string, optionId: string) =>
    record.quotes
      .find((quote) => quote.insurerId === insurerId)
      ?.premiums.find((premium) => premium.optionId === optionId)?.premium ?? null;
  const lowestOf = (optionId: string) => {
    const values = record.quotes
      .map((quote) => premiumOf(quote.insurerId, optionId))
      .filter((value): value is string => value !== null)
      .map(Number);
    return values.length > 0 ? Math.min(...values) : null;
  };
  const disabled = !canEdit || save.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote comparison (QCR)</CardTitle>
        <CardDescription>
          The premiums saved on the Quotes tab, including GST ({record.gstRatePercent}%). Choose the
          insurer to recommend; the QCR prints the comparison, the lowest per option and the
          recommendation.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {record.quotes.length === 0 ? (
          <EmptyState title="No quotes yet" description="Record the insurers’ quotes first." />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coverage</TableHead>
                  {record.quotes.map((quote) => (
                    <TableHead key={quote.insurerId} className="min-w-44 text-right">
                      {quote.insurerName}
                      {quote.insurerId === record.recommendedInsurerId ? (
                        <Badge variant="accent" className="ml-1">
                          Recommended
                        </Badge>
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.coverageOptions.map((option) => {
                  const lowest = lowestOf(option.id);
                  return (
                    <TableRow key={option.id}>
                      <TableCell>{option.label}</TableCell>
                      {record.quotes.map((quote) => {
                        const premium = premiumOf(quote.insurerId, option.id);
                        return (
                          <TableCell key={quote.insurerId} className="text-right tabular">
                            {premium === null ? (
                              <span className="text-muted-foreground">Not quoted</span>
                            ) : (
                              <>
                                {rupees(premium)}
                                {record.quotes.length > 1 && Number(premium) === lowest ? (
                                  <Badge variant="success" className="ml-1">
                                    Lowest
                                  </Badge>
                                ) : null}
                              </>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell>Cheque / payment in favour of</TableCell>
                  {record.quotes.map((quote) => (
                    <TableCell key={quote.insurerId} className="text-right">
                      {quote.paymentInFavourOf ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wc-recommended">Our recommendation</Label>
            <NativeSelect
              id="wc-recommended"
              value={recommended}
              disabled={disabled || record.quotes.length === 0}
              onChange={(event) => setRecommended(event.target.value)}
            >
              <option value="">None yet</option>
              {record.quotes.map((quote) => (
                <option key={quote.insurerId} value={quote.insurerId}>
                  {quote.insurerName}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wc-remarks">Remarks</Label>
            <Textarea
              id="wc-remarks"
              rows={2}
              maxLength={2000}
              value={remarks}
              disabled={disabled}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>
        </div>
        {canEdit ? (
          <div className="grid gap-2">
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div>
              <Button
                type="button"
                disabled={save.isPending || record.quotes.length === 0}
                onClick={() => save.mutate()}
              >
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Save recommendation
              </Button>
            </div>
          </div>
        ) : null}
        <WcDocumentButtons
          record={record}
          kind="qcr"
          disabledReason={record.quotes.length === 0 ? 'Record the quotes first.' : null}
        />
      </CardContent>
    </Card>
  );
}
