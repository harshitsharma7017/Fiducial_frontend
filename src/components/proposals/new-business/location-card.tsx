'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { itemSumInsured, locationTotal, type DataSheetForm } from '@/lib/data-sheet';
import { formatInr } from '@/lib/money';
import { EQ_ZONE_LABELS, FIRE_ITEMS, RISK_DETAIL_FIELDS } from '@/shared';
import { RupeesField, TextAreaField, TextField } from './data-sheet-fields';

/** What the Data Sheet shows about a risk location, from the proposal or the client master. */
export interface LocationInfo {
  name: string;
  address: string;
  district: string;
  eqZone: keyof typeof EQ_ZONE_LABELS | null;
  /** Null when the location has the client's occupancy. */
  occupancy: { tacCode: string; description: string } | null;
}

/**
 * One risk location of the Data Sheet: its Fire items (measured ones as area × rate, or a typed
 * amount), hypothecation, stock in the open and the RFQ's risk details.
 */
export function LocationCard({
  index,
  info,
  readOnly,
  onRemove,
}: {
  index: number;
  info: LocationInfo | undefined;
  readOnly: boolean;
  onRemove: () => void;
}) {
  const form = useFormContext<DataSheetForm>();
  const fire = useWatch({ control: form.control, name: `locations.${index}.fire` });
  const risk = useWatch({ control: form.control, name: `locations.${index}.risk` });
  const name = info?.name ?? 'Location no longer in the client master';
  const filled = Object.values(risk ?? {}).filter((value) => value?.trim()).length;
  // Open at first when something is already filled; after that the user decides.
  const [riskOpen] = useState(() => filled > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <CardTitle>{name}</CardTitle>
          {info ? (
            <CardDescription>
              {info.address}
              {info.district ? ` · District ${info.district}` : ''}
              {info.eqZone ? ` · ${EQ_ZONE_LABELS[info.eqZone]}` : ''}
              <br />
              Occupancy{' '}
              {info.occupancy
                ? `${info.occupancy.tacCode} — ${info.occupancy.description}`
                : 'as the client'}
            </CardDescription>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="tabular">
            {formatInr(locationTotal({ fire }))}
          </Badge>
          {readOnly ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 aria-hidden="true" />
              Remove<span className="sr-only"> {name}</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fire item</TableHead>
              <TableHead className="text-right">Area (sq ft)</TableHead>
              <TableHead className="text-right">Rate per sq ft</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Sum insured</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FIRE_ITEMS.map((item, itemIndex) => {
              const values = fire?.[itemIndex];
              const path = `locations.${index}.fire.${itemIndex}` as const;
              return (
                <TableRow key={item.key}>
                  <TableCell className="min-w-48 whitespace-normal">{item.label}</TableCell>
                  <TableCell className="align-top">
                    {item.measured ? (
                      <TextField
                        name={`${path}.sqFt`}
                        label={`${item.label} area in sq ft`}
                        hideLabel
                        inputMode="decimal"
                        autoComplete="off"
                        className="min-w-24"
                      />
                    ) : (
                      <span className="block text-right text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {item.measured ? (
                      <RupeesField
                        name={`${path}.ratePerSqFt`}
                        label={`${item.label} rate per sq ft`}
                        hideLabel
                      />
                    ) : (
                      <span className="block text-right text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <RupeesField name={`${path}.amount`} label={`${item.label} amount`} hideLabel />
                  </TableCell>
                  <TableCell className="text-right tabular whitespace-nowrap">
                    {values ? formatInr(itemSumInsured({ ...values, key: item.key })) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-medium">
                Total for {name}
              </TableCell>
              <TableCell className="text-right font-medium tabular whitespace-nowrap">
                {formatInr(locationTotal({ fire }))}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <p className="-mt-3 text-xs text-muted-foreground">
          For buildings, enter the area and rate, or type the amount instead. A typed amount wins.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField
            name={`locations.${index}.hypothecation`}
            label="Hypothecation"
            description="The bank or financier with an interest, if any."
            maxLength={300}
          />
          <TextAreaField
            name={`locations.${index}.openStock`}
            label="Stock in open space"
            description="What is stored in the open, if anything."
            maxLength={300}
          />
        </div>

        <details className="group rounded-md border" open={riskOpen || undefined}>
          <summary className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring">
            Risk details{' '}
            <span className="font-normal text-muted-foreground tabular">
              ({filled} of {RISK_DETAIL_FIELDS.length} filled)
            </span>
          </summary>
          <div className="grid gap-4 border-t p-3 sm:grid-cols-2">
            {RISK_DETAIL_FIELDS.map((field) => (
              <TextAreaField
                key={field.key}
                name={`locations.${index}.risk.${field.key}`}
                label={field.label}
                maxLength={300}
              />
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
