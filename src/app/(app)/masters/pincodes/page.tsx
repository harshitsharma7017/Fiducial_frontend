import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PincodeView } from './pincode-view';

export const metadata: Metadata = { title: 'Pincode lookup' };

export default function PincodesPage() {
  return (
    <DemoModeGate>
      <PincodeView />
    </DemoModeGate>
  );
}
