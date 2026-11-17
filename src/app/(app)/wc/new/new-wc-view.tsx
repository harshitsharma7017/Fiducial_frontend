'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ClientSearch } from '@/components/ghi/new-ghi-case-form';
import { PageHeader } from '@/components/page-header';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { apiFetch } from '@/lib/api-client';
import { wcKeys } from '@/lib/wc/api';
import { WC_TYPES, WC_TYPE_LABELS, WcCaseSchema, type Client, type WcType } from '@/shared';

/** Starts a workmen compensation case for a client: its Data Sheet follows the client’s format. */
export function NewWcView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [client, setClient] = useState<Client | null>(null);
  const [type, setType] = useState<WcType>('NEW');
  const create = useMutation({
    mutationFn: () =>
      apiFetch('wc/cases', {
        method: 'POST',
        body: { clientId: client?.id, type },
        schema: WcCaseSchema,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: wcKeys.all });
      router.push(`/wc/${created.id}`);
    },
  });
  return (
    <>
      <PageHeader
        title="New WC case"
        description="Choose the company. The Data Sheet starts with the worker categories, coverage options, clauses and conditions of the client’s format, all editable."
      />
      <DemoModeGate>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Company and type</CardTitle>
            <CardDescription>The company must be in the client master.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {client ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span>
                  <span className="font-medium">{client.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {client.gstin ?? 'No GSTIN'} · {client.address.city}
                  </span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setClient(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <ClientSearch onChoose={setClient} />
            )}
            <div className="grid max-w-xs gap-1.5">
              <Label htmlFor="wc-type">Type</Label>
              <NativeSelect
                id="wc-type"
                value={type}
                onChange={(event) => setType(event.target.value as WcType)}
              >
                {WC_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {WC_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {create.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(create.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!client || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Create case
              </Button>
              <Button asChild variant="outline">
                <Link href="/wc">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DemoModeGate>
    </>
  );
}
