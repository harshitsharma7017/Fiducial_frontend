import { z } from 'zod';

/**
 * Proposal domain for the frontend shell: enums, labels and schemas, defined once and reused.
 * These are UI types for sample data; they move to Fiducial_backend/src/shared when a proposals
 * API exists. Amounts are whole-rupee digit strings, never floats.
 */

export const PROPOSAL_TYPES = ['NEW', 'EXISTING'] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];
export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  NEW: 'New',
  EXISTING: 'Renewal',
};

export const STAGES = [
  'DRAFT',
  'DATA_SHEET',
  'RFQ_SENT',
  'QUOTES_RECEIVED',
  'QCR',
  'PLACED',
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  DRAFT: 'Draft',
  DATA_SHEET: 'Data Sheet',
  RFQ_SENT: 'RFQ Sent',
  QUOTES_RECEIVED: 'Quotes Received',
  QCR: 'QCR',
  PLACED: 'Placed',
};
/** URL slug for each stage (the dashboard's ?stage= parameter). */
export const STAGE_SLUGS: Record<Stage, string> = {
  DRAFT: 'draft',
  DATA_SHEET: 'data-sheet',
  RFQ_SENT: 'rfq-sent',
  QUOTES_RECEIVED: 'quotes-received',
  QCR: 'qcr',
  PLACED: 'placed',
};

export const PRODUCTS = ['BSUS', 'BLUS', 'SFSP', 'PAR'] as const;
export type Product = (typeof PRODUCTS)[number];
export const PRODUCT_NAMES: Record<Product, string> = {
  BSUS: 'Bharat Sookshma Udyam Suraksha',
  BLUS: 'Bharat Laghu Udyam Suraksha',
  SFSP: 'Standard Fire & Special Perils',
  PAR: 'Property All Risk',
};

/** The 14 coverage sections, in the canonical order from document 07. */
export const SECTION_CODES = [
  'FIRE',
  'BURGLARY',
  'FIRE_FLOATER',
  'BURGLARY_FLOATER',
  'FIRE_LOSS_OF_PROFIT',
  'MONEY',
  'FIDELITY_GUARANTEE',
  'PLATE_GLASS',
  'NEON_GLOW_SIGN',
  'ALL_RISK',
  'EEI',
  'MECHANICAL_BREAKDOWN',
  'BOILER_PRESSURE_PLANT',
  'PUBLIC_LIABILITY',
] as const;
export type SectionCode = (typeof SECTION_CODES)[number];
export const SECTION_LABELS: Record<SectionCode, string> = {
  FIRE: 'Fire',
  BURGLARY: 'Burglary',
  FIRE_FLOATER: 'Fire Floater',
  BURGLARY_FLOATER: 'Burglary Floater',
  FIRE_LOSS_OF_PROFIT: 'Fire Loss of Profit',
  MONEY: 'Money',
  FIDELITY_GUARANTEE: 'Fidelity Guarantee',
  PLATE_GLASS: 'Plate Glass',
  NEON_GLOW_SIGN: 'Neon / Glow Sign',
  ALL_RISK: 'All Risk',
  EEI: 'EEI',
  MECHANICAL_BREAKDOWN: 'Mechanical Breakdown',
  BOILER_PRESSURE_PLANT: 'Boiler and Pressure Plant',
  PUBLIC_LIABILITY: 'Public Liability',
};

export const SUM_INSURED_OPTIONS = ['EXISTING', 'PROPOSED_1', 'PROPOSED_2'] as const;
export type SumInsuredOption = (typeof SUM_INSURED_OPTIONS)[number];
export const SUM_INSURED_OPTION_LABELS: Record<SumInsuredOption, string> = {
  EXISTING: 'Existing',
  PROPOSED_1: 'Proposed 1',
  PROPOSED_2: 'Proposed 2',
};

export const QUOTE_STATUSES = ['NOT_SENT', 'SENT', 'QUOTED', 'DECLINED', 'NO_RESPONSE'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  NOT_SENT: 'Not sent',
  SENT: 'Sent',
  QUOTED: 'Quoted',
  DECLINED: 'Declined',
  NO_RESPONSE: 'No response',
};

