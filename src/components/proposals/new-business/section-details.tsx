'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch, type FieldPath } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { annexureTotal, blankAnnexureRow, type DataSheetForm } from '@/lib/data-sheet';
import { formatInr } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  ANNEXURE_SECTIONS,
  BURGLARY_BASES,
  BURGLARY_BASIS_LABELS,
  MAX_ANNEXURE_ROWS,
  SECTION_LINES,
  SUM_INSURED_LINE,
  SUM_INSURED_LINES,
  annexureColumnLabel,
  type AnnexureColumn,
  type AnnexureSection,
  type BurglaryBasis,
  type OtherSection,
  type SectionWithLines,
} from '@/shared';
import { RupeesField, TextField } from './data-sheet-fields';

/**
 * The Data Sheet's lines under a section (D-4: FLOP, Money, Fidelity, Public Liability) in the
 * RFQ's columns (C-2): the policy in force (Existing), Option 1 and Option 2.
 */
export function SectionLines({
  index,
  code,
  name,
}: {
  index: number;
  code: OtherSection;
  name: string;
}) {
  const lines = SECTION_LINES[code as SectionWithLines] ?? [];
  return (
    <Table>
      <TableCaption className="sr-only">{name} lines</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Line</TableHead>
          <TableHead className="text-right">Existing</TableHead>
          <TableHead className="text-right">Proposed – Option 1</TableHead>
          <TableHead className="text-right">Proposed – Option 2</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, number) => {
          // A line that is the sum insured on its own (FLOP's gross profit, Fidelity's and PL's
          // limits): its Existing and Option 2 are in the section's row. Money's lines add up.
          const isSumInsured = SUM_INSURED_LINE[code] === line.key;
          const addsUp = !isSumInsured && SUM_INSURED_LINES[code]?.includes(line.key) === true;
          const label = `${number + 1}. ${line.label}`;
          const field = (path: FieldPath<DataSheetForm>, fieldLabel: string) =>
            line.kind === 'count' ? (
              <TextField
                name={path}
                label={fieldLabel}
                hideLabel
                inputMode="numeric"
                autoComplete="off"
                className="min-w-24 [&_input]:text-right"
              />
            ) : (
              <RupeesField name={path} label={fieldLabel} hideLabel />
            );
          return (
            <TableRow key={line.key}>
              <TableCell className="min-w-48 whitespace-normal">
                {label}
                {isSumInsured ? (
                  <span className="block text-xs text-muted-foreground">
                    The {name} sum insured; its Existing and Proposed – Option 2 are in the
                    section’s row.
                  </span>
                ) : addsUp ? (
                  <span className="block text-xs text-muted-foreground">
                    Adds up to the {name} sum insured.
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="align-top">
                {isSumInsured
                  ? null
                  : field(`sections.${index}.existingLines.${line.key}`, `${label} Existing`)}
              </TableCell>
              <TableCell className="align-top">
                {field(`sections.${index}.lines.${line.key}`, label)}
              </TableCell>
              <TableCell className="align-top">
                {isSumInsured
                  ? null
                  : field(`sections.${index}.lines2.${line.key}`, `${label} Proposed – Option 2`)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * The basis of a Burglary sum insured (C-3): 100%, or first loss of 25, 50 or 75%. Burglary's
 * sum insured is then the Fire contents; the share on the basis is shown per option.
 */
export function BasisField({
  index,
  name,
  amounts,
  allowTyped,
}: {
  index: number;
  name: string;
  amounts: { proposed1: string | null; proposed2: string | null } | null;
  /** A Burglary saved with a typed amount and no basis may stay so. */
  allowTyped: boolean;
}) {
  const form = useFormContext<DataSheetForm>();
  const id = `basis-${index}`;
  return (
    <div className="grid gap-1 sm:max-w-md">
      <Label htmlFor={id}>{name} basis</Label>
      <FormBasis id={id} index={index} allowTyped={allowTyped} disabled={form.formState.disabled} />
      {amounts ? (
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          On this basis: Proposed – Option 1{' '}
          {amounts.proposed1 !== null ? formatInr(amounts.proposed1) : '—'}
          {amounts.proposed2 !== null
            ? `, Proposed – Option 2 ${formatInr(amounts.proposed2)}`
            : ''}
        </p>
      ) : null}
    </div>
  );
}

function FormBasis({
  id,
  index,
  allowTyped,
  disabled,
}: {
  id: string;
  index: number;
  allowTyped: boolean;
  disabled: boolean | undefined;
}) {
  const form = useFormContext<DataSheetForm>();
  const value = useWatch({ control: form.control, name: `sections.${index}.basis` }) ?? null;
  return (
    <NativeSelect
      id={id}
      value={value ?? ''}
      disabled={disabled}
      className={cn('max-w-md')}
      onChange={(event) =>
        form.setValue(
          `sections.${index}.basis`,
          event.target.value ? (event.target.value as BurglaryBasis) : null,
          { shouldDirty: true },
        )
      }
    >
      {allowTyped || value === null ? <option value="">Typed amount (no basis)</option> : null}
      {BURGLARY_BASES.map((basis) => (
        <option key={basis} value={basis}>
          {BURGLARY_BASIS_LABELS[basis]}
        </option>
      ))}
    </NativeSelect>
  );
}

/**
 * An annexure grid (D-5) in the client's Annexure layout: add or remove items; their total is the
 * section's sum insured.
 */
export function AnnexureGrid({
  index,
  code,
  name,
  readOnly,
}: {
  index: number;
  code: AnnexureSection;
  name: string;
  readOnly: boolean;
}) {
  const form = useFormContext<DataSheetForm>();
  const rows = useFieldArray({ control: form.control, name: `sections.${index}.annexure` });
  const values = useWatch({ control: form.control, name: `sections.${index}.annexure` }) ?? [];
  const columns = ANNEXURE_SECTIONS[code].columns as readonly AnnexureColumn[];

  return (
    <div className="grid gap-2">
      <Table>
        <TableCaption className="sr-only">{name} annexure</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">S No</TableHead>
            {columns.map((column) => (
              <TableHead key={column}>{annexureColumnLabel(code, column)}</TableHead>
            ))}
            <TableHead className="text-right">Sum Insured</TableHead>
            {readOnly ? null : (
              <TableHead>
                <span className="sr-only">Remove</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.fields.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 3} className="text-sm text-muted-foreground">
                No items yet. Add each item to insure; their total becomes the sum insured.
              </TableCell>
            </TableRow>
          ) : (
            rows.fields.map((field, row) => (
              <TableRow key={field.id}>
                <TableCell className="align-top text-muted-foreground tabular">{row + 1}</TableCell>
                {columns.map((column) => (
                  <TableCell key={column} className="align-top">
                    <TextField
                      name={`sections.${index}.annexure.${row}.${column}`}
                      label={`${name} item ${row + 1} ${annexureColumnLabel(code, column)}`}
                      hideLabel
                      autoComplete="off"
                      inputMode={column === 'quantity' || column === 'year' ? 'numeric' : undefined}
                      className={column === 'description' ? 'min-w-48' : 'min-w-28'}
                    />
                  </TableCell>
                ))}
                <TableCell className="align-top">
                  <RupeesField
                    name={`sections.${index}.annexure.${row}.sumInsured`}
                    label={`${name} item ${row + 1} sum insured`}
                    hideLabel
                  />
                </TableCell>
                {readOnly ? null : (
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => rows.remove(row)}
                    >
                      <Trash2 aria-hidden="true" />
                      <span className="sr-only">
                        Remove {name} item {row + 1}
                      </span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell />
            <TableCell colSpan={columns.length} className="font-medium">
              Total — {name} sum insured
            </TableCell>
            <TableCell
              className="text-right font-medium tabular whitespace-nowrap"
              aria-live="polite"
            >
              {formatInr(annexureTotal(values))}
            </TableCell>
            {readOnly ? null : <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>
      {readOnly || rows.fields.length >= MAX_ANNEXURE_ROWS ? null : (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => rows.append(blankAnnexureRow())}
            aria-label={`Add row to ${name}`}
          >
            <Plus aria-hidden="true" />
            Add row
          </Button>
        </div>
      )}
    </div>
  );
}
