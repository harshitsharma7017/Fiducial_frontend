import { groupIndianDigits } from '@/shared';

const MAX_INTEGER_DIGITS = 15;
const MAX_FRACTION_DIGITS = 2;

/**
 * Reduces typed text to a plain amount string: digits and one decimal point, at most 2 decimals
 * and 15 integer digits, without leading zeros. Grouping commas are dropped.
 */
export function sanitiseAmount(text: string): string {
  let integer = '';
  let fraction = '';
  let seenPoint = false;
  for (const character of text) {
    if (character >= '0' && character <= '9') {
      if (seenPoint) {
        if (fraction.length < MAX_FRACTION_DIGITS) fraction += character;
      } else if (integer.length < MAX_INTEGER_DIGITS) {
        integer += character;
      }
    } else if (character === '.' && !seenPoint) {
      seenPoint = true;
    }
  }
  integer = integer.replace(/^0+(?=\d)/, '');
  if (seenPoint) return `${integer || '0'}.${fraction}`;
  return integer;
}

/** The amount with Indian digit grouping, keeping a trailing point while the user types. */
export function formatAmountForInput(raw: string): string {
  if (!raw) return '';
  const [integer = '', fraction] = raw.split('.');
  const grouped = integer ? groupIndianDigits(integer) : '0';
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** Number of digits and points before a position, so the caret can be restored after grouping. */
export function significantCharactersBefore(text: string, position: number): number {
  return text.slice(0, position).replace(/[^\d.]/g, '').length;
}

/** The position in formatted text that follows `count` digits and points. */
export function positionAfterSignificant(formatted: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (formatted[index] !== ',') {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }
  return formatted.length;
}
