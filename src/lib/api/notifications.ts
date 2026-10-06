import { useQuery } from '@tanstack/react-query';
import { buildSampleNotifications } from '@/lib/data/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { AppNotification } from '@/types/notification';
import { delay } from './latency';

/** Sample notifications. Replace the body with an API call when notifications exist. */
export async function listNotifications(): Promise<AppNotification[]> {
  await delay(350);
  return buildSampleNotifications(new Date());
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
    staleTime: 5 * 60_000,
  });
}
