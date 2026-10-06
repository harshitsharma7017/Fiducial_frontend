'use client';

import { CircleAlert, LoaderCircle, Upload } from 'lucide-react';
import { PREVIEW_COLUMNS } from '@/components/imports/preview-columns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ImportReport } from '@/shared';

/**
 * Every row of a previewed file: Valid or Invalid, the row's main values and its problems by
 * column. Valid rows can be ticked for import; rows with problems cannot.
 */
export function ImportPreview({
  report,
  selected,
  onSelectedChange,
  onImport,
  importing,
  recordLabel,
}: {
  report: ImportReport;
  selected: ReadonlySet<number>;
  onSelectedChange: (rows: Set<number>) => void;
  onImport: () => void;
  importing: boolean;
  /** Plural, lower case: "clients". */
  recordLabel: string;
}) {
  const columns = PREVIEW_COLUMNS[report.entity];
  const validRows = report.rows.filter((row) => row.valid).map((row) => row.row);
  const allChosen = validRows.length > 0 && validRows.every((row) => selected.has(row));
  const someChosen = validRows.some((row) => selected.has(row));
  const count = validRows.filter((row) => selected.has(row)).length;

  function toggle(row: number, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(row);
    else next.delete(row);
    onSelectedChange(next);
  }

  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
        <CardTitle className="tabular">
          Preview — {report.validRows} valid, {report.invalidRows} with errors ({report.rowsRead}{' '}
          {report.rowsRead === 1 ? 'row' : 'rows'})
        </CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {count === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">
              {validRows.length === 0
                ? 'No row can be imported yet. Fix the problems in the file and preview it again.'
                : 'Tick the rows to import.'}
            </p>
          ) : null}
          <Button onClick={onImport} disabled={count === 0 || importing}>
            {importing ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            Import {count} {recordLabel}
          </Button>
        </div>
      </CardHeader>

      {report.fileErrors.length > 0 ? (
        <div className="border-b p-4">
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Nothing was imported</AlertTitle>
            <AlertDescription>
              <ul className="grid gap-1">
                {report.fileErrors.map((error, index) => (
                  <li key={index}>
                    {error.column ? <strong>{error.column} — </strong> : null}
                    {error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div
        className="max-h-[65vh] overflow-auto"
        role="region"
        aria-label="Rows in the file"
        tabIndex={0}
      >
        <Table>
          <TableCaption className="sr-only">
            Each row of the file. Tick the valid rows to import.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead scope="col" className="w-16">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={allChosen ? true : someChosen ? 'indeterminate' : false}
                    disabled={validRows.length === 0}
                    onCheckedChange={(on) =>
                      onSelectedChange(new Set(on === true ? validRows : []))
                    }
                    aria-label="Import all valid rows"
                  />
                  Import
                </span>
              </TableHead>
              <TableHead scope="col" className="text-right">
                Row
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              {columns.map((column) => (
                <TableHead key={column.header} scope="col">
                  {column.header}
                </TableHead>
              ))}
              <TableHead scope="col">Problems (field — reason)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow
                key={row.row}
                className={cn(!row.valid && 'bg-destructive-soft/50 hover:bg-destructive-soft/70')}
              >
                <TableCell>
                  <Checkbox
                    checked={row.valid && selected.has(row.row)}
                    disabled={!row.valid}
                    onCheckedChange={(on) => toggle(row.row, on === true)}
                    aria-label={row.valid ? `Import row ${row.row}` : `Row ${row.row} has problems`}
                  />
                </TableCell>
                <TableCell className="tabular text-right">{row.row}</TableCell>
                <TableCell
                  className={cn('font-medium', row.valid ? 'text-success' : 'text-destructive')}
                >
                  {row.valid ? 'Valid' : 'Invalid'}
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.header} className="max-w-56 break-words">
                    {column.cell(row.values) || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                ))}
                <TableCell className="min-w-72">
                  {row.issues.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="grid gap-1 text-destructive">
                      {row.issues.map((issue, index) => (
                        <li key={index}>
                          {issue.column ? <strong>{issue.column}</strong> : null}
                          {issue.column ? ' — ' : null}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
