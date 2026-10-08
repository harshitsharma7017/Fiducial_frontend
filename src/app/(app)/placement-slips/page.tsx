import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PlacementSlipsView } from './placement-slips-view';

export const metadata: Metadata = { title: 'Placement Slips' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const serverSearch = query.toString();
  return (
    <DemoModeGate>
      <PlacementSlipsView serverSearch={serverSearch ? `?${serverSearch}` : ''} />
    </DemoModeGate>
  );
}
