import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ImportView } from './import-view';

export const metadata: Metadata = { title: 'Import data' };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?type= picks the record type, so other pages can link straight to an upload.
  const { type } = await searchParams;
  return (
    <DemoModeGate>
      <ImportView
        serverSearch={typeof type === 'string' ? `?type=${encodeURIComponent(type)}` : ''}
      />
    </DemoModeGate>
  );
}
