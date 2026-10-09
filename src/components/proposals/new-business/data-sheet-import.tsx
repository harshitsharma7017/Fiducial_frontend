'use client';

import { useMutation } from '@tanstack/react-query';
import { CircleAlert, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import {
  applyDataSheetImport,
  suggestedMapping,
  takePendingDataSheet,
  type ImportSummary,
} from '@/lib/data-sheet-import';
import type { DataSheetForm } from '@/lib/data-sheet';
import { DataSheetImportSchema, type DataSheetImport, type ProposalRecord } from '@/shared';

// DS-08: the client's own Data Sheet workbook fills this form. The API reads it; each sheet goes
// to a location of the case (asked when it is not clear which); the form keeps the values as
// unsaved changes, to be checked and saved.

export function DataSheetImportControl({
  record,
  getValues,
  onApply,
}: {
  record: ProposalRecord;
  getValues: () => DataSheetForm;
  onApply: (values: DataSheetForm) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<{
    imported: DataSheetImport;
    ids: (string | null)[];
  } | null>(null);
  const [result, setResult] = useState<{
    fileName: string;
    summary: ImportSummary;
    warnings: string[];
  } | null>(null);

  const apply = (imported: DataSheetImport, ids: (string | null)[], name: string) => {
    const { values, summary } = applyDataSheetImport(getValues(), imported, ids);
    onApply(values);
    setResult({ fileName: name, summary, warnings: imported.warnings });
    setMapping(null);
    toast({
      title: 'Data Sheet filled from the workbook',
      description: 'Check the values, then save the Data Sheet.',
      variant: 'success',
    });
  };

  const read = useMutation({
    mutationFn: (file: File) =>
      apiFetch(
        `proposals/${record.id}/data-sheet/import?fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          body: new Blob([file], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          schema: DataSheetImportSchema,
        },
      ),
    onMutate: (file) => {
      setFileName(file.name);
      setResult(null);
    },
    onSuccess: (imported, file) => {
      const ids = suggestedMapping(imported);
      // One sheet for one location: nothing to ask.
      const clear =
        imported.locations.length === 1 && record.locations.length === 1 && ids[0] !== null;
      if (clear) apply(imported, ids, file.name);
      else setMapping({ imported, ids });
    },
  });

  // A workbook chosen on the New proposal screen is read once, when its case opens.
  const pendingRead = useRef(false);
  useEffect(() => {
    if (pendingRead.current) return;
    pendingRead.current = true;
    const file = takePendingDataSheet(record.id);
    if (file) read.mutate(file);
  }, [record.id, read]);

  const problem =
    read.error instanceof ApiError && Array.isArray(read.error.details)
      ? ((read.error.details as { message?: string }[])[0]?.message ?? errorMessage(read.error))
      : read.error
        ? errorMessage(read.error)
        : null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Client’s Data Sheet workbook"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) read.mutate(file);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={read.isPending}
          onClick={() => input.current?.click()}
        >
          {read.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload aria-hidden="true" />
          )}
          Import from Excel
        </Button>
        <span className="text-sm text-muted-foreground">
          The client’s Data Sheet in its own format fills this form; nothing is saved until you
          save.
        </span>
      </div>
      {problem ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{fileName || 'The workbook'} could not be read</AlertTitle>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
      {result ? <ImportResult record={record} {...result} /> : null}
      {mapping ? (
        <MappingDialog
          record={record}
          imported={mapping.imported}
          ids={mapping.ids}
          onCancel={() => setMapping(null)}
          onConfirm={(ids) => apply(mapping.imported, ids, fileName)}
        />
      ) : null}
    </div>
  );
}

const locationName = (record: ProposalRecord, id: string) =>
  record.locations.find((location) => location.locationId === id)?.location?.name ?? 'Location';

function ImportResult({
  record,
  fileName,
  summary,
  warnings,
}: {
  record: ProposalRecord;
  fileName: string;
  summary: ImportSummary;
  warnings: string[];
}) {
  const notes = [...summary.skipped, ...warnings];
  return (
    <Alert variant={notes.length > 0 ? 'warning' : 'info'}>
      <FileSpreadsheet aria-hidden="true" />
      <AlertTitle>Filled from {fileName}: check and save</AlertTitle>
      <AlertDescription>
        <p>
          {summary.locations.length > 0
            ? summary.locations
                .map((item) => `${item.sheetName} → ${locationName(record, item.locationId)}`)
                .join('; ')
            : 'No location was filled.'}
          {summary.sections.length > 0 ? `. Sections: ${summary.sections.join(', ')}.` : '.'}
        </p>
        {notes.length > 0 ? (
          <ul className="mt-1 list-disc pl-4">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Which location each sheet fills, when the workbook or the case has more than one. */
function MappingDialog({
  record,
  imported,
  ids,
  onCancel,
  onConfirm,
}: {
  record: ProposalRecord;
  imported: DataSheetImport;
  ids: (string | null)[];
  onCancel: () => void;
  onConfirm: (ids: (string | null)[]) => void;
}) {
  const [chosen, setChosen] = useState(ids);
  const baseId = useId();
  const duplicate = chosen.some((id, index) => id !== null && chosen.indexOf(id) !== index);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Which location does each sheet fill?</DialogTitle>
          <DialogDescription>
            Each Data Sheet in the workbook is one risk location. Its Fire lines replace the
            location’s; the other sections and the annexure fill the case.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {imported.locations.map((sheet, index) => {
            const id = `${baseId}-${index}`;
            return (
              <div key={sheet.sheetName} className="grid gap-1">
                <Label htmlFor={id}>
                  {sheet.sheetName}
                  {sheet.riskLocation ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {sheet.riskLocation}
                    </span>
                  ) : null}
                </Label>
                <NativeSelect
                  id={id}
                  value={chosen[index] ?? ''}
                  onChange={(event) =>
                    setChosen((current) =>
                      current.map((value, position) =>
                        position === index ? event.target.value || null : value,
                      ),
                    )
                  }
                >
                  <option value="">Leave this sheet out</option>
                  {record.locations.map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      {location.location?.name ?? 'Location'}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            );
          })}
          {duplicate ? (
            <p role="alert" className="text-sm text-destructive">
              Each location can be filled by one sheet.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={duplicate || chosen.every((id) => id === null)}
            onClick={() => onConfirm(chosen)}
          >
            Fill the Data Sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
