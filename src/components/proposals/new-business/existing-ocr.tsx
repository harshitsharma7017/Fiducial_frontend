'use client';

import { useMutation } from '@tanstack/react-query';
import { CircleAlert, FileSearch, LoaderCircle, ScanText } from 'lucide-react';
import { useRef, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import type { DataSheetForm } from '@/lib/data-sheet';
import { applyExistingOcr, type ExistingOcrSummary } from '@/lib/existing-ocr';
import { ExistingOcrSchema, type ProposalRecord } from '@/shared';

// The existing policy's schedule (PDF or picture) read for the Existing sum insured column. A
// separate upload from the Data Sheet workbook: it fills only the Existing figures, as unsaved
// changes to be checked and saved.

const ACCEPT = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';

export function ExistingOcrControl({
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
  const [result, setResult] = useState<{
    fileName: string;
    summary: ExistingOcrSummary;
    warnings: string[];
    message: string | null;
  } | null>(null);

  const read = useMutation({
    mutationFn: (file: File) =>
      apiFetch(
        `proposals/${record.id}/data-sheet/existing-ocr?fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          body: new Blob([file], { type: file.type || 'application/octet-stream' }),
          schema: ExistingOcrSchema,
        },
      ),
    onMutate: (file) => {
      setFileName(file.name);
      setResult(null);
    },
    onSuccess: (data, file) => {
      if (data.manualEntryRequired) {
        setResult({
          fileName: file.name,
          summary: { filled: [], skipped: [] },
          warnings: data.warnings,
          message: data.message,
        });
        return;
      }
      const { values, summary } = applyExistingOcr(getValues(), data);
      onApply(values);
      setResult({
        fileName: file.name,
        summary,
        warnings: data.warnings,
        message: null,
      });
      toast({
        title: 'Existing sum insured read from the policy',
        description: 'Check the values, then save the Data Sheet.',
        variant: 'success',
      });
    },
  });

  const notes = result ? [...result.summary.skipped, ...result.warnings] : [];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Existing policy file"
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
            <ScanText aria-hidden="true" />
          )}
          Read existing sum insured (OCR)
        </Button>
        <span className="text-sm text-muted-foreground">
          Upload the existing policy (PDF or picture) to fill the Existing column; nothing is saved
          until you save.
        </span>
      </div>
      {read.error ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{fileName || 'The file'} could not be read</AlertTitle>
          <AlertDescription>{errorMessage(read.error)}</AlertDescription>
        </Alert>
      ) : null}
      {result?.message ? (
        <Alert variant="warning">
          <FileSearch aria-hidden="true" />
          <AlertTitle>Nothing was filled from {result.fileName}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : result ? (
        <Alert variant={notes.length > 0 ? 'warning' : 'info'}>
          <FileSearch aria-hidden="true" />
          <AlertTitle>Existing sum insured read from {result.fileName}: check and save</AlertTitle>
          <AlertDescription>
            <p>
              {result.summary.filled.length > 0
                ? `Filled: ${result.summary.filled.join(', ')}.`
                : 'Nothing was filled.'}
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
      ) : null}
    </div>
  );
}
