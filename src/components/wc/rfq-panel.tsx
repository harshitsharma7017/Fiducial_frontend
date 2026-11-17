'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { todayIst } from '@/lib/dates';
import { wcKeys } from '@/lib/wc/api';
import { InsurerListResponseSchema, WcCaseSchema, WcRfqInputSchema, type WcCase } from '@/shared';
import { WcDocumentButtons } from './wc-ui';

interface Row {
  insurerId: string;
  insurerName: string;
  sentOn: string;
}

/**
 * The insurers the RFQ goes to: download the RFQ, send it to each insurer and record the day it
 * was sent. Insurers sent the RFQ are offered first on the Quotes tab.
 */
export function WcRfqPanel({ record, canEdit }: { record: WcCase; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const insurers = useQuery({
    queryKey: ['insurers', 'list', 'active', 'wc'],
    queryFn: ({ signal }) =>
      apiFetch('insurers?active=true&limit=100', { schema: InsurerListResponseSchema, signal }),
  });
  const [rows, setRows] = useState<Row[]>(() =>
    record.rfqInsurers.map((item) => ({
      insurerId: item.insurerId,
      insurerName: item.insurerName,
      sentOn: item.sentOn ?? '',
    })),
  );
  const [adding, setAdding] = useState('');
  const save = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`wc/cases/${record.id}/rfq`, { method: 'PUT', body, schema: WcCaseSchema }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wcKeys.case(record.id), saved);
      void queryClient.invalidateQueries({ queryKey: wcKeys.list() });
      toast({ title: 'RFQ insurers saved', variant: 'success' });
    },
  });
  const body = {
    insurers: rows.map((row) => ({ insurerId: row.insurerId, sentOn: row.sentOn || null })),
  };
  const parsed = WcRfqInputSchema.safeParse(body);
  const disabled = !canEdit || save.isPending;
  const available = (insurers.data?.items ?? []).filter(
    (item) => !rows.some((row) => row.insurerId === item.id),
  );
  const notReady = record.missing.length > 0 ? 'Complete the Data Sheet first.' : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insurers and RFQ</CardTitle>
        <CardDescription>
          Download the RFQ, send it to each insurer and record the day it went. The RFQ has the
          coverage options for the insurers to quote, without any premium.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <WcDocumentButtons record={record} kind="rfq" disabledReason={notReady} />
        {insurers.isError ? (
          <ErrorState error={insurers.error} onRetry={() => void insurers.refetch()} />
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insurer chosen yet.</p>
        ) : (
          <ul className="grid gap-2" aria-label="RFQ insurers">
            {rows.map((row, index) => (
              <li
                key={row.insurerId}
                className="flex flex-wrap items-end justify-between gap-3 rounded-md border px-3 py-2"
              >
                <span className="grid gap-1">
                  <span className="text-sm font-medium">{row.insurerName}</span>
                  <Badge variant={row.sentOn ? 'success' : 'muted'}>
                    {row.sentOn ? 'RFQ sent' : 'Not sent yet'}
                  </Badge>
                </span>
                <span className="flex items-end gap-2">
                  <span className="grid gap-1">
                    <Label htmlFor={`wc-rfq-${row.insurerId}`} className="text-xs">
                      Sent on
                    </Label>
                    <Input
                      id={`wc-rfq-${row.insurerId}`}
                      type="date"
                      className="w-40"
                      value={row.sentOn}
                      disabled={disabled}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item, at) =>
                            at === index ? { ...item, sentOn: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </span>
                  {disabled ? null : (
                    <>
                      {row.sentOn ? null : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRows((current) =>
                              current.map((item, at) =>
                                at === index ? { ...item, sentOn: todayIst() } : item,
                              ),
                            )
                          }
                        >
                          Sent today
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${row.insurerName}`}
                        onClick={() =>
                          setRows((current) => current.filter((_item, at) => at !== index))
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {disabled ? null : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-64 gap-1.5">
              <Label htmlFor="wc-rfq-add">Add an insurer</Label>
              <NativeSelect
                id="wc-rfq-add"
                value={adding}
                disabled={insurers.isPending}
                onChange={(event) => setAdding(event.target.value)}
              >
                <option value="">Choose an insurer</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.company}, {item.branch}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!adding}
              onClick={() => {
                const item = insurers.data?.items.find((insurer) => insurer.id === adding);
                if (!item) return;
                setRows((current) => [
                  ...current,
                  {
                    insurerId: item.id,
                    insurerName: `${item.company}, ${item.branch}`,
                    sentOn: '',
                  },
                ]);
                setAdding('');
              }}
            >
              <Plus aria-hidden="true" />
              Add insurer
            </Button>
          </div>
        )}
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
                disabled={!parsed.success || save.isPending}
                onClick={() => {
                  if (parsed.success) save.mutate(parsed.data);
                }}
              >
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Save RFQ insurers
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
