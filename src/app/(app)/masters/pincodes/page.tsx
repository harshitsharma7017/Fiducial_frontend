import type { Metadata } from 'next';
import { PincodeView } from './pincode-view';

export const metadata: Metadata = { title: 'Pincode lookup' };

export default function PincodesPage() {
  return <PincodeView />;
}
