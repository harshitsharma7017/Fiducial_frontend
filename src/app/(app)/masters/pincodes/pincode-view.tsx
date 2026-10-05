'use client';

import { MapPin } from 'lucide-react';
import { useId, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MasterNotActiveState,
  isMasterNotActive,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isCompletePincode, usePincode } from '@/hooks/use-pincode';
import { ApiError } from '@/lib/api-client';
import { displayRate } from '@/lib/display';
import { EQ_ZONE_LABELS, type PincodeRecord } from '@/shared';

function PincodeResult({ record }: { record: PincodeRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="tabular">{record.pincode}</CardTitle>
        <CardDescription>
          {record.district || '—'}, {record.state || '—'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">State</dt>
          <dd>{record.state || '—'}</dd>
          <dt className="text-muted-foreground">District</dt>
          <dd>{record.district || '—'}</dd>
          <dt className="text-muted-foreground">AIFT earthquake zone</dt>
          <dd>
            {record.eqZone ? (
              <Badge variant="accent">
                {EQ_ZONE_LABELS[record.eqZone]} (zone {record.eqZone})
              </Badge>
            ) : (
              <Badge variant="warning">Not set</Badge>
            )}
          </dd>
        </dl>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Risk type</TableHead>
                <TableHead scope="col" className="text-right">
                  EQ rate ‰
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableHead scope="row" className="normal-case">
                  Residential
                </TableHead>
                <TableCell className="tabular text-right">
                  {displayRate(record.eqRates.residential)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead scope="row" className="normal-case">
                  Non-industrial
                </TableHead>
                <TableCell className="tabular text-right">
                  {displayRate(record.eqRates.nonIndustrial)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead scope="row" className="normal-case">
                  Industrial
                </TableHead>
                <TableCell className="tabular text-right">
                  {displayRate(record.eqRates.industrial)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function PincodeView() {
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState('');
  const pincode = value.trim();
  const lookup = usePincode(pincode);
  const partial = pincode.length > 0 && !isCompletePincode(pincode);

  let result;
  if (!isCompletePincode(pincode)) {
    result = (
      <EmptyState
        icon={<MapPin className="size-8" />}
        title="Enter a six-digit pincode"
        description="State, district, earthquake zone and EQ rates appear as soon as all six digits are in."
      />
    );
  } else if (lookup.isPending) {
    result = <LoadingState label={`Looking up ${pincode}…`} />;
  } else if (lookup.isError) {
    if (lookup.error instanceof ApiError && lookup.error.code === 'PINCODE_NOT_FOUND') {
      result = (
        <EmptyState
          title={`Pincode ${pincode} is not in the active master`}
          description="Check the number. The master holds about 20,600 pincodes."
        />
      );
    } else if (isMasterNotActive(lookup.error)) {
      result = <MasterNotActiveState />;
    } else {
      result = <ErrorState error={lookup.error} onRetry={() => void lookup.refetch()} />;
    }
  } else {
    result = <PincodeResult record={lookup.data} />;
  }

  return (
    <>
      <PageHeader
        title="Pincode lookup"
        description="Earthquake zone and EQ rates by risk type, from the active master."
      />
      <form
        className="mb-6 grid max-w-xs gap-2"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (isCompletePincode(pincode)) void lookup.refetch();
        }}
      >
        <Label htmlFor={inputId}>Pincode</Label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="400001"
          aria-describedby={hintId}
          aria-invalid={partial ? true : undefined}
          className="tabular"
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          Six digits, for example 400001.
        </p>
      </form>
      <div aria-live="polite" className="max-w-xl">
        {result}
      </div>
    </>
  );
}
