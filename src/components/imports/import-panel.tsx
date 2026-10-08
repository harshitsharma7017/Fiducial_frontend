'use client';

import {
  Download,
  FileSpreadsheet,
  History,
  ListOrdered,
  LoaderCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { FileDrop } from '@/components/imports/file-drop';
import { RECORD_TYPES, type RecordType } from '@/components/imports/record-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { IMPORT_SHEETS, MAX_IMPORT_ROWS } from '@/shared';

function Hint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

const linkClass =
  'rounded-sm font-medium text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

/** The hints for the IIB master: its two sheets, and how to edit it as a new version. */
function MasterHints() {
  return (
    <>
      <Hint icon={<FileSpreadsheet />}>
        Two sheets: “IIB Code” (occupancy codes and rates) and “Pincode” (earthquake zones and
        rates), laid out like the client’s IIB workbook. Keep the headers as they are.
      </Hint>
      <Hint icon={<History />}>
        To change rates,{' '}
        <a href="/api/proxy/masters/workbook" download className={linkClass}>
          download the current master
        </a>
        , edit it in Excel and upload it. Each upload is a new version; the current one stays in use
        until you activate the new one, and old versions are kept.
      </Hint>
      <Hint icon={<ShieldCheck />}>
        Preview saves nothing. It reports every data problem it finds; rows it cannot use are left
        out.
      </Hint>
    </>
  );
}

/** The hints for the product and cover masters: one sheet per master, replaced as a whole. */
function CatalogHints() {
  return (
    <>
      <Hint icon={<FileSpreadsheet />}>
        One sheet per master: Products, Coverage sections, Add-on covers, BSUS BLUS add-on rates,
        Tax rates, Standard notes, Clauses and Occupancy cover defaults. The Instructions sheet
        explains each column.
      </Hint>
      <Hint icon={<History />}>
        <a href="/api/proxy/catalog/workbook" download className={linkClass}>
          Download the current masters
        </a>
        , edit them in Excel and upload the file. Each sheet in the file replaces that master; a
        sheet you remove leaves its master as it is.
      </Hint>
      <Hint icon={<ShieldCheck />}>
        Preview saves nothing. The masters are replaced only when every sheet passes. Single rows
        can also be edited on each master’s page.
      </Hint>
    </>
  );
}

function RecordHints({ type }: { type: Exclude<RecordType, 'masters' | 'catalog'> }) {
  const info = RECORD_TYPES[type];
  return (
    <>
      <Hint icon={<FileSpreadsheet />}>
        Fill in the “{IMPORT_SHEETS[type].sheetName}” sheet of the template. Columns marked * are
        required; the Instructions sheet explains each one.{' '}
        <a href={`${info.templateUrl}?sample=true`} download className={linkClass}>
          Download a sample file
        </a>{' '}
        to see it filled in.
      </Hint>
      <Hint icon={<ListOrdered />}>
        One row per record, up to {MAX_IMPORT_ROWS.toLocaleString('en-IN')} rows. Imports only
        create new records.
      </Hint>
      <Hint icon={<ShieldCheck />}>
        Preview saves nothing. Rows with errors can be left out, and the rest imported.
      </Hint>
    </>
  );
}

/** Choose what to import, get its template, and pick the filled-in file to preview. */
export function ImportPanel({
  types,
  type,
  onTypeChange,
  file,
  onFileChange,
  onPreview,
  previewing,
  busy,
}: {
  types: readonly RecordType[];
  type: RecordType;
  onTypeChange: (type: RecordType) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onPreview: () => void;
  previewing: boolean;
  /** True while anything runs: the controls are locked. */
  busy: boolean;
}) {
  const typeId = useId();
  const info = RECORD_TYPES[type];

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
        <CardTitle className="text-base">Import</CardTitle>
        <Button asChild variant="outline">
          <a href={info.templateUrl} download>
            <Download aria-hidden="true" />
            {info.templateLabel}
          </a>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 py-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor={typeId}>Record type</Label>
            <NativeSelect
              id={typeId}
              value={type}
              disabled={busy}
              onChange={(event) => onTypeChange(event.target.value as RecordType)}
            >
              {types.map((option) => (
                <option key={option} value={option}>
                  {RECORD_TYPES[option].label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
          <ul className="grid gap-2.5 text-sm text-muted-foreground">
            {type === 'masters' ? (
              <MasterHints />
            ) : type === 'catalog' ? (
              <CatalogHints />
            ) : (
              <RecordHints type={type} />
            )}
          </ul>
        </div>
        <div className="grid content-start gap-4">
          <FileDrop file={file} onChange={onFileChange} disabled={busy} maxBytes={info.maxBytes} />
          <div className="flex justify-end">
            <Button onClick={onPreview} disabled={!file || busy}>
              {previewing ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
              Preview
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
