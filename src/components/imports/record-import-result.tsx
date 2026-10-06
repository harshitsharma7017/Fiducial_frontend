'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { ImportPreview } from '@/components/imports/import-preview';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IMPORT_SHEETS, type ImportEntity, type ImportReport } from '@/shared';

/** Where the imported records can be seen. */
const RESULT_PAGES: Record<ImportEntity, { href: string; label: string }> = {
  clients: { href: '/masters/clients', label: 'View clients' },
  'client-locations': { href: '/masters/clients', label: 'View clients' },
  insurers: { href: '/masters/insurers', label: 'View insurers' },
};

/**
 * After a records preview: the rows to tick and import, a file that cannot be read, or, once
 * imported, how many were saved and left out.
 */
export function RecordImportResult({
  entity,
  report,
  done,
  selected,
  onSelectedChange,
  onImport,
  importing,
  onStartOver,
}: {
  entity: ImportEntity;
  /** The preview, or a refused import re-checked. */
  report: ImportReport | undefined;
  /** The import, once rows were saved. */
  done: ImportReport | null;
  selected: ReadonlySet<number>;
  onSelectedChange: (rows: Set<number>) => void;
  onImport: (rows: number[]) => void;
  importing: boolean;
  onStartOver: () => void;
}) {
  const label = IMPORT_SHEETS[entity].label.toLowerCase();

  if (done) {
    // Rows with problems and valid rows that were unticked.
    const leftOut = done.rowsRead - done.createdCount;
    return (
      <Alert variant="success" role="status">
        <CircleCheck aria-hidden="true" />
        <AlertTitle>
          {done.createdCount} {done.createdCount === 1 ? label.replace(/s$/, '') : label} imported
        </AlertTitle>
        <AlertDescription>
          <p>
            Each one is in the audit log as a create.
            {leftOut > 0 ? ` ${leftOut} ${leftOut === 1 ? 'row was' : 'rows were'} left out.` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={RESULT_PAGES[done.entity].href}>{RESULT_PAGES[done.entity].label}</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={onStartOver}>
              Import another file
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!report || report.entity !== entity) return null;

  if (report.rows.length === 0) {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>This file cannot be imported</AlertTitle>
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
    );
  }

  return (
    <ImportPreview
      report={report}
      selected={selected}
      onSelectedChange={onSelectedChange}
      onImport={() =>
        onImport(
          report.rows.filter((row) => row.valid && selected.has(row.row)).map((row) => row.row),
        )
      }
      importing={importing}
      recordLabel={label}
    />
  );
}
