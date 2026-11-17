'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { wcKeys } from '@/lib/wc/api';
import { WcCaseSchema, WcPlacementInputSchema, formatIndianNumber, type WcCase } from '@/shared';
import { WcDocumentButtons } from './wc-ui';

/** A choice the client can accept: an insurer's quoted premium for one coverage option. */
interface Choice {
  key: string;
  insurerId: string;
  optionId: string;
  label: string;
}

/**
 * The client's decision and the placement: the insurer and coverage option accepted (from the
 * quotes), the placement slip to that insurer, and the policy number once issued, which places
 * the case.
 */
export function WcPlacementPanel({ record, canEdit }: { record: WcCase; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const choices: Choice[] = record.quotes.flatMap((quote) =>
    record.coverageOptions.flatMap((option) => {
      const premium = quote.premiums.find((item) => item.optionId === option.id)?.premium;
      return premium
        ? [
            {
              key: `${quote.insurerId}|${option.id}`,
              insurerId: quote.insurerId,
              optionId: option.id,
              label: `${quote.insurerName} — ${option.label} — ₹${formatIndianNumber(premium, premium.includes('.') ? 2 : 0)}`,
            },
          ]
        : [];
    }),
  );
  const placement = record.placement;
  const [choice, setChoice] = useState(
    placement ? `${placement.insurerId}|${placement.optionId}` : '',
  );
  const [policyNumber, setPolicyNumber] = useState(placement?.policyNumber ?? '');
  const [policyStart, setPolicyStart] = useState(placement?.policyStart ?? '');
  const [policyEnd, setPolicyEnd] = useState(placement?.policyEnd ?? '');
  const chosen = choices.find((item) => item.key === choice);
  const body = chosen
    ? {
        insurerId: chosen.insurerId,
        optionId: chosen.optionId,
        policyNumber: policyNumber.trim() || null,
        policyStart: policyStart || null,
        policyEnd: policyEnd || null,
      }
    : null;
  const parsed = body ? WcPlacementInputSchema.safeParse(body) : null;
  const problems =
    parsed && !parsed.success
      ? [...new Set(parsed.error.issues.map((issue) => issue.message))]
      : [];
  const save = useMutation({
    mutationFn: (input: unknown) =>
      apiFetch(`wc/cases/${record.id}/placement`, {
        method: 'PUT',
        body: input,
        schema: WcCaseSchema,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wcKeys.case(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: wcKeys.list() });
      toast({
        title: saved.stage === 'PLACED' ? 'Case placed' : 'Placement saved',
        variant: 'success',
      });
    },
  });
  const disabled = !canEdit || save.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Placement slip</CardTitle>
        <CardDescription>
          The insurer and coverage the client accepted, from the quotes. The placement slip goes to
          that insurer; the policy number, once issued, places the case.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {record.stage === 'PLACED' && placement ? (
          <Alert variant="success">
            <CircleCheck aria-hidden="true" />
            <AlertTitle>Placed: policy {placement.policyNumber}</AlertTitle>
            <AlertDescription>
              {placement.insurerName}, {placement.optionLabel}.
            </AlertDescription>
          </Alert>
        ) : null}
        {choices.length === 0 ? (
          <EmptyState
            title="No quote to accept yet"
            description="Record the insurers’ quotes first."
          />
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="wc-placement-choice">Insurer and coverage accepted</Label>
              <NativeSelect
                id="wc-placement-choice"
                value={choice}
                disabled={disabled}
                onChange={(event) => setChoice(event.target.value)}
              >
                <option value="">Choose the quote accepted</option>
                {choices.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="wc-policy-number">Policy number</Label>
                <Input
                  id="wc-policy-number"
                  value={policyNumber}
                  maxLength={100}
                  placeholder="Once issued"
                  disabled={disabled}
                  onChange={(event) => setPolicyNumber(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wc-policy-start">Policy start</Label>
                <Input
                  id="wc-policy-start"
                  type="date"
                  value={policyStart}
                  disabled={disabled}
                  onChange={(event) => setPolicyStart(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wc-policy-end">Policy end</Label>
                <Input
                  id="wc-policy-end"
                  type="date"
                  value={policyEnd}
                  disabled={disabled}
                  onChange={(event) => setPolicyEnd(event.target.value)}
                />
              </div>
            </div>
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
                    disabled={!parsed?.success || save.isPending}
                    onClick={() => {
                      if (parsed?.success) save.mutate(parsed.data);
                    }}
                  >
                    {save.isPending ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : null}
                    {policyNumber.trim() ? 'Save and mark placed' : 'Save placement'}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
        <WcDocumentButtons
          record={record}
          kind="placement-slip"
          disabledReason={placement ? null : 'Save the quote accepted first.'}
        />
      </CardContent>
    </Card>
  );
}
