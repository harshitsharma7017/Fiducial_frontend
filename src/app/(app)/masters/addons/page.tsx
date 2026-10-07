import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { AddonsView } from './addons-view';

export const metadata: Metadata = { title: 'Add-on covers' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab, list } = await searchParams;
  const query = new URLSearchParams();
  if (typeof tab === 'string') query.set('tab', tab);
  if (typeof list === 'string') query.set('list', list);
  const serverSearch = query.toString();
  return (
    <DemoModeGate>
      <AddonsView serverSearch={serverSearch ? `?${serverSearch}` : ''} />
    </DemoModeGate>
  );
}
