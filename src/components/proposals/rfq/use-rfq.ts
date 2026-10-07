import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { isDemoModeError } from '@/lib/demo-mode';
import { queryKeys } from '@/lib/query-keys';
import { MailStatusSchema, type MailStatus, type ProposalRecord } from '@/shared';

/** Puts a saved case in the cache and refreshes the lists that show it. */
export function useSaveRecord() {
  const queryClient = useQueryClient();
  return (saved: ProposalRecord) => {
    queryClient.setQueryData(queryKeys.proposals.record(saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: ['proposals'] });
  };
}

export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${what} copied`, description: text, variant: 'success' });
  } catch {
    toast({
      title: 'Could not copy',
      description: 'Select the addresses and copy them instead.',
      variant: 'destructive',
    });
  }
}

const MAIL_OFF: MailStatus = { transport: 'off', from: null, host: null };

/**
 * How the API sends mail. Users with settings.view read it; for others it stays unknown until a
 * send answers 409 MAIL_DISABLED, which marks mail off for the rest of the session.
 */
export function useMailStatus(): MailStatus | null {
  const canRead = usePermission('settings.view');
  const status = useQuery({
    queryKey: queryKeys.mailStatus,
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch('mail/status', { schema: MailStatusSchema, signal });
      } catch (error) {
        // Demo mode never sends mail.
        if (isDemoModeError(error)) return MAIL_OFF;
        throw error;
      }
    },
    enabled: canRead,
    staleTime: 5 * 60_000,
  });
  return status.data ?? null;
}

/** True for the API's answer when sending mail is turned off. */
export function isMailDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MAIL_DISABLED';
}

/** Remembers that mail is off, so the send actions give way to "Sent outside the app". */
export function useMarkMailOff() {
  const queryClient = useQueryClient();
  return () => queryClient.setQueryData(queryKeys.mailStatus, MAIL_OFF);
}

/** A send id per attempt: repeating a request with it never mails an insurer twice. */
export function newSendId(): string {
  return crypto.randomUUID();
}
