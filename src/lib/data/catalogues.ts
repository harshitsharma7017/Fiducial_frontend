import type { Product } from '@/types/proposal';

/**
 * Add-on catalogue sizes and sample selected names, taken from the client's RFQ workbook
 * (Fiducial_backend/data/client-formats). BSUS and BLUS share one 20-entry list (12 paid plus 8
 * inbuilt); PAR has 125, SFSP 185. The names are the workbook's wording.
 */
export const ADDON_CATALOGUE_SIZES: Record<Product, number> = {
  BSUS: 20,
  BLUS: 20,
  PAR: 125,
  SFSP: 185,
};

/** Add-on names seen in the workbook, used to fill a proposal's selected list. */
export const ADDON_NAMES: readonly string[] = [
  'Earthquake',
  'Storm Tempest Flood & Inundation',
  'Terrorism',
  'Additions, alterations or extensions',
  'Temporary removal of stocks',
  'Start-up expenses',
  'Professional fees',
  'Removal of debris',
  'Spontaneous Combustion',
  'Escalation Clause',
  'Forest Fire',
  'Expediting expenses',
  'Inadvertent Omission',
  'Impact Damage',
  'Loss of Rent Clause',
];

/** Clause names from the RFQ schedule's "Clauses to be attached". */
export const CLAUSE_NAMES: readonly string[] = [
  'Reinstatement Value Clause',
  'Local Authority Clause',
  'Designation of Property Clause',
  'Contract Price Insurance Clause',
  'Agreed Bank Clause',
  'Floater Clause',
  'Indemnity Period: 12 months',
  'Alternative Basis Clause',
  'Accumulated Stock Clause',
  'Departmental Clause',
];

/** The workbook marks warranties and excess as "Changes from one insurer to another". */
export const EXCESS_NOTE = 'As quoted by each insurer';
