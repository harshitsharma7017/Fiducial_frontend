import { describe, expect, it } from 'vitest';
import { caseRecord } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import type { ExistingOcr } from '@/shared';
import { toDataSheetForm } from './data-sheet';
import { applyExistingOcr } from './existing-ocr';

const read = (overrides: Partial<ExistingOcr> = {}): ExistingOcr => ({
  reader: 'GEMINI',
  manualEntryRequired: false,
  message: null,
  insurer: 'Abhay Insurance',
  policyNumber: 'P/1',
  fireLines: [{ group: 'BUILDING', amount: '2000000' }],
  fireTotal: null,
  sections: [],
  warnings: [],
  ...overrides,
});

describe('applyExistingOcr', () => {
  it('fills only the Existing column and keeps the rest of the form', () => {
    const form = toDataSheetForm(caseRecord());
    const { values, summary } = applyExistingOcr(form, read());
    expect(values.existing?.insurer).toBe('Abhay Insurance');
    expect(values.existing?.fireLines.find((line) => line.group === 'BUILDING')?.amount).toBe(
      '2000000',
    );
    expect(values.locations).toEqual(form.locations);
    expect(values.fireOption2).toEqual(form.fireOption2);
    expect(summary.filled).toContain('insurer');
  });

  it('uses the Fire total only when no line was read', () => {
    const form = toDataSheetForm(caseRecord());
    const { values } = applyExistingOcr(form, read({ fireLines: [], fireTotal: '3010000' }));
    expect(values.existing?.fireTotal).toBe('3010000');
  });

  it('leaves out a section the case does not include', () => {
    const form = toDataSheetForm(caseRecord());
    const off = form.sections.find((section) => !section.included);
    if (!off) return;
    const { summary } = applyExistingOcr(
      form,
      read({ sections: [{ code: off.code, existing: '100000', existingLines: {} }] }),
    );
    expect(summary.skipped).toHaveLength(1);
  });
});
