import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { SectionsView } from './sections-view';

export const metadata: Metadata = { title: 'Coverage sections' };

export default function Page() {
  return (
    <DemoModeGate>
      <SectionsView />
    </DemoModeGate>
  );
}
