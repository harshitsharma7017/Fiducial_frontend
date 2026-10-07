import {
  IMPORT_ENTITIES,
  IMPORT_SHEETS,
  MASTER_WORKBOOK_MAX_BYTES,
  MAX_IMPORT_BYTES,
  can,
  type ImportEntity,
  type Permission,
  type Role,
} from '@/shared';

/**
 * What the Import data page loads: a record type with a template, the IIB master workbook, or the
 * product and cover masters workbook.
 */
export type RecordType = ImportEntity | 'masters' | 'catalog';

export interface RecordTypeInfo {
  label: string;
  description: string;
  permission: Permission;
  templateLabel: string;
  templateUrl: string;
  maxBytes: number;
}

export const RECORD_TYPES: Record<RecordType, RecordTypeInfo> = {
  ...(Object.fromEntries(
    IMPORT_ENTITIES.map((entity) => [
      entity,
      {
        label: IMPORT_SHEETS[entity].label,
        description: IMPORT_SHEETS[entity].description,
        permission: IMPORT_SHEETS[entity].permission,
        templateLabel: `${IMPORT_SHEETS[entity].label} template`,
        templateUrl: `/api/proxy/imports/${entity}/template`,
        maxBytes: MAX_IMPORT_BYTES,
      },
    ]),
  ) as Record<ImportEntity, RecordTypeInfo>),
  masters: {
    label: 'IIB master (occupancies and pincodes)',
    description:
      'The occupancy codes with their rates, and the pincodes with their earthquake zones and rates. The Fire rate check, client occupancies and risk locations read the active version.',
    permission: 'masters.manage',
    templateLabel: 'IIB master template',
    templateUrl: '/api/proxy/masters/workbook?template=true',
    maxBytes: MASTER_WORKBOOK_MAX_BYTES,
  },
  catalog: {
    label: 'Product and cover masters',
    description:
      'Products and their sum insured ranges, the 14 coverage sections, the add-on lists, the BSUS and BLUS add-on limits and rates, GST rates and the standard notes. One workbook, a sheet per master.',
    permission: 'masters.manage',
    templateLabel: 'Download current masters',
    templateUrl: '/api/proxy/catalog/workbook',
    maxBytes: MASTER_WORKBOOK_MAX_BYTES,
  },
};

/** The record types in page order: the masters first, as clients and locations depend on them. */
export const RECORD_TYPE_ORDER: readonly RecordType[] = ['masters', 'catalog', ...IMPORT_ENTITIES];

export function isRecordType(value: string | null): value is RecordType {
  return value !== null && (RECORD_TYPE_ORDER as readonly string[]).includes(value);
}

/** The record types a user's roles may import. */
export function allowedRecordTypes(roles: readonly Role[]): RecordType[] {
  return RECORD_TYPE_ORDER.filter((type) => can(roles, RECORD_TYPES[type].permission));
}
