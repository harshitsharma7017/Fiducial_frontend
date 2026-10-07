'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { DocumentTemplateListSchema, type ProposalRecord } from '@/shared';

/**
 * The RFQ downloads (R-3, R-4): Excel in the client's template and the same as an A4 PDF with the
 * broker's letterhead. Says whether the client's template is in use or the built-in layout.
 */
export function DownloadRfqButtons({
  record,
  disabled,
}: {
  record: ProposalRecord;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: ({ signal }) => apiFetch('templates', { schema: DocumentTemplateListSchema, signal }),
  });
  const rfqTemplate = templates.data?.items.find((item) => item.kind === 'RFQ')?.template ?? null;
  const download = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      apiDownload(
        `proposals/${record.id}/rfq?format=${format}`,
        `RFQ-${record.reference}.${format}`,
      ),
    onSuccess: (file) => {
      saveFile(file);
      void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.record(record.id) });
    },
  });
  const pending = (format: 'xlsx' | 'pdf') => download.isPending && download.variables === format;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {(['xlsx', 'pdf'] as const).map((format) => (
          <Button
            key={format}
            type="button"
            variant="outline"
            disabled={disabled || download.isPending}
            onClick={() => download.mutate(format)}
          >
            {pending(format) ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : format === 'pdf' ? (
              <FileText aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            Download RFQ ({format === 'pdf' ? 'PDF' : 'Excel'})
          </Button>
        ))}
      </div>
      {templates.isSuccess ? (
        <p className="text-xs text-muted-foreground">
          {rfqTemplate ? (
            <>
              In the client’s RFQ template ({rfqTemplate.fileName}); the PDF has the broker’s
              letterhead.
            </>
          ) : (
            <>
              In the built-in layout: the client’s RFQ template has not been uploaded (Masters →
              Document templates).
            </>
          )}
        </p>
      ) : null}
      {download.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(download.error)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
