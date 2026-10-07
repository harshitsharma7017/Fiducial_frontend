import type { Metadata } from 'next';
import { ProposalDetailView } from './proposal-detail-view';

export const metadata: Metadata = { title: 'Proposal' };

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <ProposalDetailView id={id} tab={typeof tab === 'string' ? tab : undefined} />;
}
