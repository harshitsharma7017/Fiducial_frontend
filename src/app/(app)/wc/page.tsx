import type { Metadata } from 'next';
import { WcListView } from './wc-list-view';

export const metadata: Metadata = { title: 'Workmen Compensation' };

export default function WcPage() {
  return <WcListView />;
}
