import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ClausesView } from './clauses-view';

export const metadata: Metadata = { title: 'Clauses' };

export default function Page() {
  return (
    <DemoModeGate>
      <ClausesView />
    </DemoModeGate>
  );
}
