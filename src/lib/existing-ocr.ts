import { FIRE_GROUP_LABELS, OTHER_SECTION_LABELS, type ExistingOcr } from '@/shared';
import type { DataSheetForm } from './data-sheet';

// The existing policy's sum insured, as read by the API from the policy file, put into the Data
// Sheet form's Existing column. Only the Existing figures change; what the form already holds
// elsewhere is kept. The form is then checked and saved as usual.

export interface ExistingOcrSummary {
  /** What was filled, in words. */
  filled: string[];
  /** What could not be placed in the form, in words. */
  skipped: string[];
}

export function applyExistingOcr(
  values: DataSheetForm,
  read: ExistingOcr,
): { values: DataSheetForm; summary: ExistingOcrSummary } {
  const summary: ExistingOcrSummary = { filled: [], skipped: [] };
  const current = values.existing ?? {
    insurer: '',
    policyNumber: '',
    fireLines: [],
    fireTotal: '',
  };
  const existing = {
    ...current,
    fireLines: current.fireLines.map((line) => ({ ...line })),
  };
  if (read.insurer) {
    existing.insurer = read.insurer;
    summary.filled.push('insurer');
  }
  if (read.policyNumber) {
    existing.policyNumber = read.policyNumber;
    summary.filled.push('policy number');
  }
  for (const line of read.fireLines) {
    if (line.amount === null) continue;
    const target = existing.fireLines.find((item) => item.group === line.group);
    if (target) target.amount = line.amount;
    else existing.fireLines.push({ group: line.group, amount: line.amount });
    summary.filled.push(FIRE_GROUP_LABELS[line.group]);
  }
  if (read.fireLines.some((line) => line.amount !== null)) {
    existing.fireTotal = '';
  } else if (read.fireTotal) {
    existing.fireTotal = read.fireTotal;
    summary.filled.push('Fire total');
  }

  const sections = values.sections.map((section) => ({
    ...section,
    existingLines: { ...section.existingLines },
  }));
  for (const item of read.sections) {
    const target = sections.find((section) => section.code === item.code);
    const label = OTHER_SECTION_LABELS[item.code];
    if (!target || !target.included) {
      summary.skipped.push(`${label}: not a section of this case, left out.`);
      continue;
    }
    if (item.existing) target.existing = item.existing;
    Object.assign(target.existingLines, item.existingLines);
    summary.filled.push(label);
  }
  return { values: { ...values, existing, sections }, summary };
}
