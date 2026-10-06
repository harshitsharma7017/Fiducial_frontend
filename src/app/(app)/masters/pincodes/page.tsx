import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PincodeView } from './pincode-view';

export const metadata: Metadata = { title: 'Pincodes' };

export default function PincodesPage() {
  return (
    <DemoModeGate>
      <PincodeView />
    </DemoModeGate>
  );
}
