import { addDays, toIstDate } from '@/lib/dates';
import {
  SECTION_CODES,
  type DocStatus,
  type DocumentKind,
  type NewProposal,
  type Proposal,
  type QuoteStatus,
  type RenewalProposal,
  type Rupees,
  type Stage,
} from '@/types/proposal';
import { ADDON_CATALOGUE_SIZES, ADDON_NAMES, CLAUSE_NAMES, EXCESS_NOTE } from './catalogues';

const CRORE = 10_000_000;
const LAKH = 100_000;

/** Inclusive rupee band each product's sum insured must fall in (document 07, F2). */
export const PRODUCT_BANDS: Record<NewProposal['product'], { min: number; max: number }> = {
  BSUS: { min: 0, max: 5 * CRORE },
  BLUS: { min: 5 * CRORE, max: 50 * CRORE },
  SFSP: { min: 50 * CRORE, max: Number.MAX_SAFE_INTEGER },
  PAR: { min: 5 * CRORE, max: Number.MAX_SAFE_INTEGER },
};

const INSURERS = ['Suraksha', 'Kavach', 'Abhay', 'Dhruva', 'Nirbhay', 'Sankalp'] as const;
const DOCUMENT_ORDER: readonly DocumentKind[] = ['DATA_SHEET', 'RFQ', 'QCR', 'PLACEMENT_SLIP'];

/** How far through the pipeline a stage is (0 = Draft, 5 = Placed). */
const STAGE_INDEX: Record<Stage, number> = {
  DRAFT: 0,
  DATA_SHEET: 1,
  RFQ_SENT: 2,
  QUOTES_RECEIVED: 3,
  QCR: 4,
  PLACED: 5,
};

interface Spec {
  n: string; // last 4 digits of the reference
  client: string;
  city: string;
  product: NewProposal['product'];
  /** Fire SI (Proposed 1), in rupees. The headline figure. */
  fireProposed1: number;
  stage: Stage;
  sections: number; // count of included sections, 4 to 14
  responded: number; // insurers that have responded
  insurerCount: number; // insurers on the proposal (0 means none selected yet)
  dueInDays: number; // T+n for the due date (new) or expiry (renewal)
  owner: string; // fictional owner names: Asha Menon, Rahul Iyer, Priya Nair, Vikram Shah
}

const NEW_SPECS: readonly Spec[] = [
  {
    n: '0101',
    client: 'Sundarvan Agro Foods Pvt Ltd',
    city: 'Nashik',
    product: 'BSUS',
    fireProposed1: 3.85 * CRORE,
    stage: 'DRAFT',
    sections: 4,
    responded: 0,
    insurerCount: 0,
    dueInDays: 45,
    owner: 'Priya Nair',
  },
  {
    n: '0102',
    client: 'Tarangini Textiles Ltd',
    city: 'Tiruppur',
    product: 'BLUS',
    fireProposed1: 18.6 * CRORE,
    stage: 'DATA_SHEET',
    sections: 7,
    responded: 0,
    insurerCount: 3,
    dueInDays: 38,
    owner: 'Rahul Iyer',
  },
  {
    n: '0103',
    client: 'Himsagar Cold Chain Pvt Ltd',
    city: 'Ratnagiri',
    product: 'BLUS',
    fireProposed1: 42.75 * CRORE,
    stage: 'RFQ_SENT',
    sections: 9,
    responded: 1,
    insurerCount: 5,
    dueInDays: 21,
    owner: 'Priya Nair',
  },
  {
    n: '0113',
    client: 'Rangoli Home Furnishings Pvt Ltd',
    city: 'Jaipur',
    product: 'BLUS',
    fireProposed1: 12.35 * CRORE,
    stage: 'RFQ_SENT',
    sections: 6,
    responded: 0,
    insurerCount: 4,
    dueInDays: 30,
    owner: 'Vikram Shah',
  },
  {
    n: '0104',
    client: 'Vasundhara Polymers Ltd',
    city: 'Bharuch',
    product: 'SFSP',
    fireProposed1: 96.4 * CRORE,
    stage: 'QUOTES_RECEIVED',
    sections: 11,
    responded: 4,
    insurerCount: 5,
    dueInDays: 16,
    owner: 'Rahul Iyer',
  },
  {
    n: '0105',
    client: 'Suryodaya Solar Components Pvt Ltd',
    city: 'Jodhpur',
    product: 'PAR',
    fireProposed1: 27.3 * CRORE,
    stage: 'QCR',
    sections: 8,
    responded: 5,
    insurerCount: 5,
    dueInDays: 9,
    owner: 'Asha Menon',
  },
  {
    n: '0106',
    client: 'Neelgiri Packaging Works',
    city: 'Coimbatore',
    product: 'BSUS',
    fireProposed1: 40 * LAKH,
    stage: 'PLACED',
    sections: 5,
    responded: 3,
    insurerCount: 3,
    dueInDays: 5,
    owner: 'Priya Nair',
  },
];

