'use client';

import { Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
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
import { formatAmountForInput } from '@/lib/amount-input';
import { groupTotal, itemSumInsured, locationTotal, type DataSheetForm } from '@/lib/data-sheet';
import { formatInr } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  EQ_ZONE_LABELS,
  FIRE_ITEM_HEADINGS,
  FIRE_ITEMS,
  HYPOTHECATION_LABEL,
  OPEN_STOCK_LABEL,
  RISK_DETAIL_FIELDS,
} from '@/shared';
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
 * One risk location of the Data Sheet: Fire & Burglary laid out as the client's Data Sheet (7
 * numbered items with sub-items, sq ft × rate for buildings, a running total), hypothecation and
 * stock in open space (D-3, D-7), and the RFQ's risk details.
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
        <section aria-label={`Fire & Burglary for ${name}`} className="grid gap-3">
          <h3 className="text-sm font-semibold">Fire &amp; Burglary</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">
                  Sq. Feet
                  <span className="block font-normal normal-case">(total builtup area)</span>
                </TableHead>
                <TableHead className="text-right">
                  Rate / sq ft
                  <span className="block font-normal normal-case">
                    (construction cost per sq ft)
                  </span>
                </TableHead>
                <TableHead className="text-right">Sum Insured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIRE_ITEMS.map((item, itemIndex) => {
                const values = fire?.[itemIndex];
                const path = `locations.${index}.fire.${itemIndex}` as const;
                const heading = FIRE_ITEM_HEADINGS[item.group];
                const firstOfGroup =
                  FIRE_ITEMS.findIndex((other) => other.group === item.group) === itemIndex;
                const isSub = heading !== undefined || item.number.length > 1;
                const computed =
                  item.measured && values && !values.amount?.trim()
                    ? itemSumInsured({ ...values, key: item.key })
                    : null;
                return (
                  <Fragment key={item.key}>
                    {heading && firstOfGroup ? (
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-medium tabular">{heading.number}</TableCell>
                        <TableCell colSpan={3} className="min-w-64 font-medium whitespace-normal">
                          {heading.label}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular whitespace-nowrap">
                          {formatInr(groupTotal({ fire }, item.group))}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    <TableRow>
                      <TableCell className="align-top text-muted-foreground tabular">
                        {isSub ? item.number.slice(-1) : item.number}
                      </TableCell>
                      <TableCell
                        className={cn('min-w-64 align-top whitespace-normal', isSub && 'pl-6')}
                      >
                        {item.label}
                      </TableCell>
                      <TableCell className="align-top">
                        {item.measured ? (
                          <TextField
                            name={`${path}.sqFt`}
                            label={`Item ${item.number} sq ft`}
                            hideLabel
                            inputMode="decimal"
                            autoComplete="off"
                            className="min-w-24"
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        {item.measured ? (
                          <RupeesField
                            name={`${path}.ratePerSqFt`}
                            label={`Item ${item.number} rate per sq ft`}
                            hideLabel
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <RupeesField
                          name={`${path}.amount`}
                          label={`Item ${item.number} sum insured`}
                          hideLabel
                          placeholder={
                            computed && computed !== '0'
                              ? formatAmountForInput(computed)
                              : undefined
                          }
                          description={computed && computed !== '0' ? 'Sq ft × rate' : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell />
                <TableCell colSpan={3} className="font-medium">
                  Total sum insured
                </TableCell>
                <TableCell
                  className="text-right font-medium tabular whitespace-nowrap"
                  aria-live="polite"
                >
                  {formatInr(locationTotal({ fire }))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="text-xs text-muted-foreground">
            For buildings, enter the area and the rate: the sum insured is sq ft × rate, kept exact
            and shown to the rupee, as in the Excel Data Sheet. A typed sum insured is used instead.
          </p>
          <ol className="grid gap-4 sm:grid-cols-2">
            <li>
              <TextAreaField
                name={`locations.${index}.hypothecation`}
                label={`1. ${HYPOTHECATION_LABEL}`}
                description="The bank or financier with an interest. Printed on the RFQ."
                maxLength={300}
              />
            </li>
            <li>
              <TextAreaField
                name={`locations.${index}.openStock`}
                label={`2. ${OPEN_STOCK_LABEL}`}
                description="What is stored in the open, and how much. Printed on the RFQ."
                maxLength={300}
              />
            </li>
          </ol>
        </section>

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
