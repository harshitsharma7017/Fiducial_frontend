import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { FireRatingView } from './fire-rating-view';

export const metadata: Metadata = { title: 'Fire rate check' };

export default function FireRatingPage() {
  return (
    <DemoModeGate>
      <FireRatingView />
    </DemoModeGate>
  );
}
