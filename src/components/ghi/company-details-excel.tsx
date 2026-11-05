'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { DownloadButton } from '@/components/ghi/ghi-ui';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { caseApi, ghiFileHref, ghiFilesQuery, ghiKeys, importCompanyDetails } from '@/lib/api/ghi';
import {
  COMPANY_DETAIL_FIELDS,
  MAX_COMPANY_DETAILS_BYTES,
  formatDateTime,
  type CompanyDetailsImport,
  type EbProduct,
} from '@/shared';

/**
 * The Data Sheet's company details from Excel (alteration 3/11/2026), for GMC, GPA and GTLI:
 * download the workbook (filled with the case's values), fill it, and import it. The values it
 * gives are put into the form for the user to review and save; the workbook itself is kept with
 * the case's files.
 */
export function CompanyDetailsExcel({
  caseId,
  product = 'GMC',
  disabled,
  onImported,
}: {
  caseId: string;
  product?: EbProduct;
  disabled: boolean;
  onImported: (result: CompanyDetailsImport) => void;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The workbooks imported so far, kept with the case's files.
  const files = useQuery(ghiFilesQuery(caseId, product));
  const workbooks = (files.data?.items ?? []).filter((file) => file.purpose === 'COMPANY_DETAILS');
  const upload = useMutation({
    mutationFn: (file: File) => importCompanyDetails(caseId, file, product),
    onSuccess: (result) => {
      onImported(result);
      void queryClient.invalidateQueries({ queryKey: ghiKeys.part(caseId, 'files') });
    },
  });
  const choose = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return setProblem('Choose the Excel workbook (.xlsx).');
    if (file.size > MAX_COMPANY_DETAILS_BYTES)
      return setProblem('The workbook is larger than 2 MB.');
    setProblem(null);
    upload.mutate(file);
  };
  const result = upload.data;
  const labelOf = (key: string) =>
    COMPANY_DETAIL_FIELDS.find((field) => field.key === key)?.label ?? key;

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <DownloadButton
          path={`${caseApi(product, caseId)}/company-details/template`}
          fallbackName="Company-details.xlsx"
        >
          Company details template
        </DownloadButton>
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet aria-hidden="true" />
          )}
          Import Excel
        </Button>
      </div>
      {workbooks.length > 0 ? (
        <ul
          className="grid gap-1 text-sm"
          aria-label="Company details workbooks kept with the case"
        >
          {workbooks.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-2">
              <FileSpreadsheet aria-hidden="true" className="size-4 text-muted-foreground" />
              <a
                href={ghiFileHref(caseId, file.id, product)}
                className="text-accent-strong underline-offset-2 hover:underline"
              >
                {file.fileName}
              </a>
              <span className="text-xs text-muted-foreground">
                imported by {file.uploadedBy}, {formatDateTime(file.uploadedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {problem || upload.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? errorMessage(upload.error)}
        </p>
      ) : null}
      {result && !upload.isPending ? (
        <Alert variant={result.issues.length > 0 ? 'warning' : 'info'} role="status">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>
            {result.provided.length > 0
              ? `Filled ${result.provided.length} field(s) from ${result.file.fileName}`
              : `Nothing to fill from ${result.file.fileName}`}
          </AlertTitle>
          <AlertDescription>
            <p>
              Review them below, then save the Data Sheet. The workbook is kept with the case’s
              files.
            </p>
            {result.issues.length > 0 ? (
              <ul className="list-disc pl-4">
                {result.issues.map((issue) => (
                  <li key={issue.field}>
                    {labelOf(issue.field)}: {issue.message} (not filled)
                  </li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
