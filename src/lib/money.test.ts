import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatInr, formatInrCompact, sumRupees } from './money';

describe('formatInr', () => {
  it('groups the Indian way with 2 decimals', () => {
    expect(formatInr('0')).toBe('₹0.00');
    expect(formatInr('136880')).toBe('₹1,36,880.00');
    expect(formatInr('1000000000')).toBe('₹1,00,00,00,000.00');
  });

  // Feature: frontend-shell, Property 1: Full amounts keep every digit
  it('keeps every digit of the input', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 18n }), (amount) => {
        const text = formatInr(amount.toString());
        expect(text.startsWith('₹')).toBe(true);
        expect(text.endsWith('.00')).toBe(true);
        const digits = text.slice(1, -3).replace(/,/g, '');
        expect(BigInt(digits).toString()).toBe(amount.toString());
      }),
    );
  });

  it('groups 3, 4, 6, 8 and 13 digit amounts correctly', () => {
    expect(formatInr('100')).toBe('₹100.00');
    expect(formatInr('1000')).toBe('₹1,000.00');
    expect(formatInr('100000')).toBe('₹1,00,000.00');
    expect(formatInr('10000000')).toBe('₹1,00,00,000.00');
    expect(formatInr('1000000000000')).toBe('₹10,00,00,00,00,000.00');
  });
});

describe('formatInrCompact', () => {
  it('matches the design examples', () => {
    expect(formatInrCompact('50000')).toBe('₹50,000');
    expect(formatInrCompact('99999')).toBe('₹99,999');
    expect(formatInrCompact('100000')).toBe('₹1.00 L');
    expect(formatInrCompact('4000000')).toBe('₹40.00 L');
    expect(formatInrCompact('8500000')).toBe('₹85.00 L');
    expect(formatInrCompact('9999499')).toBe('₹99.99 L');
    expect(formatInrCompact('9999500')).toBe('₹1.00 Cr');
    expect(formatInrCompact('124000000')).toBe('₹12.40 Cr');
    expect(formatInrCompact('1200000000')).toBe('₹120.00 Cr');
    expect(formatInrCompact('99900000000')).toBe('₹9,990.00 Cr');
  });

  // Feature: frontend-shell, Property 2: Compact amounts are within half a hundredth
  it('shows a value within half a hundredth of a unit and never inverts order', () => {
    const parse = (text: string): { value: number; unit: bigint } => {
      if (text.endsWith(' Cr'))
        return { value: Number(text.slice(1, -3).replace(/,/g, '')), unit: 10_000_000n };
      if (text.endsWith(' L'))
        return { value: Number(text.slice(1, -2).replace(/,/g, '')), unit: 100_000n };
      return { value: Number(text.slice(1).replace(/,/g, '')), unit: 1n };
    };
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 15n }), (amount) => {
        const { value, unit } = parse(formatInrCompact(amount.toString()));
        const shown = BigInt(Math.round(value * 100)) * unit;
        const diff = shown - amount * 100n;
        expect(diff <= unit / 2n && diff >= -unit / 2n).toBe(true);
      }),
    );
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 13n }),
        fc.bigInt({ min: 0n, max: 10n ** 13n }),
        (a, b) => {
          const toNum = (text: string): number => {
            const mult = text.endsWith(' Cr') ? 1e7 : text.endsWith(' L') ? 1e5 : 1;
            return Number(text.replace(/[₹, CrL]/g, '')) * mult;
          };
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(toNum(formatInrCompact(lo.toString()))).toBeLessThanOrEqual(
            toNum(formatInrCompact(hi.toString())),
          );
        },
      ),
    );
  });
});

describe('sumRupees', () => {
  it('adds exactly, including above 2^53', () => {
    expect(sumRupees([])).toBe('0');
    expect(sumRupees(['100', '200', '3'])).toBe('303');
    expect(sumRupees(['9007199254740993', '9007199254740993'])).toBe('18014398509481986');
  });

  // Feature: frontend-shell, Property 3: Sums are exact in any order
  it('is exact and order-independent', () => {
    fc.assert(
      fc.property(fc.array(fc.bigInt({ min: 0n, max: 10n ** 15n })), (amounts) => {
        const strings = amounts.map((a) => a.toString());
        const expected = amounts.reduce((total, a) => total + a, 0n).toString();
        expect(sumRupees(strings)).toBe(expected);
        expect(sumRupees([...strings].reverse())).toBe(expected);
      }),
    );
  });
});
