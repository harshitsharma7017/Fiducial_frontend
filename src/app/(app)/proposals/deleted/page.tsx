import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { DeletedBinView } from './deleted-bin-view';

export const metadata: Metadata = { title: 'Deleted bin' };

export default function DeletedBinPage() {
  // The bin is live API data, so mock mode shows the demo-mode state instead.
  return (
    <DemoModeGate>
      <DeletedBinView />
    </DemoModeGate>
  );
}
