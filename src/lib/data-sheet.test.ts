import { describe, expect, it } from 'vitest';
import { FIRE_GROUPS, FIRE_ITEMS, OTHER_SECTIONS } from '@/shared';
import {
  blankLocation,
  fireGroupTotals,
  itemSumInsured,
  locationTotal,
  measuredSumInsured,
  toDataSheetRequest,
} from './data-sheet';

describe('measuredSumInsured', () => {
  it('multiplies area by rate to the rupee, half up', () => {
    expect(measuredSumInsured('1000', '2500')).toBe('2500000');
    expect(measuredSumInsured('10.5', '3')).toBe('32'); // 31.5 → 32
    expect(measuredSumInsured('10.25', '3')).toBe('31'); // 30.75 → 31
    expect(measuredSumInsured('0.01', '49')).toBe('0'); // 0.49 → 0
  });

  it('is null unless both values are valid', () => {
    expect(measuredSumInsured('', '2500')).toBeNull();
    expect(measuredSumInsured('100', '')).toBeNull();
    expect(measuredSumInsured('1.234', '10')).toBeNull();
    expect(measuredSumInsured('100', '10.5')).toBeNull();
  });
});

describe('itemSumInsured', () => {
  it('prefers the typed amount', () => {
    expect(
      itemSumInsured({ key: 'BUILDING_1', sqFt: '1000', ratePerSqFt: '2000', amount: '500' }),
    ).toBe('500');
  });

  it('prices a measured item as area × rate when no amount is typed', () => {
    expect(
      itemSumInsured({ key: 'BUILDING_1', sqFt: '1000', ratePerSqFt: '2000', amount: '' }),
    ).toBe('2000000');
  });

  it('ignores area and rate on an item that is not measured', () => {
    expect(itemSumInsured({ key: 'STOCKS', sqFt: '1000', ratePerSqFt: '2000', amount: '' })).toBe(
      '0',
    );
  });

  it('counts an invalid amount as nothing', () => {
    expect(itemSumInsured({ key: 'STOCKS', sqFt: null, ratePerSqFt: null, amount: '12.5' })).toBe(
      '0',
    );
  });
});

describe('totals', () => {
  const location = (amounts: Partial<Record<string, string>>) => {
    const blank = blankLocation('a'.repeat(24));
    return {
      ...blank,
      fire: blank.fire.map((item) => ({ ...item, amount: amounts[item.key] ?? '' })),
    };
  };

  it('adds a location’s items and each Fire line across locations', () => {
    const first = location({ BUILDING_1: '100', COMPOUND_WALL: '50', STOCKS: '7' });
    const second = location({ BUILDING_2: '1000', STOCKS_THIRD_PARTY: '3' });
    expect(locationTotal(first)).toBe('157');
    const totals = fireGroupTotals([first, second]);
    expect(totals.BUILDING).toBe('1150');
    expect(totals.STOCKS).toBe('10');
    expect(totals.FFF).toBe('0');
    expect(Object.keys(totals)).toEqual([...FIRE_GROUPS]);
  });

  it('keeps precision beyond floating point', () => {
    const big = location({ STOCKS: '9999999999999', OTHER: '9999999999999' });
    expect(locationTotal(big)).toBe('19999999999998');
  });
});

describe('toDataSheetRequest', () => {
  it('leaves out Fire items that are entirely blank', () => {
    const blank = blankLocation('b'.repeat(24));
    const request = toDataSheetRequest({
      dueDate: '2026-10-20',
      policyStart: null,
      locations: [
        {
          ...blank,
          fire: blank.fire.map((item) => ({
            key: item.key,
            sqFt: item.key === 'BUILDING_1' ? '100' : null,
            ratePerSqFt: null,
            amount: item.key === 'STOCKS' ? '5' : null,
          })),
          hypothecation: null,
          openStock: null,
          risk: Object.fromEntries(Object.keys(blank.risk).map((key) => [key, null])) as never,
        },
      ],
      fireOption2: [],
      sections: OTHER_SECTIONS.map((code) => ({
        code,
        included: false,
        proposed1: null,
        proposed2: null,
      })),
      claims: [],
      notes: null,
    });
    expect(request.locations[0]?.fire.map((item) => item.key)).toEqual(['BUILDING_1', 'STOCKS']);
    expect(blank.fire).toHaveLength(FIRE_ITEMS.length);
  });
});
