import type { Metadata } from 'next';
import { NewGhiView } from './new-ghi-view';

export const metadata: Metadata = { title: 'New group health case' };

export default function NewGhiPage() {
  return <NewGhiView />;
}
