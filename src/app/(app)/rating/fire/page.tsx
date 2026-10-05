import type { Metadata } from 'next';
import { FireRatingView } from './fire-rating-view';

export const metadata: Metadata = { title: 'Fire rate check' };

export default function FireRatingPage() {
  return <FireRatingView />;
}
