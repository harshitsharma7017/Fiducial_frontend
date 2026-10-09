'use client';

import { CircleAlert, CircleCheck, LoaderCircle, Replace } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CatalogImportReport, CatalogMaster } from '@/shared';

/** Problems shown per sheet; the rest are counted. */
const SHOWN_ISSUES = 50;

/** Where each master is viewed and edited. */
export const CATALOG_PAGES: Record<CatalogMaster, string> = {
  products: '/masters/products',
  sections: '/masters/sections',
  addons: '/masters/addons',
  'addon-rules': '/masters/addons?tab=rates',
  'tax-rates': '/masters/tax-rates',
  notes: '/masters/notes',
  clauses: '/masters/clauses',
  'occupancy-defaults': '/masters/occupancy-defaults',
};

/**
 * A checked or saved product and cover masters workbook: each sheet's rows and problems, and
 * replacing the masters once every sheet passes.
 */
export function CatalogImportResult({
  report,
  onSave,
  saving,
}: {
  report: CatalogImportReport;
  onSave: () => void;
  saving: boolean;
}) {
  if (report.fileErrors.length > 0) {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>This file cannot be imported</AlertTitle>
        <AlertDescription>
          {report.fileErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </AlertDescription>
      </Alert>
    );
  }
  const present = report.sheets.filter((sheet) => sheet.present);
  const problems = present.reduce((total, sheet) => total + sheet.issues.length, 0);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
        <CardTitle className="text-base">
          {report.imported ? 'Masters replaced' : 'Preview — policy and cover masters'}
        </CardTitle>
        {report.imported ? null : (
          <Button onClick={onSave} disabled={problems > 0 || saving}>
            {saving ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Replace aria-hidden="true" />
            )}
            Replace {present.length === 1 ? 'this master' : `these ${present.length} masters`}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 py-5">
        {report.imported ? (
          <Alert variant="success">
            <CircleCheck aria-hidden="true" />
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>
              New proposals, the Data Sheet and the RFQ use them from now on. Proposals already
              created keep their GST rate.
            </AlertDescription>
          </Alert>
        ) : problems > 0 ? (
          <Alert variant="warning" role="status">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>
              {problems} {problems === 1 ? 'problem' : 'problems'} to fix first
            </AlertTitle>
            <AlertDescription>
              Nothing is saved until every sheet passes. Fix the rows in Excel and preview again.
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every sheet passes. Replacing saves each sheet below as the whole of its master.
          </p>
        )}

        <Table>
          <TableCaption className="sr-only">Sheets in the workbook</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Master</TableHead>
              <TableHead className="text-right">Rows in file</TableHead>
              <TableHead className="text-right">
                Rows saved {report.imported ? 'before' : 'now'}
              </TableHead>
              <TableHead>Check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.sheets.map((sheet) => (
              <TableRow key={sheet.master}>
                <TableCell className="font-medium">
                  <Link
                    href={CATALOG_PAGES[sheet.master]}
                    className="text-accent-strong hover:underline"
                  >
                    {sheet.label}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    Sheet “{sheet.sheetName}”
                  </span>
                </TableCell>
                <TableCell className="tabular text-right">
                  {sheet.present ? sheet.rows : '—'}
                </TableCell>
                <TableCell className="tabular text-right">{sheet.currentRows}</TableCell>
                <TableCell>
                  {!sheet.present ? (
                    <Badge variant="muted">Not in file: unchanged</Badge>
                  ) : sheet.issues.length === 0 ? (
                    <Badge variant="success">{report.imported ? 'Replaced' : 'Passes'}</Badge>
                  ) : (
                    <Badge variant="destructive">
                      {sheet.issues.length} {sheet.issues.length === 1 ? 'problem' : 'problems'}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {present
          .filter((sheet) => sheet.issues.length > 0)
          .map((sheet) => (
            <section
              key={sheet.master}
              aria-label={`Problems in ${sheet.label}`}
              className="grid gap-2"
            >
              <h3 className="text-sm font-semibold">
                {sheet.label}{' '}
                <span className="font-normal text-muted-foreground">
                  (sheet “{sheet.sheetName}”)
                </span>
              </h3>
              <ul className="grid gap-1 text-sm">
                {sheet.issues.slice(0, SHOWN_ISSUES).map((issue, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="w-16 shrink-0 text-muted-foreground tabular">
                      {issue.row === null ? 'Sheet' : `Row ${issue.row}`}
                    </span>
                    <span>
                      {issue.column ? <span className="font-medium">{issue.column}: </span> : null}
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
              {sheet.issues.length > SHOWN_ISSUES ? (
                <p className="text-xs text-muted-foreground">
                  And {sheet.issues.length - SHOWN_ISSUES} more.
                </p>
              ) : null}
            </section>
          ))}
      </CardContent>
    </Card>
  );
}
