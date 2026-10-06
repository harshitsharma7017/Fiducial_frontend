import type { Metadata } from 'next';
import { ProposalDetailView } from './proposal-detail-view';

export const metadata: Metadata = { title: 'Proposal' };

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalDetailView id={id} />;
}
