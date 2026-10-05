'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PincodeRecordSchema } from '@/shared';

export const isCompletePincode = (value: string) => /^\d{6}$/.test(value);

/** Looks up a pincode in the active master once all six digits are present. */
export function usePincode(pincode: string) {
  return useQuery({
    queryKey: queryKeys.pincode(pincode),
    queryFn: ({ signal }) =>
      apiFetch(`masters/pincodes/${pincode}`, { schema: PincodeRecordSchema, signal }),
    enabled: isCompletePincode(pincode),
    staleTime: 10 * 60_000,
  });
}