export const DOC_STATUSES = ['NOT_STARTED', 'DRAFT', 'READY', 'SENT', 'APPROVED'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];
export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  READY: 'Ready',
  SENT: 'Sent',
  APPROVED: 'Approved',
};

export const DOCUMENT_KINDS = ['DATA_SHEET', 'RFQ', 'QCR', 'PLACEMENT_SLIP'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  DATA_SHEET: 'Data Sheet',
  RFQ: 'RFQ',
  QCR: 'QCR',
  PLACEMENT_SLIP: 'Placement Slip',
};

/** Whole rupees as a digit string, for example "125000000". Never a float. */
const RupeesSchema = z.string().regex(/^\d+$/, 'Whole rupees as digits');
const IsoDate = z.iso.date();
const IsoDateTime = z.iso.datetime();

const ProposalBaseSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  client: z.object({ name: z.string().min(1), city: z.string().min(1) }),
  product: z.enum(PRODUCTS),
  stage: z.enum(STAGES),
  owner: z.string().min(1),
  policyPeriod: z.object({ start: IsoDate, end: IsoDate }),
  addOns: z.object({ selected: z.array(z.string()), catalogueSize: z.number().int().positive() }),
  clauses: z.array(z.string()),
  excess: z.array(z.object({ section: z.enum(SECTION_CODES), note: z.string() })),
  insurers: z
    .array(
      z.object({
        insurer: z.string().min(1),
        status: z.enum(QUOTE_STATUSES),
        updatedAt: IsoDateTime.nullable(),
      }),
    )
    .max(5),
  documents: z.array(
    z.object({
      kind: z.enum(DOCUMENT_KINDS),
      status: z.enum(DOC_STATUSES),
      updatedAt: IsoDateTime.nullable(),
    }),
  ),
  activity: z.array(
    z.object({ at: IsoDateTime, actor: z.string().min(1), message: z.string().min(1) }),
  ),
  placedOn: IsoDate.nullable(),
});

export const NewProposalSchema = ProposalBaseSchema.extend({
  type: z.literal('NEW'),
  // A new proposal gets its product, policy dates and add-ons at the QCR stage (the RFQ format
  // says "to be picked from QCR"), so until then they are null.
  product: z.enum(PRODUCTS).nullable(),
  policyPeriod: z.object({ start: IsoDate, end: IsoDate }).nullable(),
  addOns: z
    .object({ selected: z.array(z.string()), catalogueSize: z.number().int().positive() })
    .nullable(),
  dueDate: IsoDate,
  sections: z.array(
    z.strictObject({
      code: z.enum(SECTION_CODES),
      included: z.boolean(),
      // No "existing" key: a new proposal has no existing policy.
      sumInsured: z.strictObject({ proposed1: RupeesSchema, proposed2: RupeesSchema }),
    }),
  ),
});
export type NewProposal = z.infer<typeof NewProposalSchema>;

export const RenewalProposalSchema = ProposalBaseSchema.extend({
  type: z.literal('EXISTING'),
  existingPolicy: z.object({
    insurer: z.string().min(1),
    policyNumber: z.string().min(1),
    expiresOn: IsoDate,
  }),
  sections: z.array(
    z.strictObject({
      code: z.enum(SECTION_CODES),
      included: z.boolean(),
      sumInsured: z.strictObject({
        existing: RupeesSchema,
        proposed1: RupeesSchema,
        proposed2: RupeesSchema,
      }),
    }),
  ),
});
export type RenewalProposal = z.infer<typeof RenewalProposalSchema>;

/** Strict union, so an "existing" amount on a new proposal fails to validate as well as to type. */
export const ProposalSchema = z.discriminatedUnion('type', [
  NewProposalSchema,
  RenewalProposalSchema,
]);
export type Proposal = z.infer<typeof ProposalSchema>;

export type Rupees = string;
export type SectionLine = Proposal['sections'][number];
