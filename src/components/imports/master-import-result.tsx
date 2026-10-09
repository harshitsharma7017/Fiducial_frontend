'use client';

import { CircleAlert, CircleCheck, Info, LoaderCircle, Save, Zap } from 'lucide-react';
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
import { formatIndianNumber, type MasterImportResult, type MasterVersionStats } from '@/shared';

const count = (value: number) => formatIndianNumber(String(value), 0);

function StatsRow({ label, stats }: { label: string; stats: MasterVersionStats }) {
  return (
    <TableRow>
      <TableHead scope="row" className="normal-case">
        {label}
      </TableHead>
      <TableCell className="tabular text-right">{count(stats.rowsRead)}</TableCell>
      <TableCell className="tabular text-right">{count(stats.recordsImported)}</TableCell>
      <TableCell className="tabular text-right">{count(stats.rowsSkipped)}</TableCell>
      <TableCell className="tabular text-right">{count(stats.warningCount)}</TableCell>
    </TableRow>
  );
}

/**
 * A checked or saved IIB master workbook: how many occupancies and pincodes it holds, the full
 * validation report, then saving it as a new version and activating that version.
 */
export function MasterImportResultView({
  result,
  onSave,
  saving,
  onActivate,
  activating,
  activated,
}: {
  result: MasterImportResult;
  onSave: () => void;
  saving: boolean;
  onActivate: (versionIds: string[]) => void;
  activating: boolean;
  activated: boolean;
}) {
  if (result.fileError) {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>This file cannot be imported</AlertTitle>
        <AlertDescription>
          <p className="whitespace-pre-line">{result.fileError}</p>
          <p className="mt-2">
            Start from the IIB master template, or download the current master and edit it.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const drafts = result.versions.filter((version) => version.status === 'DRAFT');
  const live =
    activated ||
    (result.versions.length > 0 && result.versions.every((version) => version.status === 'ACTIVE'));
  const title = result.dryRun ? 'Preview — IIB master' : 'Saved as a new version';

  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          {result.versions.length > 0 ? (
            <Badge variant={live ? 'success' : 'warning'}>{live ? 'Active' : 'Draft'}</Badge>
          ) : null}
        </CardTitle>
        {result.dryRun ? (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {result.alreadyImported ? 'Continue with the earlier upload' : 'Save as new version'}
          </Button>
        ) : null}
        {drafts.length > 0 && !activated ? (
          <Button
            onClick={() => onActivate(drafts.map((version) => version.id))}
            disabled={activating}
          >
            {activating ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Zap aria-hidden="true" />
            )}
            Activate
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 py-4">
        {result.alreadyImported && result.dryRun ? (
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>This exact file was uploaded before</AlertTitle>
            <AlertDescription>
              Continue to pick up that upload (and activate it if it is still a draft). To make a
              new version, change the file first.
            </AlertDescription>
          </Alert>
        ) : null}
        {live ? (
          <Alert variant="success" role="status">
            <CircleCheck aria-hidden="true" />
            <AlertTitle>This version is active</AlertTitle>
            <AlertDescription>
              <p>
                Occupancy and pincode lookups and client and location forms now use it. The previous
                version is kept as superseded.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/masters/occupancy">View occupancies</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/masters/pincodes">View pincodes</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : drafts.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Saved as a draft. Nothing changes until you activate it: then lookups and client and
            location forms switch to this version.
          </p>
        ) : null}

        {result.occupancy && result.pincode ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableCaption className="sr-only">What the workbook holds</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Sheet</TableHead>
                  <TableHead scope="col" className="text-right">
                    Rows read
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Imported
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Left out
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Warnings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <StatsRow label="Occupancies (IIB Code)" stats={result.occupancy} />
                <StatsRow label="Pincodes" stats={result.pincode} />
              </TableBody>
            </Table>
          </div>
        ) : null}

        {result.reportText ? (
          <details className="rounded-md border px-3 py-2 text-sm">
            <summary className="cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Validation report: every data problem found, by row
            </summary>
            <pre className="mt-3 max-h-[28rem] overflow-auto text-xs leading-relaxed whitespace-pre-wrap">
              {result.reportText}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
