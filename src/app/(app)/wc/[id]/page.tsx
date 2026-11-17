import type { Metadata } from 'next';
import { WcCaseView } from './wc-case-view';

export const metadata: Metadata = { title: 'Workmen Compensation case' };

export default async function WcCasePage({ params }: { params: Promise<{ id: string }> }) {
  return <WcCaseView id={(await params).id} />;
}
