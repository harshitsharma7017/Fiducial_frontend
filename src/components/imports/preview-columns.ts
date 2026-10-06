import type { ImportEntity } from '@/shared';

export interface PreviewColumn {
  header: string;
  /** The cell text, from the row's values (keyed by template column). */
  cell: (values: Readonly<Record<string, string>>) => string;
}

const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(', ');

/** What the preview table shows of each row, so a row can be recognised at a glance. */
export const PREVIEW_COLUMNS: Record<ImportEntity, readonly PreviewColumn[]> = {
  clients: [
    { header: 'Insured name', cell: (v) => v.name ?? '' },
    { header: 'GSTIN', cell: (v) => v.gstin ?? '' },
    { header: 'City', cell: (v) => join(v.city, v.state) },
    { header: 'Occupancy', cell: (v) => v.occupancyCode ?? '' },
  ],
  'client-locations': [
    { header: 'Client', cell: (v) => v.clientName || v.clientGstin || '' },
    { header: 'Location', cell: (v) => v.name ?? '' },
    { header: 'City', cell: (v) => v.city ?? '' },
    { header: 'Pincode', cell: (v) => v.pincode ?? '' },
  ],
  insurers: [
    { header: 'Company', cell: (v) => v.company ?? '' },
    { header: 'Branch', cell: (v) => v.branch ?? '' },
    { header: 'RFQ emails', cell: (v) => v.rfqEmails ?? '' },
  ],
};
