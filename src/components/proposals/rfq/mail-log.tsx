'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { DemoModeState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { isDemoModeError } from '@/lib/demo-mode';
import {
  EMAIL_TEMPLATE_KIND_LABELS,
  MAIL_RESULT_LABELS,
  MailListResponseSchema,
  formatDateTime,
  type MailSummary,
} from '@/shared';
import { MailDetailSheet, RESULT_VARIANT } from './mail-detail-sheet';

const PAGE_SIZE = 20;

/** The case's mails, newest first, a page at a time (E-6). */
export function useCaseMails(proposalId: string) {
  return useInfiniteQuery({
    queryKey: ['proposals', proposalId, 'mails'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`proposals/${proposalId}/mails?${params.toString()}`, {
        schema: MailListResponseSchema,
        signal,
      });
    },
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** Every mail sent for the case: who was mailed, when and with what result (requirement 10.3). */
export function MailLog({ proposalId }: { proposalId: string }) {
  const mails = useCaseMails(proposalId);
  const [selected, setSelected] = useState<MailSummary | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const items = mails.data?.pages.flatMap((page) => page.items) ?? [];

  let body;
  if (mails.isPending) body = <LoadingState label="Loading mails" />;
  else if (mails.isError) {
    body = isDemoModeError(mails.error) ? (
      <DemoModeState />
    ) : (
      <ErrorState error={mails.error} onRetry={() => void mails.refetch()} />
    );
  } else if (items.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">No mail has been sent for this case yet.</p>
    );
  } else {
    body = (
      <>
        <ul className="grid gap-2">
          {items.map((mail) => (
            <li key={mail.id}>
              <button
                type="button"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setSelected(mail);
                }}
                className="grid w-full gap-1 rounded-md border px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{EMAIL_TEMPLATE_KIND_LABELS[mail.kind]}</Badge>
                  <span className="text-sm font-medium">{mail.insurerName}</span>
                  <Badge variant={RESULT_VARIANT[mail.result]}>
                    {MAIL_RESULT_LABELS[mail.result]}
                  </Badge>
                  {mail.attachment ? (
                    <Paperclip
                      className="size-3.5 text-muted-foreground"
                      aria-label="With attachment"
                    />
                  ) : null}
                </span>
                <span className="text-xs break-all text-muted-foreground">
                  To {mail.to.join(', ')}
                </span>
                <span className="text-xs text-muted-foreground tabular">
                  {formatDateTime(mail.at)} · {mail.sentBy}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {mails.hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={mails.isFetchingNextPage}
            onClick={() => void mails.fetchNextPage()}
          >
            {mails.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mails</CardTitle>
        <CardDescription>RFQs and reminders sent from the app, newest first.</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
      <MailDetailSheet
        proposalId={proposalId}
        mail={selected}
        onClose={() => setSelected(null)}
        returnFocus={opener}
      />
    </Card>
  );
}
