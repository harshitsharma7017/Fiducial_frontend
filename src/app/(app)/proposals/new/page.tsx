import type { Metadata } from 'next';
import { NewProposalView } from './new-proposal-view';

export const metadata: Metadata = { title: 'New proposal' };

export default async function NewProposalPage({
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
  return <NewProposalView serverSearch={serverSearch ? `?${serverSearch}` : ''} />;
}
