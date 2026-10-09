import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ProductsView } from './products-view';

export const metadata: Metadata = { title: 'Policies' };

export default function Page() {
  return (
    <DemoModeGate>
      <ProductsView />
    </DemoModeGate>
  );
}
