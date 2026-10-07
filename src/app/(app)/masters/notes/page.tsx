import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { NotesView } from './notes-view';

export const metadata: Metadata = { title: 'Standard notes' };

export default function Page() {
  return (
    <DemoModeGate>
      <NotesView />
    </DemoModeGate>
  );
}
