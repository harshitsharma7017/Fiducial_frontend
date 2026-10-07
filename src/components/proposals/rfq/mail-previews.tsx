'use client';

import { useQuery } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api-client';
import {
  MailPreviewResponseSchema,
  type MailAttachmentFormat,
  type MailPreview,
  type RfqRecipient,
} from '@/shared';

/** One mail as the insurer gets it: To, subject and the text body. */
export function MailBody({ mail }: { mail: Pick<MailPreview, 'to' | 'subject' | 'text'> }) {
  return (
    <dl className="grid gap-2 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">To</dt>
        <dd className="break-all">{mail.to.join(', ')}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Subject</dt>
        <dd className="font-medium break-words">{mail.subject}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Message</dt>
        <dd className="max-h-56 overflow-y-auto rounded-md border bg-card p-3 break-words whitespace-pre-wrap">
          {mail.text}
        </dd>
      </div>
    </dl>
  );
}

/**
 * The mails a send would make, one tab per insurer, built by the API from the saved template
 * (requirement 4.7). Nothing is sent.
 */
export function MailPreviews({
  proposalId,
  insurers,
  dueDate,
  format,
}: {
  proposalId: string;
  insurers: RfqRecipient[];
  dueDate: string;
  format: MailAttachmentFormat;
}) {
  const preview = useQuery({
    queryKey: ['proposals', 'rfq-preview', proposalId, insurers, dueDate, format],
    queryFn: ({ signal }) =>
      apiFetch(`proposals/${proposalId}/rfq/preview`, {
        method: 'POST',
        body: { kind: 'RFQ', insurers, dueDate, format },
        schema: MailPreviewResponseSchema,
        signal,
      }),
    enabled: insurers.length > 0 && dueDate !== '',
    retry: false,
  });

  if (insurers.length === 0) {
    return <p className="text-sm text-muted-foreground">Choose an insurer to see its mail.</p>;
  }
  if (preview.isPending) return <LoadingState label="Building the mails" />;
  if (preview.isError) {
    return <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />;
  }
  const mails = preview.data.mails;
  return (
    <div className="grid gap-2">
      {preview.data.attachmentName ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden="true" />
          Each mail carries {preview.data.attachmentName}
        </p>
      ) : null}
      <Tabs
        key={mails.map((mail) => mail.insurerId).join()}
        defaultValue={mails[0]?.insurerId}
        className="gap-3"
      >
        <TabsList className="h-auto flex-wrap">
          {mails.map((mail) => (
            <TabsTrigger key={mail.insurerId} value={mail.insurerId}>
              {mail.insurerName}
            </TabsTrigger>
          ))}
        </TabsList>
        {mails.map((mail) => (
          <TabsContent key={mail.insurerId} value={mail.insurerId}>
            <MailBody mail={mail} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