const EXISTING_SPECS: readonly Spec[] = [
  {
    n: '0107',
    client: 'Kesar Valley Spices LLP',
    city: 'Kochi',
    product: 'BSUS',
    fireProposed1: 4.6 * CRORE,
    stage: 'QUOTES_RECEIVED',
    sections: 6,
    responded: 3,
    insurerCount: 4,
    dueInDays: 12,
    owner: 'Priya Nair',
  },
  {
    n: '0108',
    client: 'Lohgarh Steel Fabricators Pvt Ltd',
    city: 'Jabalpur',
    product: 'SFSP',
    fireProposed1: 118.5 * CRORE,
    stage: 'RFQ_SENT',
    sections: 12,
    responded: 2,
    insurerCount: 5,
    dueInDays: 27,
    owner: 'Rahul Iyer',
  },
  {
    n: '0114',
    client: 'Swarnamukhi Hospitality Pvt Ltd',
    city: 'Tirupati',
    product: 'BLUS',
    fireProposed1: 31.4 * CRORE,
    stage: 'QUOTES_RECEIVED',
    sections: 8,
    responded: 2,
    insurerCount: 3,
    dueInDays: 33,
    owner: 'Vikram Shah',
  },
  {
    n: '0109',
    client: 'Meghmala Tea Estates Ltd',
    city: 'Dibrugarh',
    product: 'BLUS',
    fireProposed1: 22.1 * CRORE,
    stage: 'DATA_SHEET',
    sections: 10,
    responded: 0,
    insurerCount: 4,
    dueInDays: 44,
    owner: 'Asha Menon',
  },
  {
    n: '0110',
    client: 'Shrivardhan Auto Parts Pvt Ltd',
    city: 'Chennai',
    product: 'PAR',
    fireProposed1: 63.8 * CRORE,
    stage: 'QCR',
    sections: 14,
    responded: 4,
    insurerCount: 5,
    dueInDays: 56,
    owner: 'Rahul Iyer',
  },
  {
    n: '0111',
    client: 'Shilpgram Marble Works Pvt Ltd',
    city: 'Udaipur',
    product: 'BLUS',
    fireProposed1: 9.75 * CRORE,
    stage: 'DRAFT',
    sections: 5,
    responded: 0,
    insurerCount: 0,
    dueInDays: 88,
    owner: 'Vikram Shah',
  },
  {
    n: '0112',
    client: 'Ambar Precision Castings Pvt Ltd',
    city: 'Rajkot',
    product: 'SFSP',
    fireProposed1: 74.2 * CRORE,
    stage: 'PLACED',
    sections: 9,
    responded: 5,
    insurerCount: 5,
    dueInDays: 19,
    owner: 'Asha Menon',
  },
];

/** Which of the 14 sections are included, for a given count: Fire first, then down the list. */
function includedCodes(count: number): Set<string> {
  return new Set(SECTION_CODES.slice(0, count));
}

/** The largest multiplier any option applies to a base amount (Proposed 2 is base × 1.08). */
const MAX_OPTION_MULTIPLIER = 1.08;

/**
 * Base amounts per included section (Proposed 1). Fire is the headline SI; the other included
 * sections share a budget sized so that even Proposed 2's total stays within the product's band.
 */
