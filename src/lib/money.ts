import { formatAmount, groupIndianDigits } from '@/shared';
import type { Rupees } from '@/types/proposal';

/**
 * Rupee amounts are whole-rupee digit strings, added with BigInt so no value passes through
 * floating point. Only drawing a chart bar turns an amount into a number.
 */

/** Sum of whole-rupee strings as a whole-rupee string. The empty list is "0". */
export function sumRupees(values: readonly Rupees[]): Rupees {
  let total = 0n;
  for (const value of values) total += BigInt(value);
  return total.toString();
}

/** Rupees with Indian grouping and 2 decimals, for example ₹1,36,880.00. */
export function formatInr(value: Rupees): string {
  return `₹${formatAmount(value)}`;
}

const LAKH = 100_000n;
const CRORE = 10_000_000n;

/** Rounds `value / unit` to 2 decimals, half away from zero, as "<grouped>.dd". */
function unitsWithTwoDecimals(value: bigint, unit: bigint): string {
  // Hundredths of a unit, rounded half up: (value * 100 + unit/2) / unit.
  const hundredths = (value * 100n + unit / 2n) / unit;
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n).toString().padStart(2, '0');
  return `${groupIndianDigits(whole.toString())}.${fraction}`;
}

/**
 * Compact rupees: lakh (L) or crore (Cr) with 2 decimals, half up; the full grouped amount below
 * ₹1 lakh. A value that rounds to 100.00 L shows as ₹1.00 Cr. For non-negative amounts.
 */
export function formatInrCompact(value: Rupees): string {
  const rupees = BigInt(value);
  if (rupees >= CRORE) return `₹${unitsWithTwoDecimals(rupees, CRORE)} Cr`;
  if (rupees >= LAKH) {
    const asLakh = unitsWithTwoDecimals(rupees, LAKH);
    // At ₹99,99,500 the lakh value rounds to 100.00, which reads better as ₹1.00 Cr.
    if (asLakh === '100.00') return `₹${unitsWithTwoDecimals(rupees, CRORE)} Cr`;
    return `₹${asLakh} L`;
  }
  return `₹${groupIndianDigits(rupees.toString())}`;
}
