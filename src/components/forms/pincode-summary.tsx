'use client';

import { isCompletePincode, usePincode } from '@/hooks/use-pincode';
import { ApiError } from '@/lib/api-client';
import { EQ_ZONE_LABELS } from '@/shared';

/** The district, state and EQ zone the active master gives for a complete pincode. */
export function PincodeSummary({ pincode }: { pincode: string }) {
  const lookup = usePincode(pincode);
  if (!isCompletePincode(pincode)) return null;
  if (lookup.isPending)
    return <p className="text-xs text-muted-foreground">Looking up {pincode}…</p>;
  if (lookup.isError) {
    const message =
      lookup.error instanceof ApiError && lookup.error.code === 'PINCODE_NOT_FOUND'
        ? `Pincode ${pincode} is not in the active master.`
        : 'Could not look up this pincode.';
    return <p className="text-xs text-destructive">{message}</p>;
  }
  const record = lookup.data;
  return (
    <p className="text-xs text-muted-foreground">
      {record.district || '—'}, {record.state || '—'}
      {record.eqZone ? ` · ${EQ_ZONE_LABELS[record.eqZone]}` : ' · zone not set'}
    </p>
  );
}