function sectionAmounts(
  fireSi: number,
  includedCount: number,
  product: Spec['product'],
): Map<string, number> {
  const amounts = new Map<string, number>();
  const others = SECTION_CODES.slice(1, includedCount);
  amounts.set('FIRE', Math.round(fireSi));
  if (others.length === 0) return amounts;

  // Headroom for the non-fire sections so that (fire + others) × 1.08 ≤ band.max.
  const band = PRODUCT_BANDS[product];
  const cappedMax = Math.min(band.max, fireSi * 4); // keep SFSP/PAR totals sensible, not astronomical
  const budget = Math.max(0, cappedMax / MAX_OPTION_MULTIPLIER - fireSi) * 0.9;
  const weights = others.map((_, index) => 1 + (index % 4));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  others.forEach((code, index) => {
    amounts.set(code, Math.round((budget * (weights[index] ?? 1)) / weightSum));
  });
  return amounts;
}

/** The quote status for insurer i, given how many have responded. */
function quoteStatus(index: number, responded: number, stage: Stage): QuoteStatus {
  if (STAGE_INDEX[stage] < STAGE_INDEX.RFQ_SENT) return 'NOT_SENT';
  if (index < responded) return index % 3 === 2 ? 'DECLINED' : 'QUOTED';
  if (STAGE_INDEX[stage] >= STAGE_INDEX.QUOTES_RECEIVED && index === responded)
    return 'NO_RESPONSE';
  return 'SENT';
}

/** Document statuses that match the stage (illustrative, not a workflow rule). */
function documentStatus(kind: DocumentKind, stage: Stage): DocStatus {
  const reached = STAGE_INDEX[stage];
  switch (kind) {
    case 'DATA_SHEET':
      return reached >= STAGE_INDEX.RFQ_SENT
        ? 'APPROVED'
        : reached >= STAGE_INDEX.DATA_SHEET
          ? 'READY'
          : 'DRAFT';
    case 'RFQ':
      return reached >= STAGE_INDEX.RFQ_SENT ? 'SENT' : 'NOT_STARTED';
    case 'QCR':
      return reached >= STAGE_INDEX.PLACED
        ? 'APPROVED'
        : reached >= STAGE_INDEX.QCR
          ? 'READY'
          : 'NOT_STARTED';
    case 'PLACEMENT_SLIP':
      return reached >= STAGE_INDEX.PLACED ? 'SENT' : 'NOT_STARTED';
  }
}

/** A few recent activity events for a stage, newest last here (the UI shows newest first). */
function buildActivity(
  spec: Spec,
  reference: string,
  nowMs: number,
): { at: string; actor: string; message: string }[] {
  const reached = STAGE_INDEX[spec.stage];
  const events: { daysAgo: number; message: string }[] = [
    { daysAgo: 20, message: `${reference} created` },
  ];
  if (reached >= STAGE_INDEX.DATA_SHEET)
    events.push({ daysAgo: 14, message: 'Data Sheet completed' });
  if (reached >= STAGE_INDEX.RFQ_SENT)
    events.push({ daysAgo: 9, message: `RFQ sent to ${spec.insurerCount} insurers` });
  if (reached >= STAGE_INDEX.QUOTES_RECEIVED)
    events.push({ daysAgo: 5, message: `${spec.responded} insurer responses recorded` });
  if (reached >= STAGE_INDEX.QCR) events.push({ daysAgo: 2, message: 'QCR prepared for review' });
  if (reached >= STAGE_INDEX.PLACED) events.push({ daysAgo: 1, message: 'Placement Slip issued' });
  const hourMs = 60 * 60 * 1000;
  return events.map((event, index) => ({
    at: new Date(nowMs - event.daysAgo * 24 * hourMs - index * hourMs).toISOString(),
    actor: spec.owner,
    message: event.message,
  }));
}

function buildInsurers(spec: Spec, nowMs: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  return INSURERS.slice(0, spec.insurerCount).map((insurer, index) => {
    const status = quoteStatus(index, spec.responded, spec.stage);
    const updatedAt =
      status === 'NOT_SENT' ? null : new Date(nowMs - (index + 1) * dayMs).toISOString();
    return { insurer: `${insurer} General Insurance`, status, updatedAt };
  });
}

function buildDocuments(spec: Spec, nowMs: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  return DOCUMENT_ORDER.map((kind, index) => {
    const status = documentStatus(kind, spec.stage);
    const updatedAt =
      status === 'NOT_STARTED' ? null : new Date(nowMs - (index + 1) * dayMs).toISOString();
    return { kind, status, updatedAt };
  });
}

