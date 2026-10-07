'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Download, LoaderCircle, Upload } from 'lucide-react';
import { useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  DocumentTemplateListSchema,
  MAX_TEMPLATE_BYTES,
  TemplateUploadResultSchema,
  XLSX_CONTENT_TYPE,
  formatDateTime,
  type DocumentTemplateList,
  type TemplateCheck,
} from '@/shared';

type Item = DocumentTemplateList['items'][number];

const PURPOSE: Record<Item['kind'], string> = {
  RFQ: 'Filled for every RFQ download (Excel), and drawn as the PDF with the broker’s letterhead.',
  QCR: 'Kept for the QCR, which the engine will fill when the QCR is built.',
  PLACEMENT_SLIP: 'Kept for the Placement Slip, which the engine will fill when it is built.',
};

function CheckSummary({ check }: { check: TemplateCheck }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div className="grid gap-0.5">
        <dt className="text-xs text-muted-foreground">Sheets</dt>
        <dd>{check.sheets.join(', ')}</dd>
      </div>
      <div className="grid gap-0.5">
        <dt className="text-xs text-muted-foreground">Letterhead for the PDF</dt>
        <dd>
          {check.letterhead.logo ? 'Logo found' : 'No logo'}
          {check.letterhead.address ? (
            <span className="block text-xs whitespace-pre-line text-muted-foreground">
              {check.letterhead.address}
            </span>
          ) : (
            <span className="block text-xs text-muted-foreground">No broker address found</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function TemplateCard({ item, canManage }: { item: Item; canManage: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiFetch(`templates/${item.kind}?fileName=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: new Blob([file], { type: XLSX_CONTENT_TYPE }),
        schema: TemplateUploadResultSchema,
      }),
    onSuccess: (result) => {
      if (!result.saved) return;
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({
        title: `${item.label} template saved`,
        description: result.template?.fileName,
        variant: 'success',
      });
    },
  });
  const template = item.template;
  const refused = upload.data && !upload.data.saved ? upload.data.check : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            {item.label}
            {item.filled ? (
              <Badge variant="success">Filled by the engine</Badge>
            ) : (
              <Badge variant="muted">Planned</Badge>
            )}
          </CardTitle>
          <CardDescription>{PURPOSE[item.kind]}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {template ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/proxy/templates/${item.kind}/file`} download>
                <Download aria-hidden="true" />
                Download
              </a>
            </Button>
          ) : null}
          {canManage ? (
            <>
              <input
                ref={input}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-label={`${item.label} template file`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  if (file.size > MAX_TEMPLATE_BYTES) {
                    toast({
                      title: 'File too large',
                      description: 'Templates are up to 5 MB.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  upload.mutate(file);
                }}
              />
              <Button size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
                {upload.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                {template ? 'Replace' : 'Upload'} template
              </Button>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {template ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-4 text-success" aria-hidden="true" />
              <span>
                <span className="font-medium">{template.fileName}</span>{' '}
                <span className="text-muted-foreground">
                  · {Math.round(template.size / 1024)} KB · uploaded{' '}
                  {formatDateTime(template.uploadedAt)} by {template.uploadedBy}
                </span>
              </span>
            </p>
            <CheckSummary check={template.check} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No template yet.
            {item.kind === 'RFQ' ? ' RFQs use the built-in layout until it is uploaded.' : ''}
          </p>
        )}
        {refused ? (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Not saved: the engine cannot fill this file</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {refused.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {upload.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(upload.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** R-3: the client's Excel formats that documents are filled from. */
export function TemplatesView() {
  const canManage = usePermission('masters.manage');
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: ({ signal }) => apiFetch('templates', { schema: DocumentTemplateListSchema, signal }),
  });
  return (
    <>
      <PageHeader
        title="Document templates"
        description="The client’s own Excel formats. Documents are filled into them, keeping their sheets, layout and formulas; the PDF takes the logo and address in the template as its letterhead."
      />
      {templates.isPending ? (
        <LoadingState label="Loading templates" />
      ) : templates.isError ? (
        <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
      ) : (
        <div className="grid gap-4">
          {templates.data.items.map((item) => (
            <TemplateCard key={item.kind} item={item} canManage={canManage} />
          ))}
        </div>
      )}
    </>
  );
}
