import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { TaxRatesView } from './tax-rates-view';

export const metadata: Metadata = { title: 'Tax rates' };

export default function Page() {
  return (
    <DemoModeGate>
      <TaxRatesView />
    </DemoModeGate>
  );
}