function commonFields(spec: Spec, nowMs: number) {
  const today = toIstDate(nowMs);
  const reference = `PRP-2026-${spec.n}`;
  const addOnCount = Math.min(ADDON_NAMES.length, 3 + (Number(spec.n) % 5));
  const clauseCount = Math.min(CLAUSE_NAMES.length, 2 + (Number(spec.n) % 4));
  const excessCount = Math.min(3, spec.sections);
  // Placed proposals: the later of the 1st of this month and 2 days ago, so it is in this month.
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const twoDaysAgo = addDays(today, -2);
  const placedOn =
    spec.stage === 'PLACED' ? (twoDaysAgo > firstOfMonth ? twoDaysAgo : firstOfMonth) : null;

  return {
    id: `prp-${spec.n}`,
    reference,
    client: { name: spec.client, city: spec.city },
    product: spec.product,
    stage: spec.stage,
    owner: spec.owner,
    policyPeriod: { start: today, end: addDays(today, 365) },
    addOns: {
      selected: ADDON_NAMES.slice(0, addOnCount),
      catalogueSize: ADDON_CATALOGUE_SIZES[spec.product],
    },
    clauses: CLAUSE_NAMES.slice(0, clauseCount),
    excess: SECTION_CODES.slice(0, excessCount).map((section) => ({ section, note: EXCESS_NOTE })),
    insurers: buildInsurers(spec, nowMs),
    documents: buildDocuments(spec, nowMs),
    activity: buildActivity(spec, reference, nowMs),
    placedOn,
  };
}

function buildNew(spec: Spec, nowMs: number): NewProposal {
  const today = toIstDate(nowMs);
  const amounts = sectionAmounts(spec.fireProposed1, spec.sections, spec.product);
  const included = includedCodes(spec.sections);
  return {
    ...commonFields(spec, nowMs),
    type: 'NEW',
    dueDate: addDays(today, spec.dueInDays),
    sections: SECTION_CODES.map((code) => {
      const base = amounts.get(code) ?? 0;
      return {
        code,
        included: included.has(code),
        sumInsured: {
          proposed1: toRupees(base),
          // Proposed 2 is a modest increase on Proposed 1.
          proposed2: toRupees(Math.round(base * 1.08)),
        },
      };
    }),
  };
}

function buildRenewal(spec: Spec, nowMs: number): RenewalProposal {
  const today = toIstDate(nowMs);
  const amounts = sectionAmounts(spec.fireProposed1, spec.sections, spec.product);
  const included = includedCodes(spec.sections);
  const insurer = `${INSURERS[Number(spec.n) % INSURERS.length]} General Insurance`;
  return {
    ...commonFields(spec, nowMs),
    type: 'EXISTING',
    existingPolicy: {
      insurer,
      policyNumber: `${spec.product}/2025/${spec.n}`,
      expiresOn: addDays(today, spec.dueInDays),
    },
    sections: SECTION_CODES.map((code) => {
      const base = amounts.get(code) ?? 0;
      return {
        code,
        included: included.has(code),
        sumInsured: {
          // Existing is a little below Proposed 1; both stay in the product's band.
          existing: toRupees(Math.round(base * 0.9)),
          proposed1: toRupees(base),
          proposed2: toRupees(Math.round(base * 1.08)),
        },
      };
    }),
  };
}

function toRupees(value: number): Rupees {
  return Math.max(0, Math.round(value)).toString();
}

/**
 * The 14 sample proposals, with every date relative to `now` (IST) and no time after `now`.
 * Fictional company, person and insurer names. Imported only by src/lib/api and tests.
 */
export function buildSampleProposals(now: Date | number = Date.now()): Proposal[] {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return [
    ...NEW_SPECS.map((spec) => buildNew(spec, nowMs)),
    ...EXISTING_SPECS.map((spec) => buildRenewal(spec, nowMs)),
  ];
}

/** Total number of sample proposals; used by tests and the data layer. */
export const SAMPLE_PROPOSAL_COUNT = NEW_SPECS.length + EXISTING_SPECS.length;
