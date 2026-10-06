import type { Metadata } from 'next';
import { ProposalsListView } from './proposals-list-view';

export const metadata: Metadata = { title: 'Proposals' };

export default async function ProposalsPage({
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
  return <ProposalsListView serverSearch={serverSearch ? `?${serverSearch}` : ''} />;
}
