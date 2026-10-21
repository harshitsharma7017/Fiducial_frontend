import { describe, expect, it } from 'vitest';
import { caseRecord } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { DataSheetImport } from '@/shared';
import { toDataSheetForm } from './data-sheet';
import {
  applyDataSheetImport,
  setPendingDataSheet,
  suggestedMapping,
  takePendingDataSheet,
} from './data-sheet-import';

const LOCATION = 'c'.repeat(24);

function imported(overrides: Partial<DataSheetImport> = {}): DataSheetImport {
  return {
    insured: { name: null, gstin: null, address: null, natureOfBusiness: null, policyPeriod: null },
    locations: [
      {
        sheetName: 'data sheet',
        riskLocation: 'Plant 1',
        suggestedLocationId: LOCATION,
        buildings: [{ name: 'Building 1', sqFt: '40000', ratePerSqFt: '2500', amount: null }],
        fire: [{ key: 'STOCKS', sqFt: null, ratePerSqFt: null, amount: '60000000' }],
        hypothecation: 'State Bank of India',
        openStock: null,
        risk: { fireFighting: 'Hydrants' },
      },
    ],
    sections: [
      { code: 'MONEY', lines: { cashInSafe: '200000' }, proposed1: null, annexure: [] },
      {
        code: 'PLATE_GLASS',
        lines: {},
        proposed1: null,
        annexure: [
          {
            description: 'Front glass',
            quantity: '4',
            dimensions: null,
            makeModel: null,
            serialNo: null,
            year: null,
            sumInsured: '150000',
          },
        ],
      },
    ],
    warnings: [],
    ...overrides,
  };
}

const record = caseRecord({
  locations: [
    {
      locationId: LOCATION,
      location: null,
      buildings: [],
      buildingsTotal: '0',
      fire: [{ key: 'OTHER_MACHINERY', sqFt: null, ratePerSqFt: null, amount: '1000' }],
      fireTotal: '1000',
      hypothecation: null,
      openStock: 'Old note',
      risk: { fireFighting: 'Old answer', buildingAge: '10 years' },
    },
  ] as never,
});

describe('applyDataSheetImport', () => {
  it('fills the mapped location and the sections from the workbook', () => {
    const before = toDataSheetForm(record);
    const { values, summary } = applyDataSheetImport(
      before,
      imported(),
      suggestedMapping(imported()),
    );
    const [location] = values.locations;
    // D1: the sheet's building replaces the location's buildings.
    expect(location?.buildings).toEqual([
      { name: 'Building 1', sqFt: '40000', ratePerSqFt: '2500', amount: '' },
    ]);
    // The sheet's Fire lines replace the location's: the old machinery line is cleared.
    expect(location?.fire.find((item) => item.key === 'STOCKS')?.amount).toBe('60000000');
    expect(location?.fire.find((item) => item.key === 'OTHER_MACHINERY')?.amount).toBe('');
    expect(location?.hypothecation).toBe('State Bank of India');
    // Answers the sheet gives replace; the others stay.
    expect(location?.openStock).toBe('Old note');
    expect(location?.risk.fireFighting).toBe('Hydrants');
    expect(location?.risk.buildingAge).toBe('10 years');
    const money = values.sections.find((section) => section.code === 'MONEY');
    expect(money).toMatchObject({ included: true, lines: { cashInSafe: '200000' } });
    const glass = values.sections.find((section) => section.code === 'PLATE_GLASS');
    expect(glass?.included).toBe(true);
    expect(glass?.annexure).toEqual([
      {
        description: 'Front glass',
        quantity: '4',
        dimensions: '',
        makeModel: '',
        serialNo: '',
        year: '',
        sumInsured: '150000',
      },
    ]);
    expect(summary).toEqual({
      locations: [{ sheetName: 'data sheet', locationId: LOCATION }],
      sections: ['Money', 'Plate Glass'],
      skipped: [],
    });
  });

  it('leaves out a sheet mapped to no location', () => {
    const { values, summary } = applyDataSheetImport(toDataSheetForm(record), imported(), [null]);
    expect(values.locations[0]?.risk.fireFighting).toBe('Old answer');
    expect(summary.skipped).toEqual(['data sheet: left out, no location chosen for it.']);
  });

  it('hands a workbook chosen on the New proposal screen to its case once', () => {
    const file = new File(['x'], 'sheet.xlsx');
    setPendingDataSheet('case-1', file);
    expect(takePendingDataSheet('case-1')).toBe(file);
    expect(takePendingDataSheet('case-1')).toBeNull();
  });
});
