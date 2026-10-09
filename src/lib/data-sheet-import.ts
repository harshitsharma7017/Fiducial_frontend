import {
  FIRE_ITEMS,
  OTHER_SECTION_LABELS,
  RISK_DETAIL_FIELDS,
  type DataSheetImport,
} from '@/shared';
import type { DataSheetForm } from './data-sheet';

// The client's Data Sheet workbook, as read by the API, put into the Data Sheet form: each sheet
// fills the location it is mapped to (its Fire lines replace the location's, its answers fill
// the risk details), and the other sections are ticked with their lines and annexure rows. The
// form is then checked and saved as usual.

export interface ImportSummary {
  /** Locations filled, by sheet. */
  locations: { sheetName: string; locationId: string }[];
  /** Sections ticked and filled, by name. */
  sections: string[];
  /** What could not be placed in the form, in words. */
  skipped: string[];
}

const blank = (value: string | null | undefined) => value ?? '';

/**
 * The form with the workbook's values. `mapping` gives, by sheet (in the workbook's order), the
 * case location it fills; null leaves the sheet out.
 */
export function applyDataSheetImport(
  values: DataSheetForm,
  imported: DataSheetImport,
  mapping: readonly (string | null)[],
): { values: DataSheetForm; summary: ImportSummary } {
  const summary: ImportSummary = { locations: [], sections: [], skipped: [] };
  const locations = values.locations.map((location) => ({ ...location }));
  imported.locations.forEach((sheet, index) => {
    const locationId = mapping[index] ?? null;
    const target = locations.find((location) => location.locationId === locationId);
    if (!locationId || !target) {
      summary.skipped.push(`${sheet.sheetName}: left out, no location chosen for it.`);
      return;
    }
    const fire = new Map(sheet.fire.map((item) => [item.key, item]));
    // The sheet is the whole location: its Fire lines replace the location's.
    target.fire = FIRE_ITEMS.map((item) => {
      const value = fire.get(item.key);
      return {
        key: item.key,
        sqFt: blank(value?.sqFt),
        ratePerSqFt: blank(value?.ratePerSqFt),
        amount: blank(value?.amount),
      };
    });
    if (sheet.hypothecation) target.hypothecation = sheet.hypothecation;
    if (sheet.openStock) target.openStock = sheet.openStock;
    target.risk = {
      ...target.risk,
      ...Object.fromEntries(
        RISK_DETAIL_FIELDS.flatMap((field) => {
          const answer = sheet.risk[field.key];
          return answer ? [[field.key, answer]] : [];
        }),
      ),
    };
    summary.locations.push({ sheetName: sheet.sheetName, locationId });
  });

  const sections = values.sections.map((section) => {
    const found = imported.sections.find((item) => item.code === section.code);
    if (!found) return section;
    summary.sections.push(OTHER_SECTION_LABELS[section.code]);
    const hasLines = Object.keys(found.lines).length > 0;
    return {
      ...section,
      included: true,
      lines: { ...section.lines, ...found.lines },
      proposed1:
        !hasLines && found.annexure.length === 0 && found.proposed1 !== null
          ? found.proposed1
          : section.proposed1,
      annexure:
        found.annexure.length > 0
          ? found.annexure.map((row) => ({
              description: row.description,
              quantity: blank(row.quantity),
              dimensions: blank(row.dimensions),
              makeModel: blank(row.makeModel),
              serialNo: blank(row.serialNo),
              year: blank(row.year),
              sumInsured: row.sumInsured,
            }))
          : section.annexure,
    };
  });
  for (const found of imported.sections) {
    if (!values.sections.some((section) => section.code === found.code)) {
      summary.skipped.push(
        `${OTHER_SECTION_LABELS[found.code]}: the section is switched off in the coverage section master.`,
      );
    }
  }
  return { values: { ...values, locations, sections }, summary };
}

/** The sheet-to-location mapping the API suggests, each location used once. */
export function suggestedMapping(imported: DataSheetImport): (string | null)[] {
  const used = new Set<string>();
  return imported.locations.map((sheet) => {
    const id = sheet.suggestedLocationId;
    if (!id || used.has(id)) return null;
    used.add(id);
    return id;
  });
}

// A workbook chosen on the New proposal screen, waiting for its case to open: the Data Sheet
// form reads it once, then it is gone. Kept in memory only, for the page the app moves to next.
const pending = new Map<string, File>();

export function setPendingDataSheet(caseId: string, file: File): void {
  pending.set(caseId, file);
}

export function takePendingDataSheet(caseId: string): File | null {
  const file = pending.get(caseId) ?? null;
  pending.delete(caseId);
  return file;
}
