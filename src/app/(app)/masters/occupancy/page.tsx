import type { Metadata } from 'next';
import { OccupancyView } from './occupancy-view';

export const metadata: Metadata = { title: 'Occupancy master' };

export default function OccupancyPage() {
  return <OccupancyView />;
}
