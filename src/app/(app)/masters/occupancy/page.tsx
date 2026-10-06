import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { OccupancyView } from './occupancy-view';

export const metadata: Metadata = { title: 'Occupancy master' };

export default function OccupancyPage() {
  return (
    <DemoModeGate>
      <OccupancyView />
    </DemoModeGate>
  );
}
