'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, LoaderCircle, Paperclip } from 'lucide-react';
import type { RefObject } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { usePermission } from '@/hooks/use-permission';
import { apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import {
  EMAIL_TEMPLATE_KIND_LABELS,
  MAIL_RESULT_LABELS,
  MailDetailSchema,
  formatDate,
  formatDateTime,
  type MailResult,
  type MailSummary,
} from '@/shared';
import { MailBody } from './mail-previews';

export const RESULT_VARIANT: Record<MailResult, 'success' | 'muted' | 'destructive'> = {
  DELIVERED: 'success',
  OUTBOX: 'muted',
  FAILED: 'destructive',
};

/** One mail as sent: subject, body, result and the attachment to download (10.3, 10.4). */
export function MailDetailSheet({
  proposalId,
  mail,
  onClose,
  returnFocus,
}: {
  proposalId: string;
  mail: MailSummary | null;
  onClose: () => void;
  /** The row that opened it: not a Radix trigger, so focus goes back by hand. */
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const canExport = usePermission('proposals.export');
  const detail = useQuery({
    queryKey: ['proposals', proposalId, 'mails', mail?.id ?? null],
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${proposalId}/mails/${mail?.id ?? ''}`, {
        schema: MailDetailSchema,
        signal,
      }),
    enabled: mail !== null,
  });
  const download = useMutation({
    mutationFn: () =>
      apiDownload(
        `proposals/${proposalId}/mails/${mail?.id ?? ''}/attachment`,
        mail?.attachment?.fileName ?? 'attachment',
      ),
    onSuccess: saveFile,
  });

  return (
    <Sheet open={mail !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {mail ? `${EMAIL_TEMPLATE_KIND_LABELS[mail.kind]} to ${mail.insurerName}` : 'Mail'}
          </SheetTitle>
          <SheetDescription>
            {mail ? `${formatDateTime(mail.at)} · sent by ${mail.sentBy}` : null}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {detail.isPending ? (
            <LoadingState label="Loading the mail" />
          ) : detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={RESULT_VARIANT[detail.data.result]}>
                  {MAIL_RESULT_LABELS[detail.data.result]}
                </Badge>
                {detail.data.dueDate ? (
                  <span className="text-muted-foreground tabular">
                    Quotes due {formatDate(detail.data.dueDate)}
                  </span>
                ) : null}
              </p>
              {detail.data.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{detail.data.error}</AlertDescription>
                </Alert>
              ) : null}
              <p className="text-xs text-muted-foreground break-all">
                From {detail.data.from} · replies to {detail.data.replyTo} · template version{' '}
                {detail.data.templateVersion}
              </p>
              <MailBody mail={detail.data} />
              {detail.data.attachment ? (
                canExport ? (
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-self-start"
                      disabled={download.isPending}
                      onClick={() => download.mutate()}
                    >
                      {download.isPending ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Download aria-hidden="true" />
                      )}
                      Download {detail.data.attachment.fileName}
                    </Button>
                    {download.isError ? (
                      <Alert variant="destructive" role="alert">
                        <AlertDescription>{errorMessage(download.error)}</AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Paperclip className="size-4" aria-hidden="true" />
                    {detail.data.attachment.fileName}
                  </p>
                )
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
