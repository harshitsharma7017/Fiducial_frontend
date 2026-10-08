import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { OccupancyDefaultsView } from './occupancy-defaults-view';

export const metadata: Metadata = { title: 'Occupancy cover defaults' };

export default function Page() {
  return (
    <DemoModeGate>
      <OccupancyDefaultsView />
    </DemoModeGate>
  );
}
