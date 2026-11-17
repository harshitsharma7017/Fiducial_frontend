import type { Metadata } from 'next';
import { NewWcView } from './new-wc-view';

export const metadata: Metadata = { title: 'New Workmen Compensation case' };

export default function NewWcPage() {
  return <NewWcView />;
}
