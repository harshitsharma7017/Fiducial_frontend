import { describe, expect, it } from 'vitest';
import {
  formatAmountForInput,
  positionAfterSignificant,
  sanitiseAmount,
  significantCharactersBefore,
} from './amount-input';

describe('amount input helpers', () => {
  it('keeps digits and one decimal point, at most two decimals', () => {
    expect(sanitiseAmount('10,00,00,000')).toBe('100000000');
    expect(sanitiseAmount('₹ 2,50,000.505')).toBe('250000.50');
    expect(sanitiseAmount('12.3.4')).toBe('12.34');
    expect(sanitiseAmount('007')).toBe('7');
    expect(sanitiseAmount('.5')).toBe('0.5');
    expect(sanitiseAmount('abc')).toBe('');
  });

  it('formats with Indian grouping while typing', () => {
    expect(formatAmountForInput('100000000')).toBe('10,00,00,000');
    expect(formatAmountForInput('1000.')).toBe('1,000.');
    expect(formatAmountForInput('2500000.5')).toBe('25,00,000.5');
    expect(formatAmountForInput('')).toBe('');
  });

  it('restores the caret after the same digit when commas move', () => {
    // Typing a 6th digit at the end of "10,000" gives "1,00,0005"-like text; caret stays at the end.
    const typed = '10,0005';
    const significant = significantCharactersBefore(typed, typed.length);
    const formatted = formatAmountForInput(sanitiseAmount(typed));
    expect(formatted).toBe('1,00,005');
    expect(positionAfterSignificant(formatted, significant)).toBe(formatted.length);
    // Caret after the first digit stays after the first digit.
    expect(positionAfterSignificant('1,00,005', 1)).toBe(1);
  });
});
