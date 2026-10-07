import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { RfqView } from './rfq-view';

export const metadata: Metadata = { title: 'RFQ' };

export default async function RfqPage({
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
      <RfqView serverSearch={serverSearch ? `?${serverSearch}` : ''} />
    </DemoModeGate>
  );
}
