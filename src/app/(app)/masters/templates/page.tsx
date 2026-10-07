import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { TemplatesView } from './templates-view';

export const metadata: Metadata = { title: 'Document templates' };

export default function Page() {
  return (
    <DemoModeGate>
      <TemplatesView />
    </DemoModeGate>
  );
}
