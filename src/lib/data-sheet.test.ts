import { describe, expect, it } from 'vitest';
import { FIRE_GROUPS, FIRE_ITEMS, OTHER_SECTIONS, type DataSheetInput } from '@/shared';
import {
  blankLocation,
  contentsOptions,
  contentsTotal,
  fireGroupTotals,
  fireTotal,
  groupTotal,
  itemSumInsured,
  locationTotal,
  measuredPaise,
  annexureTotal,
  onBasis,
  sectionSumInsured,
  toDataSheetRequest,
  withCover,
} from './data-sheet';

describe('measuredPaise', () => {
  it('multiplies area by rate exactly, in paise', () => {
    expect(measuredPaise('1000', '2500')).toBe(250000000n);
    expect(measuredPaise('10.5', '3')).toBe(3150n);
    expect(measuredPaise('10.25', '3')).toBe(3075n);
  });

  it('is null unless both values are valid', () => {
    expect(measuredPaise('', '2500')).toBeNull();
    expect(measuredPaise('100', '')).toBeNull();
    expect(measuredPaise('1.234', '10')).toBeNull();
    expect(measuredPaise('100', '10.5')).toBeNull();
  });
});

describe('matching the client’s Excel', () => {
  it('shows each item to the rupee but totals the exact amounts', () => {
    const blank = blankLocation('c'.repeat(24));
    const location = {
      ...blank,
      fire: blank.fire.map((item) =>
        item.key === 'BUILDING_1' || item.key === 'BUILDING_2'
          ? { ...item, sqFt: '10.5', ratePerSqFt: '3' }
          : item.key === 'GENSET'
            ? { ...item, amount: '1000' }
            : item,
      ),
    };
    // Excel: 31.5 shows as 32 in each row, and SUM shows 63, not 64.
    expect(itemSumInsured({ key: 'BUILDING_1', sqFt: '10.5', ratePerSqFt: '3', amount: '' })).toBe(
      '32',
    );
    expect(groupTotal(location, 'BUILDING')).toBe('63');
    expect(locationTotal(location)).toBe('1063');
    expect(fireTotal([location])).toBe('1063');
    expect(contentsTotal([location])).toBe('1000');
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

function requestOf(overrides: Partial<DataSheetInput> = {}): DataSheetInput {
  return {
    dueDate: '2026-10-20',
    policyStart: null,
    policyEnd: null,
    locations: [],
    fireOption2: [],
    fireCovers: [],
    product: { code: null, reason: null },
    addons: [],
    existing: null,
    sections: OTHER_SECTIONS.map((code) => ({
      code,
      included: false,
      proposed1: null,
      proposed2: null,
      existing: null,
      lines: {},
      lines2: {},
      existingLines: {},
      basis: null,
      covers: [],
      annexure: [],
    })),
    claims: [],
    notes: null,
    ...overrides,
  };
}

describe('toDataSheetRequest', () => {
  it('leaves out Fire items that are entirely blank', () => {
    const blank = blankLocation('b'.repeat(24));
    const request = toDataSheetRequest({
      ...requestOf(),
      dueDate: '2026-10-20',
      policyStart: null,
      policyEnd: null,
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
    });
    expect(request.locations[0]?.fire.map((item) => item.key)).toEqual(['BUILDING_1', 'STOCKS']);
    expect(blank.fire).toHaveLength(FIRE_ITEMS.length);
  });

  it('sends an Existing column left blank as none, so the policy software’s copy is used', () => {
    const blankExisting = {
      insurer: null,
      policyNumber: null,
      fireLines: FIRE_GROUPS.map((group) => ({ group, amount: null })),
      fireTotal: null,
    };
    expect(toDataSheetRequest(requestOf({ existing: blankExisting })).existing).toBeNull();
    const typed = { ...blankExisting, insurer: 'Example General', fireTotal: '150000000' };
    expect(toDataSheetRequest(requestOf({ existing: typed })).existing).toEqual(typed);
  });

  it('works Burglary on a basis out from the Fire contents (C-3)', () => {
    const blank = blankLocation('b'.repeat(24));
    const values = requestOf({
      locations: [
        {
          ...blank,
          fire: [
            { key: 'BUILDING_1', sqFt: null, ratePerSqFt: null, amount: '100000000' },
            { key: 'STOCKS', sqFt: null, ratePerSqFt: null, amount: '50000000' },
          ],
          hypothecation: null,
          openStock: null,
          risk: Object.fromEntries(Object.keys(blank.risk).map((key) => [key, null])) as never,
        },
      ],
      fireOption2: [
        { group: 'BUILDING', amount: '120000000' },
        { group: 'STOCKS', amount: '70000000' },
      ],
    });
    values.sections = values.sections.map((section) =>
      section.code === 'BURGLARY'
        ? { ...section, included: true, proposed1: '1', basis: 'FIRST_LOSS_25' }
        : section,
    );
    const burglary = toDataSheetRequest(values).sections.find((s) => s.code === 'BURGLARY');
    expect(burglary).toMatchObject({ proposed1: '50000000', proposed2: '70000000' });
  });
});

describe('Burglary basis and covers (C-3, C-6)', () => {
  const location = (amounts: Partial<Record<string, string>>) => {
    const blank = blankLocation('a'.repeat(24));
    return {
      ...blank,
      fire: blank.fire.map((item) => ({ ...item, amount: amounts[item.key] ?? '' })),
    };
  };

  it('takes the first-loss share to the rupee', () => {
    expect(onBasis('51000000', 'FIRST_LOSS_25')).toBe('12750000');
    expect(onBasis('101', 'FIRST_LOSS_50')).toBe('51');
    expect(onBasis('100', 'FULL')).toBe('100');
    expect(onBasis(null, 'FULL')).toBeNull();
  });

  it('adds Option 2 from the contents lines given a second figure only', () => {
    const at = location({ FFF: '10', STOCKS: '40', BUILDING_1: '1000' });
    expect(contentsOptions([at], [])).toEqual({ proposed1: '50', proposed2: null });
    expect(contentsOptions([at], [{ group: 'STOCKS', amount: '70' }])).toEqual({
      proposed1: '50',
      proposed2: '70',
    });
  });

  it('changes or clears one cover’s answer', () => {
    const covers = [{ name: 'Earthquake', required: true }];
    expect(withCover(covers, 'Terrorism', false)).toEqual([
      { name: 'Earthquake', required: true },
      { name: 'Terrorism', required: false },
    ]);
    expect(withCover(covers, 'Earthquake', null)).toEqual([]);
  });
});

describe('section sums insured (D-5)', () => {
  it('takes an annexure’s total, FLOP’s gross profit, else Proposed 1', () => {
    expect(
      annexureTotal([{ sumInsured: '150000' }, { sumInsured: '50000' }, { sumInsured: 'x' }]),
    ).toBe('200000');
    expect(
      sectionSumInsured({ code: 'EEI', proposed1: '9', annexure: [{ sumInsured: '1250000' }] }),
    ).toBe('1250000');
    expect(sectionSumInsured({ code: 'EEI', proposed1: '9', annexure: [] })).toBe('9');
    expect(
      sectionSumInsured({
        code: 'FIRE_LOSS_OF_PROFIT',
        proposed1: '1',
        lines: { annualGrossProfit: '800' },
      }),
    ).toBe('800');
    expect(
      sectionSumInsured({ code: 'MONEY', proposed1: '600000', lines: { cashInSafe: '1' } }),
    ).toBe('600000');
  });
});
